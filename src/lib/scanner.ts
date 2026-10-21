import { type Grade, grade, NOT_SCANNED, noOAuth } from "../scanner/grade";
import { type CheckResult, passiveFeatures, REPORT_VERSION, type Report } from "../scanner/report";
import { wellKnownPrmUrls } from "../scanner/urls";
import { SCANNER_ID } from "../scanner/version";
import type { Feature, FeatureRevision, Observation, Server } from "../schema";
import {
  CATEGORY_ORDER,
  currentRevision,
  featureInRevision,
  getSpec,
  observationsFor,
} from "./atlas";
import { authOf, hasNoOAuth } from "./classes";
import type { Dataset } from "./data";

/**
 * The scanner as a view on the model, for the pages: the report for a server is the set of its
 * newest scanner observations per passive feature under the current revision, graded at render
 * time. Nothing here contacts a server; the modules imported from `src/scanner/` are pure.
 */

export interface PassiveCheck {
  feature: Feature;
  entry: FeatureRevision;
}

/** The features the scanner judges, in report order (server party first, then category, then id). */
export function passiveChecks(
  data: Dataset,
  revisionId = currentRevision(data).id,
): PassiveCheck[] {
  return passiveFeatures(data, revisionId).map((feature) => {
    const entry = featureInRevision(feature, revisionId);
    if (!entry)
      throw new Error(`feature "${feature.id}" is not defined in revision "${revisionId}"`);
    return { feature, entry };
  });
}

export interface ScanView {
  server: Server;
  revisionId: string;
  checks: CheckResult[];
  /** The newest scanner observation date across the checks; undefined when never scanned. */
  scannedAt?: string;
  scanned: boolean;
  grade: Grade;
}

/** True for an observation the scanner wrote (any version). */
export const isScannerObservation = (o: Observation) =>
  o.method === "passive-scan" && o.observedBy.startsWith("scanner@");
const isScanner = isScannerObservation;

/** The newest scanner observation for a cell, ignoring manual and documentation entries. */
export function newestScannerObservation(
  data: Dataset,
  serverId: string,
  featureId: string,
  revisionId: string,
): Observation | undefined {
  return observationsFor(data, serverId, featureId, revisionId).find(isScanner);
}

export function latestScan(
  data: Dataset,
  server: Server,
  revisionId = currentRevision(data).id,
): ScanView {
  const spec = getSpec(data);
  const revision = spec.revisions.find((r) => r.id === revisionId);
  if (!revision) throw new Error(`revision "${revisionId}" not found`);
  let scannedAt: string | undefined;
  const checks: CheckResult[] = passiveChecks(data, revisionId).map(({ feature, entry }) => {
    const obs = newestScannerObservation(data, server.id, feature.id, revisionId);
    if (obs && (!scannedAt || Date.parse(obs.observedAt) > Date.parse(scannedAt)))
      scannedAt = obs.observedAt;
    return {
      feature: feature.id,
      name: feature.name,
      party: feature.party,
      level: entry.level,
      levelNote: entry.levelNote,
      section: entry.section,
      citation: revision.url,
      status: obs?.status ?? "unknown",
      evidence: obs?.evidence ?? "",
      observedAt: obs?.observedAt,
    };
  });
  const scanned = scannedAt !== undefined;
  return {
    server,
    revisionId,
    checks,
    scannedAt,
    scanned,
    grade: hasNoOAuth(server)
      ? noOAuth(authOf(server).value as "api-key" | "none")
      : scanned
        ? grade(checks)
        : NOT_SCANNED,
  };
}

/** Every listed server with its view, by name. Never ordered by grade (FR-009). */
export function scannerIndex(data: Dataset, revisionId = currentRevision(data).id): ScanView[] {
  return data.servers
    .filter((s) => !s.withdrawn)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((server) => latestScan(data, server, revisionId));
}

/** Counts for the index head. */
export function scannerFacts(views: ScanView[]) {
  const scanned = views.filter((v) => v.scanned);
  const newest = scanned
    .map((v) => v.scannedAt ?? "")
    .sort((a, b) => Date.parse(a) - Date.parse(b))
    .at(-1);
  return { servers: views.length, scanned: scanned.length, newest };
}

/** The recorded report (contracts/report.md) for a listed server. */
export function reportFromView(view: ScanView, generatedAt = new Date().toISOString()): Report {
  return {
    version: REPORT_VERSION,
    scanner: SCANNER_ID,
    generatedAt,
    recorded: true,
    target: { url: view.server.url, server: view.server.id },
    revision: { spec: "mcp-authorization", revision: view.revisionId },
    method: "passive-scan",
    requests: [],
    discovered: null,
    checks: view.checks,
    grade: view.grade,
    observations: [],
  };
}

/** One request of the ladder as the report's evidence records it (M12). */
export interface LadderLine {
  method: "GET" | "POST";
  url: string;
  /** The answer as the evidence words it: `HTTP 200`, `HTTP 302, redirect`, `timeout`. */
  answer: string;
  /**
   * What the checks read from the answer: the endpoint's status and challenge header, a
   * document's fields by name, or `status` when nothing more was read.
   */
  read: string[];
}

const EVIDENCE = /^(https:\/\/\S+) — ([^;]+?)(?:; (.*))?$/s;
/** A field a check names first in its note: `issuer: …`, `scopes_supported without …`. */
const FIELD = /^(WWW-Authenticate|issuer|resource|[a-z]+(?:_[a-z]+)+)(?=[: ])/;
/** The endpoint ladder in words, as checks.ts writes it: `GET HTTP 405, POST HTTP 400`. */
const LADDER_STEP = /\b(GET|POST) (HTTP \d{3}|[a-z-]+)/g;

const sameUrl = (a: string, b: string) => {
  try {
    return new URL(a).href === new URL(b).href;
  } catch {
    return a === b;
  }
};

/** The answer without the detail in brackets: `HTTP 302, redirect (not followed to …)`. */
const shortAnswer = (answer: string) => answer.replace(/\s*\(.*\)$/s, "").trim();

/**
 * The requests behind a report, in the order the scanner makes them: protected resource
 * metadata (path-aware, then root), the endpoint (GET, then POST), any other document (the
 * challenge's pointer), then the authorization server. Read from the evidence of the newest
 * scanner observation of each check; one line per method and address, the newest answer wins.
 * A recorded report keeps no request log of its own (`requests` is empty), so the evidence is
 * what it records.
 */
export function requestLadder(view: ScanView): LadderLine[] {
  const target = view.server.url;
  const prm = wellKnownPrmUrls(target);
  const lines = new Map<string, LadderLine & { at: number; order: number }>();
  let order = 0;
  const add = (method: "GET" | "POST", url: string, answer: string, at: number, field?: string) => {
    const key = `${method} ${url}`;
    const line = lines.get(key);
    if (!line || at > line.at) {
      lines.set(key, { method, url, answer, read: [], at, order: line?.order ?? order++ });
    }
    const current = lines.get(key);
    if (current && field && current.answer === answer && !current.read.includes(field)) {
      current.read.push(field);
    }
  };
  for (const check of view.checks) {
    if (!check.observedAt) continue;
    const m = check.evidence.match(EVIDENCE);
    if (!m?.[1] || !m[2]) continue;
    const [, url, answer, note = ""] = m;
    const at = Date.parse(check.observedAt);
    if (sameUrl(url, target)) {
      const steps = [...note.matchAll(LADDER_STEP)];
      if (steps.length > 0) {
        for (const [, method, word] of steps) add(method as "GET" | "POST", url, word ?? "", at);
        continue;
      }
      add("GET", url, shortAnswer(answer), at);
      continue;
    }
    add("GET", url, shortAnswer(answer), at, note.match(FIELD)?.[1]);
  }
  const stage = (url: string) => {
    const i = prm.findIndex((p) => sameUrl(p, url));
    if (i >= 0) return i;
    if (sameUrl(url, target)) return 10;
    if (/\/\.well-known\/(oauth-authorization-server|openid-configuration)/.test(url)) return 30;
    return 20;
  };
  return [...lines.values()]
    .sort(
      (a, b) =>
        stage(a.url) - stage(b.url) ||
        (a.method === b.method ? 0 : a.method === "GET" ? -1 : 1) ||
        a.order - b.order,
    )
    .map(({ method, url, answer, read }) => ({
      method,
      url,
      answer,
      read:
        read.length > 0 ? read : sameUrl(url, target) ? ["status", "WWW-Authenticate"] : ["status"],
    }));
}

/** The requirements the scanner does not judge (active or manual), for the report page's note. */
export function unscannedFeatures(data: Dataset, revisionId = currentRevision(data).id): Feature[] {
  return data.features
    .filter(
      (f) => f.party !== "client" && f.observable !== "passive" && featureInRevision(f, revisionId),
    )
    .sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
        a.id.localeCompare(b.id),
    );
}
