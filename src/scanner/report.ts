import { CATEGORY_ORDER, currentRevision, featureInRevision, getSpec } from "../lib/atlas";
import type { Dataset } from "../lib/data";
import type {
  Feature,
  FeatureLevel,
  FeatureParty,
  Observation,
  ObservationStatus,
} from "../schema";
import { runChecks } from "./checks";
import type { Fetcher } from "./fetch";
import { type Grade, grade } from "./grade";
import type { Guard } from "./guard";
import {
  type AsCacheEntry,
  type PrmLocation,
  type Probe,
  probe,
  type RequestRecord,
} from "./probe";
import { OBSERVER, SCANNER_ID } from "./version";

/** Bumps on a breaking change of the report shape (contracts/report.md). */
export const REPORT_VERSION = 1;

export interface CheckResult {
  feature: string;
  name: string;
  party: FeatureParty;
  level: FeatureLevel;
  levelNote?: string;
  section: string;
  citation: string;
  status: ObservationStatus;
  evidence: string;
  /** When the status was observed; absent on a recorded report for a cell never scanned. */
  observedAt?: string;
  /** The strategy that decided (`checks.ts`); absent on a recorded report. */
  via?: string;
}

export interface Discovered {
  protectedResource: {
    url: string;
    location: PrmLocation;
    resource?: string;
    authorizationServers: string[];
    scopesSupported?: string[];
  } | null;
  /** The endpoint's answer to the unauthenticated ladder; null when it gave no answer. */
  challenge: {
    url: string;
    status: number;
    /** The request that got the answer, and the ladder step (010). */
    method: "GET" | "POST";
    step: string;
    header: string | null;
    resourceMetadata: string | null;
    scope: string[] | null;
  } | null;
  /** A note for the maintainer when the listed URL looks stale (010); never an observation. */
  endpointNote: string | null;
  /**
   * What the endpoint's answer suggests about the server's auth class (009): `oauth` when a 401
   * challenge or a protected resource metadata document was found, `none` when a step of the
   * ladder was accepted with 200, null when the answer settles nothing. A hint for the
   * maintainer, compared with the server file in the run summary; never written anywhere.
   */
  authSuggestion: AuthSuggestion | null;
  authorizationServer: {
    issuer: string;
    url: string;
    endpoints: Record<string, string>;
    codeChallengeMethodsSupported?: string[];
    clientIdMetadataDocumentSupported?: unknown;
    registrationEndpoint: string | null;
    authorizationResponseIssParameterSupported?: unknown;
  } | null;
  othersNotChecked: string[];
}

export interface Report {
  version: number;
  scanner: string;
  generatedAt: string;
  /** True when built from the repository's observations; false for a live scan. */
  recorded: boolean;
  target: { url: string; server: string | null };
  revision: { spec: string; revision: string };
  method: "passive-scan";
  requests: RequestRecord[];
  discovered: Discovered | null;
  checks: CheckResult[];
  grade: Grade;
  /** The checks as data-model observations; empty when the target is not a listed server. */
  observations: Observation[];
}

const PARTY_ORDER: FeatureParty[] = ["mcp-server", "authorization-server"];

export type AuthSuggestion = "oauth" | "none";

/**
 * The auth class the probe's answers point at (009). A 401 challenge with a `resource_metadata`
 * pointer, or a protected resource metadata document by either route, is OAuth as the MCP
 * specification profiles it. A 200 to an unauthenticated step means the endpoint accepted the
 * request without any credential. A bare 401 settles nothing: a bearer challenge may guard an
 * API key as well as an OAuth token.
 */
export function suggestAuth(p: Probe): AuthSuggestion | undefined {
  if (p.prm || p.challenge?.resourceMetadata) return "oauth";
  if (p.endpointRequests.some((r) => r.status === 200 && !r.error)) return "none";
  return undefined;
}

/** The features the scanner judges in a revision: passive, server party, defined in it; report order. */
export function passiveFeatures(data: Dataset, revisionId: string): Feature[] {
  return data.features
    .filter(
      (f) => f.observable === "passive" && f.party !== "client" && featureInRevision(f, revisionId),
    )
    .sort(
      (a, b) =>
        PARTY_ORDER.indexOf(a.party) - PARTY_ORDER.indexOf(b.party) ||
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
        a.id.localeCompare(b.id),
    );
}

/** ISO 8601 UTC to the second, as the data files carry it. */
export function stamp(date = new Date()): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export interface ScanTarget {
  url: string;
  /** Set when the target is a listed server: observations are then produced. */
  serverId?: string;
}

export interface ScanOptions {
  fetcher: Fetcher;
  guard?: Guard;
  /** The run's timestamp; one per run so every observation of a run shares it. */
  now?: string;
  asCache?: Map<string, AsCacheEntry>;
  /** Defaults to the current revision of the MCP Authorization spec. */
  revisionId?: string;
}

function discoveredOf(p: Probe): Discovered {
  return {
    protectedResource: p.prm
      ? {
          url: p.prm.url,
          location: p.prm.location,
          resource: p.prm.resource,
          authorizationServers: p.prm.authorizationServers,
          scopesSupported: p.prm.scopesSupported,
        }
      : null,
    challenge: p.challenge
      ? {
          url: p.challenge.url,
          status: p.challenge.status,
          method: p.challenge.method,
          step: p.challenge.step,
          header: p.challenge.header ?? null,
          resourceMetadata: p.challenge.resourceMetadata ?? null,
          scope: p.challenge.scope ?? null,
        }
      : null,
    endpointNote: p.endpointNote ?? null,
    authSuggestion: suggestAuth(p) ?? null,
    authorizationServer: p.as
      ? {
          issuer: p.as.issuer,
          url: p.as.url,
          endpoints: p.as.endpoints,
          codeChallengeMethodsSupported: p.as.codeChallengeMethodsSupported,
          clientIdMetadataDocumentSupported: p.as.clientIdMetadataDocumentSupported,
          registrationEndpoint: p.as.registrationEndpoint ?? null,
          authorizationResponseIssParameterSupported:
            p.as.authorizationResponseIssParameterSupported,
        }
      : null,
    othersNotChecked: p.othersNotChecked,
  };
}

/** Probes the target, runs every passive check, grades, and shapes the report. */
export async function scan(
  target: ScanTarget,
  data: Dataset,
  options: ScanOptions,
): Promise<Report> {
  const spec = getSpec(data);
  const revisionId = options.revisionId ?? currentRevision(data).id;
  const revision = spec.revisions.find((r) => r.id === revisionId);
  if (!revision) throw new Error(`revision "${revisionId}" of "${spec.id}" not found`);
  const now = options.now ?? stamp();
  const features = passiveFeatures(data, revisionId);
  const p = await probe(target.url, {
    fetcher: options.fetcher,
    guard: options.guard,
    asCache: options.asCache,
  });
  const runs = runChecks(p, features);
  const checks: CheckResult[] = runs.map(({ feature, outcome }) => {
    const entry = featureInRevision(feature, revisionId);
    if (!entry)
      throw new Error(`feature "${feature.id}" is not defined in revision "${revisionId}"`);
    return {
      feature: feature.id,
      name: feature.name,
      party: feature.party,
      level: entry.level,
      levelNote: entry.levelNote,
      section: entry.section,
      citation: revision.url,
      status: outcome.status,
      evidence: outcome.evidence,
      observedAt: now,
      via: outcome.via,
    };
  });
  const observations: Observation[] = target.serverId
    ? checks.map((c) => ({
        server: target.serverId as string,
        feature: c.feature,
        revision: { spec: spec.id, revision: revisionId },
        status: c.status,
        method: "passive-scan",
        observedAt: now,
        observedBy: OBSERVER,
        evidence: c.evidence,
      }))
    : [];
  return {
    version: REPORT_VERSION,
    scanner: SCANNER_ID,
    generatedAt: now,
    recorded: false,
    target: { url: target.url, server: target.serverId ?? null },
    revision: { spec: spec.id, revision: revisionId },
    method: "passive-scan",
    requests: p.requests,
    discovered: discoveredOf(p),
    checks,
    grade: grade(checks),
    observations,
  };
}
