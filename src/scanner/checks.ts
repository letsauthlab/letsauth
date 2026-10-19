import type { Feature } from "../schema";
import type { Probe, RequestRecord } from "./probe";
import { type Check, type CheckOutcome, firstOf, type Strategy, strategy } from "./strategies";
import { sameIssuer } from "./urls";

/**
 * One check per passively observable feature: the decision table in
 * specs/004-scanner/data-model.md (rows added by 008 and 010), as code. A check is an ordered
 * list of strategies (`strategies.ts`); each strategy is a pure function of the probe. Evidence
 * is deterministic (URL, HTTP status or failure, the deciding field and value) so two runs over
 * the same responses write byte-identical observations.
 */

const EVIDENCE_MAX = 300;

function httpWord(rec: RequestRecord | undefined): string {
  if (!rec) return "no request";
  if (rec.error === "refused") return `refused (${rec.detail})`;
  if (rec.status === null) return rec.error ?? "no response";
  if (rec.error === "server-error" || rec.error === "redirect" || rec.error === "too-large") {
    return `HTTP ${rec.status}, ${rec.error}${rec.detail ? ` (${rec.detail})` : ""}`;
  }
  if (rec.error === "not-json") return `HTTP ${rec.status}, not JSON`;
  return `HTTP ${rec.status}`;
}

function cap(text: string): string {
  return text.length > EVIDENCE_MAX ? `${text.slice(0, EVIDENCE_MAX - 1)}…` : text;
}

function evidence(url: string, rec: RequestRecord | undefined, note: string): string {
  return cap(`${url} — ${httpWord(rec)}; ${note}`);
}

function show(value: unknown): string {
  if (value === undefined) return "absent";
  if (Array.isArray(value))
    return `[${value.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(", ")}]`;
  return typeof value === "string" ? value : JSON.stringify(value);
}

const recordOf = (probe: Probe, url: string | undefined) =>
  probe.requests.find((r) => r.url === url);

/** The well-known requests of a probe, as words for the evidence. */
function wellKnownTried(probe: Probe): string {
  return probe.requests
    .filter((r) => r.url.includes("/.well-known/oauth-protected-resource"))
    .map((r) => httpWord(r))
    .join(", ");
}

/** Every request of the endpoint ladder, as words: `GET HTTP 405, POST HTTP 400`. */
function endpointTried(probe: Probe): string {
  return probe.endpointRequests.map((r) => `${r.method ?? "GET"} ${httpWord(r)}`).join(", ");
}

/** How the challenge route ended, as words for the evidence. */
function challengeWord(probe: Probe): string {
  if (probe.challenge?.resourceMetadata) {
    if (probe.pointerOutcome === "found") return "challenge pointer followed";
    return `challenge pointer ${probe.pointerLast ? httpWord(probe.pointerLast) : "not followed"}`;
  }
  if (probe.challengeOutcome === "found") return "challenge without resource_metadata";
  return `endpoint ${endpointTried(probe) || httpWord(probe.challengeLast)}`;
}

/** Why no PRM could be judged: the decisive request and a word for the reader. */
function prmMissing(probe: Probe): CheckOutcome {
  const last = probe.prmLast;
  const url = last?.url ?? probe.target;
  if (probe.prmOutcome === "error") {
    return {
      status: "unknown",
      evidence: evidence(
        url,
        last,
        `could not fetch the protected resource metadata (well-known ${wellKnownTried(probe)}; ${challengeWord(probe)})`,
      ),
    };
  }
  return {
    status: "unknown",
    evidence: evidence(
      url,
      last,
      `no protected resource metadata at a well-known location (${wellKnownTried(probe)}) and none reached through the challenge (${challengeWord(probe)})`,
    ),
  };
}

/** Why no AS metadata could be judged. */
function asMissing(probe: Probe): CheckOutcome {
  if (probe.asOutcome === "no-issuer") {
    if (probe.prm) {
      return {
        status: "unknown",
        evidence: evidence(
          probe.prm.url,
          recordOf(probe, probe.prm.url),
          "no authorization server named in the protected resource metadata",
        ),
      };
    }
    return { ...prmMissing(probe), status: "unknown" };
  }
  const last = probe.asLast;
  const url = last?.url ?? probe.issuer ?? probe.target;
  if (probe.asOutcome === "error") {
    return {
      status: "unknown",
      evidence: evidence(url, last, "could not fetch the authorization server metadata"),
    };
  }
  return {
    status: "unknown",
    evidence: evidence(
      url,
      last,
      `no authorization server metadata at a well-known location (${asTried(probe)})`,
    ),
  };
}

function asTried(probe: Probe): string {
  return probe.requests
    .filter(
      (r) =>
        probe.issuer &&
        r.url.startsWith(new URL(probe.issuer).origin) &&
        r.url.includes("/.well-known/"),
    )
    .map((r) => httpWord(r))
    .join(", ");
}

type Prm = NonNullable<Probe["prm"]>;
type As = NonNullable<Probe["as"]>;
type Ch = NonNullable<Probe["challenge"]>;

/** A strategy over the protected resource metadata; passes when none was found. */
function fromPrm(
  id: string,
  title: string,
  judge: (prm: Prm, rec: RequestRecord | undefined, probe: Probe) => CheckOutcome | undefined,
): Strategy {
  return strategy(id, title, (probe) =>
    probe.prm ? judge(probe.prm, recordOf(probe, probe.prm.url), probe) : undefined,
  );
}

/** A strategy over the authorization server metadata; passes when none was found. */
function fromAs(
  id: string,
  title: string,
  judge: (as: As, rec: RequestRecord | undefined, probe: Probe) => CheckOutcome | undefined,
): Strategy {
  return strategy(id, title, (probe) =>
    probe.as ? judge(probe.as, recordOf(probe, probe.as.url), probe) : undefined,
  );
}

/** A strategy over a 401 challenge; passes when the endpoint gave none. */
function fromChallenge(
  id: string,
  title: string,
  judge: (c: Ch, rec: RequestRecord | undefined, probe: Probe) => CheckOutcome | undefined,
): Strategy {
  return strategy(id, title, (probe) =>
    probe.challenge && probe.challengeOutcome === "found"
      ? judge(probe.challenge, probe.challengeLast, probe)
      : undefined,
  );
}

/** The fallback when no strategy could read a PRM-based requirement. */
const PRM_UNKNOWN = strategy("prm.missing", "no protected resource metadata was found", prmMissing);
/** The fallback when no strategy could read an AS-based requirement. */
const AS_UNKNOWN = strategy("as.missing", "no authorization server metadata was found", asMissing);

/** The fallback for a requirement read from the endpoint's challenge. */
const CHALLENGE_UNKNOWN = strategy(
  "challenge.missing",
  "the endpoint gave no 401 challenge to any step of the ladder",
  (probe) => {
    const rec = probe.challengeLast;
    const url = rec?.url ?? probe.target;
    if (probe.challengeOutcome === "error") {
      return {
        status: "unknown",
        evidence: evidence(url, rec, `could not reach the endpoint (${endpointTried(probe)})`),
      };
    }
    return {
      status: "unknown",
      evidence: evidence(
        url,
        rec,
        `no 401 challenge to an unauthenticated request (${endpointTried(probe)}), nothing to judge`,
      ),
    };
  },
);

/** A simple `supported` / `unsupported` on a field of a document. */
function fieldOutcome(
  url: string,
  rec: RequestRecord | undefined,
  ok: boolean,
  yes: string,
  no: string,
): CheckOutcome {
  return ok
    ? { status: "supported", evidence: evidence(url, rec, yes) }
    : { status: "unsupported", evidence: evidence(url, rec, no) };
}

/**
 * The strategies of every passive check, in the order they are tried. The decision table in
 * specs/004-scanner/data-model.md is the prose form of this table.
 */
export const CHECK_STRATEGIES: Record<string, readonly Strategy[]> = {
  // judged from the well-known locations alone: a document reached through the challenge's
  // pointer does not count here (008 FR-004)
  "mcp.prm.well-known": [
    strategy(
      "prm.well-known",
      "the protected resource metadata at the path-aware or root well-known location",
      (probe) => {
        if (probe.prm && probe.prm.location !== "challenge") {
          return {
            status: "supported",
            evidence: evidence(
              probe.prm.url,
              recordOf(probe, probe.prm.url),
              `found at the ${probe.prm.location} location`,
            ),
          };
        }
        const last = probe.wellKnownLast;
        const url = last?.url ?? probe.target;
        if (probe.wellKnownOutcome === "absent") {
          const tried = probe.requests
            .filter((r) => r.url.includes("/.well-known/oauth-protected-resource"))
            .map(
              (r) =>
                `${r.url.endsWith("/oauth-protected-resource") ? "root" : "path-aware"} ${httpWord(r)}`,
            )
            .join(", ");
          return {
            status: "unsupported",
            evidence: evidence(url, last, `not at either well-known location (${tried})`),
          };
        }
        return {
          status: "unknown",
          evidence: evidence(
            url,
            last,
            "could not fetch the well-known protected resource metadata",
          ),
        };
      },
    ),
  ],

  // the endpoint's answer to the unauthenticated ladder (008 FR-002, 010); headers only
  "mcp.prm.www-authenticate": [
    fromChallenge(
      "challenge.resource-metadata",
      "the resource_metadata parameter of the 401 challenge",
      (c, rec) =>
        c.resourceMetadata
          ? {
              status: "supported",
              evidence: evidence(
                c.url,
                rec,
                `WWW-Authenticate resource_metadata: ${c.resourceMetadata}`,
              ),
            }
          : {
              status: "unsupported",
              evidence: evidence(
                c.url,
                rec,
                `WWW-Authenticate: ${c.header ?? "absent"}, no resource_metadata parameter`,
              ),
            },
    ),
    CHALLENGE_UNKNOWN,
  ],

  // the scope parameter of the same challenge (010): nothing more is sent
  "mcp.rs.scope-challenge": [
    fromChallenge("challenge.scope", "the scope parameter of the 401 challenge", (c, rec) =>
      c.scope && c.scope.length > 0
        ? {
            status: "supported",
            evidence: evidence(c.url, rec, `WWW-Authenticate scope: ${show(c.scope)}`),
          }
        : {
            status: "unsupported",
            evidence: evidence(
              c.url,
              rec,
              `WWW-Authenticate: ${c.header ?? "absent"}, no scope parameter`,
            ),
          },
    ),
    CHALLENGE_UNKNOWN,
  ],

  "mcp.prm": [
    strategy(
      "prm.invalid",
      "the required resource identifier matches the discovery route",
      (probe) =>
        !probe.prm && probe.prmInvalid
          ? {
              status: probe.prmOutcome === "error" ? "unknown" : "unsupported",
              evidence: evidence(
                probe.prmInvalid.url,
                probe.prmInvalid,
                probe.prmInvalid.detail ?? "invalid resource",
              ),
            }
          : undefined,
    ),
    fromPrm(
      "prm.document",
      "a protected resource metadata document, by either route",
      (prm, rec) => ({
        status: "supported",
        evidence: evidence(prm.url, rec, `resource: ${show(prm.resource)}`),
      }),
    ),
    PRM_UNKNOWN,
  ],

  "mcp.prm.authorization-servers": [
    fromPrm("prm.authorization-servers", "authorization_servers in the document", (prm, rec) =>
      fieldOutcome(
        prm.url,
        rec,
        prm.authorizationServers.length > 0,
        `authorization_servers: ${show(prm.authorizationServers)}`,
        `authorization_servers: ${show(prm.doc.authorization_servers)}`,
      ),
    ),
    PRM_UNKNOWN,
  ],

  "mcp.prm.scopes-supported": [
    fromPrm("prm.scopes", "scopes_supported in the document", (prm, rec) =>
      fieldOutcome(
        prm.url,
        rec,
        (prm.scopesSupported?.length ?? 0) > 0,
        `scopes_supported: ${show(prm.scopesSupported)}`,
        `scopes_supported: ${show(prm.doc.scopes_supported)}`,
      ),
    ),
    PRM_UNKNOWN,
  ],

  // Only resource-specific metadata and challenges describe this resource's scopes.
  // RFC 8414 permits the AS to omit supported scopes; its list cannot prove their absence.
  "mcp.prm.no-offline-access": [
    fromPrm(
      "prm.scopes",
      "scopes_supported in the protected resource metadata",
      (prm, rec) =>
        prm.scopesSupported
          ? fieldOutcome(
              prm.url,
              rec,
              !prm.scopesSupported.includes("offline_access"),
              `scopes_supported without offline_access: ${show(prm.scopesSupported)}`,
              `scopes_supported includes offline_access: ${show(prm.scopesSupported)}`,
            )
          : undefined, // the document is silent on scopes: the next source may speak
    ),
    fromChallenge(
      "challenge.scope",
      "the scope parameter of the 401 challenge, when the metadata names no scopes",
      (c, rec) =>
        c.scope && c.scope.length > 0
          ? fieldOutcome(
              c.url,
              rec,
              !c.scope.includes("offline_access"),
              `WWW-Authenticate scope without offline_access: ${show(c.scope)}`,
              `WWW-Authenticate scope includes offline_access: ${show(c.scope)}`,
            )
          : undefined,
    ),
    fromPrm("prm.silent", "nothing advertised anywhere", (prm, rec, probe) => ({
      status: "unknown",
      evidence: evidence(
        prm.url,
        rec,
        probe.as?.scopesSupported?.includes("offline_access")
          ? "scopes_supported: absent; the authorization server offers offline_access, and whether this server requests it is not advertised"
          : "scopes_supported: absent, so no scope is advertised to judge",
      ),
    })),
    PRM_UNKNOWN,
  ],

  "mcp.as.metadata": [
    strategy(
      "as.well-known",
      "the authorization server metadata at one of the three well-known locations",
      (probe) => {
        if (probe.as) {
          return {
            status: "supported",
            evidence: evidence(
              probe.as.url,
              recordOf(probe, probe.as.url),
              `issuer: ${show(probe.as.doc.issuer)}`,
            ),
          };
        }
        if (probe.asOutcome === "absent") {
          return {
            status: "unsupported",
            evidence: evidence(
              probe.asLast?.url ?? probe.issuer ?? probe.target,
              probe.asLast,
              `not at any of the three well-known locations (${asTried(probe)})`,
            ),
          };
        }
        return undefined;
      },
    ),
    AS_UNKNOWN,
  ],

  "mcp.as.issuer-match": [
    fromAs("as.issuer", "the issuer field against the issuer the PRM named", (as, rec) =>
      fieldOutcome(
        as.url,
        rec,
        typeof as.doc.issuer === "string" && sameIssuer(as.doc.issuer, as.issuer),
        `issuer: ${as.doc.issuer} equals the issuer the PRM named`,
        `issuer: ${show(as.doc.issuer)}, PRM named ${as.issuer}`,
      ),
    ),
    AS_UNKNOWN,
  ],

  "mcp.as.https": [
    fromAs("as.endpoints", "every endpoint URL in the metadata", (as, rec) => {
      const entries = Object.entries(as.endpoints);
      const plain = entries
        .filter(([, v]) => !v.startsWith("https://"))
        .map(([k, v]) => `${k}: ${v}`);
      if (entries.length === 0)
        return {
          status: "unknown",
          evidence: evidence(as.url, rec, "no endpoint fields in the metadata"),
        };
      if (plain.length === 0)
        return {
          status: "supported",
          evidence: evidence(as.url, rec, `all ${entries.length} endpoints use https`),
        };
      if (plain.length === entries.length)
        return {
          status: "unsupported",
          evidence: evidence(as.url, rec, `no endpoint uses https: ${plain.join(", ")}`),
        };
      return {
        status: "partial",
        evidence: evidence(
          as.url,
          rec,
          `${plain.length} of ${entries.length} endpoints not https: ${plain.join(", ")}`,
        ),
      };
    }),
    AS_UNKNOWN,
  ],

  "mcp.as.pkce-s256": [
    fromAs("as.pkce", "code_challenge_methods_supported in the metadata", (as, rec) =>
      fieldOutcome(
        as.url,
        rec,
        as.codeChallengeMethodsSupported?.includes("S256") ?? false,
        `code_challenge_methods_supported: ${show(as.codeChallengeMethodsSupported)}`,
        `code_challenge_methods_supported: ${show(as.doc.code_challenge_methods_supported)}`,
      ),
    ),
    AS_UNKNOWN,
  ],

  "mcp.as.cimd": [
    fromAs("as.cimd", "client_id_metadata_document_supported in the metadata", (as, rec) =>
      fieldOutcome(
        as.url,
        rec,
        as.clientIdMetadataDocumentSupported === true,
        "client_id_metadata_document_supported: true",
        `client_id_metadata_document_supported: ${show(as.clientIdMetadataDocumentSupported)}`,
      ),
    ),
    AS_UNKNOWN,
  ],

  "mcp.as.dcr": [
    fromAs("as.registration", "registration_endpoint in the metadata", (as, rec) =>
      fieldOutcome(
        as.url,
        rec,
        as.registrationEndpoint !== undefined,
        `registration_endpoint: ${as.registrationEndpoint}`,
        `registration_endpoint: ${show(as.doc.registration_endpoint)}`,
      ),
    ),
    AS_UNKNOWN,
  ],

  "mcp.as.iss-param": [
    fromAs("as.iss", "authorization_response_iss_parameter_supported in the metadata", (as, rec) =>
      fieldOutcome(
        as.url,
        rec,
        as.authorizationResponseIssParameterSupported === true,
        "authorization_response_iss_parameter_supported: true",
        `authorization_response_iss_parameter_supported: ${show(as.authorizationResponseIssParameterSupported)}`,
      ),
    ),
    AS_UNKNOWN,
  ],
};

/** The checks, composed from their strategies. */
export const PASSIVE_CHECKS: Record<string, Check> = Object.fromEntries(
  Object.entries(CHECK_STRATEGIES).map(([id, strategies]) => [id, firstOf(strategies)]),
);

export interface CheckRun {
  feature: Feature;
  outcome: CheckOutcome;
}

/** Runs the check for every given feature; throws when a passive feature has no check (research R5). */
export function runChecks(probe: Probe, features: Feature[]): CheckRun[] {
  return features.map((feature) => {
    const check = PASSIVE_CHECKS[feature.id];
    if (!check) {
      throw new Error(
        `feature "${feature.id}" is observable: passive but the scanner has no check for it; add one to src/scanner/checks.ts or mark the feature manual`,
      );
    }
    return { feature, outcome: check(probe) };
  });
}

export type { Check, CheckOutcome } from "./strategies";
