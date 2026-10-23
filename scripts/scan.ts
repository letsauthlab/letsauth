/**
 * The scanner's one command (spec FR-012).
 *
 *   pnpm scan <url>                       report for any MCP server URL, nothing written
 *   pnpm scan <server-id>                 report for a listed server
 *   pnpm scan --all                       every listed server with an HTTP transport whose auth
 *                                         class is OAuth or unknown (009)
 *   --write                               append the observations the nightly rule would
 *   --summary <file>                      write the run summary (Markdown) to a file
 *   --json                                print the report(s) as JSON instead of text
 *   --timeout <ms>                        per-request timeout (default 10000)
 *
 * Exit 0 on success, 1 when a URL is refused or a scan throws.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { currentRevision } from "../src/lib/atlas";
import { hasNoOAuth } from "../src/lib/classes";
import { DATA_ROOT, type Dataset, getDataset } from "../src/lib/data";
import { nodeFetcher } from "../src/scanner/fetch";
import { guardUrl } from "../src/scanner/guard";
import {
  appendObservations,
  authNote,
  heldCells,
  type RunResult,
  summarise,
  toAppend,
} from "../src/scanner/observations";
import type { AsCacheEntry } from "../src/scanner/probe";
import { type Report, scan, stamp } from "../src/scanner/report";
import { SCANNER_ID } from "../src/scanner/version";
import type { Server } from "../src/schema";

interface Args {
  targets: string[];
  all: boolean;
  write: boolean;
  json: boolean;
  summary?: string;
  timeoutMs: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { targets: [], all: false, write: false, json: false, timeoutMs: 10_000 };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] as string;
    if (a === "--all") args.all = true;
    else if (a === "--write") args.write = true;
    else if (a === "--json") args.json = true;
    else if (a === "--summary") args.summary = argv[++i];
    else if (a === "--timeout") args.timeoutMs = Number(argv[++i]);
    else if (a.startsWith("--")) throw new Error(`unknown flag ${a}`);
    else args.targets.push(a);
  }
  if (!args.all && args.targets.length === 0) {
    throw new Error(
      "usage: pnpm scan <url> | <server-id> | --all [--write] [--summary <file>] [--json]",
    );
  }
  return args;
}

const STATUS_WORD: Record<string, string> = {
  supported: "supported  ",
  partial: "partial    ",
  unsupported: "unsupported",
  unknown: "unknown    ",
  "not-applicable": "n/a        ",
};

function printReport(report: Report): void {
  const out: string[] = [];
  out.push(
    `${report.scanner} · ${report.target.url}${report.target.server ? ` (${report.target.server})` : ""}`,
  );
  out.push(`against ${report.revision.spec} ${report.revision.revision} · ${report.generatedAt}`);
  out.push(`summary: ${report.summary.label}`);
  for (const c of report.summary.open) out.push(`  ${c.level} ${c.status}: ${c.name}`);
  for (const n of report.summary.notes) out.push(`  ${n}`);
  out.push("");
  for (const c of report.checks) {
    out.push(`${STATUS_WORD[c.status] ?? c.status}  ${c.level.padEnd(6)} ${c.feature}`);
    out.push(`             ${c.evidence}`);
  }
  out.push("");
  out.push("requests:");
  for (const r of report.requests) {
    out.push(
      `  ${r.status ?? "–"} ${r.url}${r.error ? ` (${r.error}${r.detail ? `: ${r.detail}` : ""})` : ""}`,
    );
  }
  console.log(out.join("\n"));
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const data: Dataset = getDataset();
  const revision = currentRevision(data);
  const now = stamp();
  const fetcher = nodeFetcher({ timeoutMs: args.timeoutMs, guard: guardUrl });
  const asCache = new Map<string, AsCacheEntry>();

  const targets: { id?: string; name: string; url: string; server?: Server }[] = [];
  if (args.all) {
    for (const s of data.servers) {
      if (s.withdrawn || s.transport === "stdio-only") continue;
      // API-key and unauthenticated servers have no OAuth to judge; a scan would only record
      // 404s as failures. An unknown class is scanned so the summary can say what the endpoint
      // suggests (009).
      if (hasNoOAuth(s)) continue;
      targets.push({ id: s.id, name: s.name, url: s.url, server: s });
    }
  }
  for (const t of args.targets) {
    const server = data.servers.find((s) => s.id === t);
    if (server && hasNoOAuth(server)) {
      // still report on the URL, but write nothing over the listing's not-applicable cells
      targets.push({ name: server.name, url: server.url, server });
    } else if (server) targets.push({ id: server.id, name: server.name, url: server.url, server });
    else targets.push({ name: t, url: t });
  }

  const results: RunResult[] = [];
  const reports: Report[] = [];
  let failed = false;
  for (const target of targets) {
    const result: RunResult = {
      server: { id: target.id ?? "", name: target.name, url: target.url },
      appended: [],
    };
    const guarded = await guardUrl(target.url);
    if (!guarded.ok) {
      result.error = guarded.reason;
      failed = true;
      if (!args.json) console.error(`${target.url}: refused: ${guarded.reason}`);
    } else {
      try {
        const report = await scan({ url: guarded.url, serverId: target.id }, data, {
          fetcher,
          guard: guardUrl,
          now,
          asCache,
        });
        result.report = report;
        reports.push(report);
        if (target.server) result.authNote = authNote(report, target.server);
        if (target.id) {
          result.appended = toAppend(report, data);
          result.held = heldCells(report, data);
          if (args.write && result.appended.length > 0) {
            appendObservations(
              join(DATA_ROOT, "observations", `${target.id}.yaml`),
              result.appended,
            );
          }
        }
        if (!args.json) {
          printReport(report);
          if (target.id) {
            console.log(
              `${args.write ? "appended" : "would append"} ${result.appended.length} observation(s) to data/observations/${target.id}.yaml`,
            );
            if (result.authNote) console.log(result.authNote);
            for (const h of result.held ?? []) {
              console.log(
                `held by hand: ${h.feature} stays ${h.status} (${h.method}, ${h.observedBy}); the scan saw ${h.scanStatus}`,
              );
            }
          }
          console.log("");
        }
      } catch (err) {
        result.error = (err as Error).message;
        failed = true;
        if (!args.json) console.error(`${target.url}: ${result.error}`);
      }
    }
    results.push(result);
  }

  if (args.json) console.log(JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2));
  const summary = summarise(
    results.filter((r) => r.server.id),
    now,
    revision.id,
  );
  if (args.summary) {
    writeFileSync(args.summary, summary);
    if (!args.json) console.log(`summary written to ${args.summary}`);
  }
  const appended = results.reduce((n, r) => n + r.appended.length, 0);
  if (!args.json)
    console.log(
      `${SCANNER_ID}: ${results.length} target(s), ${appended} observation(s) ${args.write ? "appended" : "to append"}`,
    );
  return failed ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error((err as Error).message);
    process.exit(1);
  },
);
