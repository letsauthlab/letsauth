import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { stringify } from "yaml";
import { currentCell } from "../lib/atlas";
import { AUTH_LABEL, authOf } from "../lib/classes";
import type { Dataset } from "../lib/data";
import { isScannerObservation, newestScannerObservation } from "../lib/scanner";
import type { Observation, ObservationMethod, ObservationStatus, Server } from "../schema";
import type { Report } from "./report";
import { OBSERVER } from "./version";

/**
 * The append rule (data-model.md): the scanner compares with its own last observation of the
 * cell, never with a person's. It appends when it has none, when its last one came from an
 * older scanner version, or when status or evidence differ from what it sees now. A newer
 * manual or vendor-claim observation therefore stands until the scanner sees something new; when
 * such an observation disagrees with the scan, the cell is reported as held (`heldCells`).
 * Nothing is ever edited or removed; the file is only ever extended at its end.
 */

/** The observations of a report that the append rule says to write. */
export function toAppend(report: Report, data: Dataset): Observation[] {
  const serverId = report.target.server;
  if (!serverId) return [];
  if (!data.servers.some((s) => s.id === serverId)) {
    throw new Error(`server "${serverId}" not found`);
  }
  const out: Observation[] = [];
  for (const obs of report.observations) {
    if (!data.features.some((f) => f.id === obs.feature)) {
      throw new Error(`feature "${obs.feature}" not found`);
    }
    const mine = newestScannerObservation(data, serverId, obs.feature, obs.revision.revision);
    if (
      !mine ||
      mine.observedBy !== OBSERVER ||
      mine.status !== obs.status ||
      mine.evidence !== obs.evidence
    ) {
      out.push(obs);
    }
  }
  return out;
}

/** A cell whose current observation is a person's and disagrees with what the scan sees. */
export interface HeldCell {
  feature: string;
  /** The status that stands in the atlas. */
  status: ObservationStatus;
  method: ObservationMethod;
  observedBy: string;
  /** What the scanner saw and did not write. */
  scanStatus: ObservationStatus;
}

/** The cells a run leaves to a newer human observation that disagrees with the scan. */
export function heldCells(report: Report, data: Dataset): HeldCell[] {
  const serverId = report.target.server;
  if (!serverId) return [];
  const server = data.servers.find((s) => s.id === serverId);
  if (!server) throw new Error(`server "${serverId}" not found`);
  const appended = new Set(toAppend(report, data).map((o) => o.feature));
  const out: HeldCell[] = [];
  for (const obs of report.observations) {
    if (appended.has(obs.feature)) continue;
    const feature = data.features.find((f) => f.id === obs.feature);
    if (!feature) throw new Error(`feature "${obs.feature}" not found`);
    const current = currentCell(
      data,
      server,
      feature,
      obs.revision.revision,
      obs.revision.spec,
    ).observation;
    if (current && !isScannerObservation(current) && current.status !== obs.status) {
      out.push({
        feature: obs.feature,
        status: current.status,
        method: current.method,
        observedBy: current.observedBy,
        scanStatus: obs.status,
      });
    }
  }
  return out;
}

/** Appends entries to a `data/observations/<server>.yaml` list; creates the file when missing. */
export function appendObservations(filePath: string, entries: Observation[]): void {
  if (entries.length === 0) return;
  const existing = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
  const text = stringify(entries, { lineWidth: 0 });
  const prefix = existing === "" || existing.endsWith("\n") ? existing : `${existing}\n`;
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${prefix}${text}`);
}

/**
 * One line for the maintainer when what the endpoint answered does not sit with the server's auth
 * class (009): the class is `unknown` and the scan suggests one, or the class and the suggestion
 * differ. Never an observation; the class is corrected in the server file, by pull request.
 */
export function authNote(report: Report, server: Server): string | undefined {
  const suggestion = report.discovered?.authSuggestion;
  if (!suggestion) return undefined;
  const auth = authOf(server);
  const says = `the endpoint's answer suggests ${AUTH_LABEL[suggestion].toLowerCase()}`;
  if (auth.value === "unknown") {
    return `auth class ${auth.derived ? "not stated" : "unknown"}; ${says}`;
  }
  if (auth.value !== suggestion) {
    return `auth class ${AUTH_LABEL[auth.value].toLowerCase()} (${server.auth?.method}); ${says}`;
  }
  return undefined;
}

export interface RunResult {
  server: { id: string; name: string; url: string };
  report?: Report;
  appended: Observation[];
  /** Cells left to a newer human observation that disagrees with the scan. */
  held?: HeldCell[];
  /** The endpoint's answer against the server's auth class (009), when they disagree. */
  authNote?: string;
  /** Set when the scan threw or was refused; the server is reported, not skipped silently. */
  error?: string;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** The pull request description for one run. */
export function summarise(results: RunResult[], startedAt: string, revisionId: string): string {
  const appended = results.reduce((n, r) => n + r.appended.length, 0);
  const lines: string[] = [];
  lines.push(
    `Passive scan of ${plural(results.length, "listed server")} against MCP Authorization ${revisionId}, started ${startedAt}.`,
  );
  lines.push("");
  lines.push(
    `${plural(appended, "observation")} appended by \`${OBSERVER}\`. Only public metadata was read: the well-known documents, and the challenge the endpoint returns to an unauthenticated request without a JSON-RPC message (a GET, then an empty POST when the GET was routed elsewhere; status and headers only, no body read); every evidence field starts with the URL that decided the status. Cells that could not be judged are recorded as \`unknown\`, never as \`unsupported\`. A note names a listed URL that looks stale, or an endpoint whose answer does not sit with the server's stated auth class; fix the server file, not the observations. A cell whose newest observation is a person's and disagrees with the scan is left as it is and named under Notes: the scanner writes again only when what it sees changes.`,
  );
  lines.push("");
  lines.push("| Server | Grade | Appended | Could not judge | Notes |");
  lines.push("|---|---|---|---|---|");
  for (const r of results) {
    const unknown = r.report ? r.report.checks.filter((c) => c.status === "unknown").length : 0;
    const gradeText = r.report ? r.report.grade.label : "–";
    const changed = r.appended.map((o) => `\`${o.feature}\` ${o.status}`).join(", ");
    const notes: string[] = [];
    if (r.error) notes.push(`error: ${r.error}`);
    else if (r.report?.discovered?.endpointNote) notes.push(r.report.discovered.endpointNote);
    if (r.authNote) notes.push(r.authNote);
    for (const h of r.held ?? []) {
      notes.push(
        `held by hand: \`${h.feature}\` ${h.status} (${h.method}, ${h.observedBy}) over scan ${h.scanStatus}`,
      );
    }
    const note = notes.join("; ");
    lines.push(
      `| ${r.server.name} (\`${r.server.id}\`) | ${gradeText} | ${r.appended.length}${changed ? `: ${changed}` : ""} | ${unknown} | ${note} |`,
    );
  }
  lines.push("");
  lines.push("Review: open each evidence URL; see `docs/scanner.md` for what each status means.");
  return `${lines.join("\n")}\n`;
}
