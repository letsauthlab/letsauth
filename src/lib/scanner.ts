import { type Grade, grade, NOT_SCANNED, noOAuth } from "../scanner/grade";
import { type CheckResult, passiveFeatures, REPORT_VERSION, type Report } from "../scanner/report";
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
    if (obs && (!scannedAt || obs.observedAt > scannedAt)) scannedAt = obs.observedAt;
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
    .sort()
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
