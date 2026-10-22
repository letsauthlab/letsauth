import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { currentRevision } from "@/lib/atlas";
import { getDataset } from "@/lib/data";
import { type CheckOutcome, PASSIVE_CHECKS, runChecks } from "@/scanner/checks";
import { type Fixture, recordingFetcher } from "@/scanner/fetch";
import { type Guard, guardUrl } from "@/scanner/guard";
import { probe } from "@/scanner/probe";
import { passiveFeatures, scan } from "@/scanner/report";
import { OBSERVER } from "@/scanner/version";

const data = getDataset();
const revision = currentRevision(data).id;
const features = passiveFeatures(data, revision);

function fixture(name: string): Fixture {
  return JSON.parse(
    readFileSync(resolve(__dirname, `../fixtures/scanner/${name}.json`), "utf8"),
  ) as Fixture;
}

async function statuses(name: string, guard?: Guard) {
  const f = fixture(name);
  const fetcher = recordingFetcher(f);
  const p = await probe(f.target, { fetcher, guard });
  const out: Record<string, CheckOutcome> = {};
  for (const run of runChecks(p, features)) out[run.feature.id] = run.outcome;
  return { probe: p, requests: fetcher.requests, out };
}

const ENDPOINT = "https://mcp.example.com/mcp";
const POST_ENDPOINT = `POST ${ENDPOINT}`;
const PRM_PATH = "https://mcp.example.com/.well-known/oauth-protected-resource/mcp";
const PRM_ROOT = "https://mcp.example.com/.well-known/oauth-protected-resource";
const POINTER = "https://mcp.example.com/oauth/prm.json";
const AS_RFC = "https://auth.example.com/.well-known/oauth-authorization-server";
const AS_OIDC = "https://auth.example.com/.well-known/openid-configuration";

describe("the passive features of the current revision", () => {
  it("are the fourteen the decision table covers, server party first", () => {
    expect(features.map((f) => f.id)).toEqual([
      "mcp.prm",
      "mcp.prm.authorization-servers",
      "mcp.prm.scopes-supported",
      "mcp.prm.well-known",
      "mcp.prm.www-authenticate",
      "mcp.rs.scope-challenge",
      "mcp.prm.no-offline-access",
      "mcp.as.issuer-match",
      "mcp.as.metadata",
      "mcp.as.cimd",
      "mcp.as.dcr",
      "mcp.as.iss-param",
      "mcp.as.pkce-s256",
      "mcp.as.https",
    ]);
    for (const f of features) expect(PASSIVE_CHECKS[f.id], f.id).toBeDefined();
  });

  it("throws on a passive feature without a check (research R5)", async () => {
    const f = fixture("complete");
    const p = await probe(f.target, { fetcher: recordingFetcher(f) });
    const ghost = { ...features[0], id: "mcp.prm.ghost" } as (typeof features)[number];
    expect(() => runChecks(p, [ghost])).toThrow(/mcp\.prm\.ghost/);
  });
});

describe("decision table over recorded responses (FR-001, FR-003, SC-002)", () => {
  it("complete: every check supported except DCR, with the second issuer not checked", async () => {
    const { probe: p, requests, out } = await statuses("complete");
    expect(requests).toEqual([PRM_PATH, ENDPOINT, AS_RFC]);
    for (const [id, o] of Object.entries(out)) {
      expect(o.status, id).toBe(id === "mcp.as.dcr" ? "unsupported" : "supported");
      expect(o.evidence, id).toMatch(/^https:\/\//);
      expect(o.evidence, id).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    }
    expect(p.othersNotChecked).toEqual(["https://auth2.example.com"]);
    expect(out["mcp.prm.well-known"]?.evidence).toContain("path-aware");
    expect(out["mcp.prm.www-authenticate"]?.evidence).toBe(
      `${ENDPOINT} — HTTP 401; WWW-Authenticate resource_metadata: ${PRM_PATH}`,
    );
    expect(out["mcp.as.pkce-s256"]?.evidence).toContain("S256");
    expect(out["mcp.rs.scope-challenge"]?.evidence).toContain("scope: [read, write]");
    for (const o of Object.values(out)) expect(o.via).toBeDefined();
    // the endpoint was asked once (the GET answered 401, so the ladder stopped), and nothing of
    // its body was read (008 FR-001, SC-003)
    expect(requests.filter((u) => u.includes(ENDPOINT))).toHaveLength(1);
    const endpoint = p.requests.find((r) => r.url === ENDPOINT);
    expect(endpoint).toMatchObject({ status: 401, ok: false });
    expect(p.prm?.location).toBe("path-aware");
  });

  it("root-prm: finds the PRM at the root and the AS at the path-appended OIDC location", async () => {
    const { requests, out } = await statuses("root-prm");
    expect(requests).toEqual([
      PRM_PATH,
      PRM_ROOT,
      ENDPOINT,
      POST_ENDPOINT,
      "https://auth.example.com/.well-known/oauth-authorization-server/tenant",
      "https://auth.example.com/.well-known/openid-configuration/tenant",
      "https://auth.example.com/tenant/.well-known/openid-configuration",
    ]);
    expect(out["mcp.prm.well-known"]?.status).toBe("supported");
    expect(out["mcp.prm.well-known"]?.evidence).toContain("root location");
    expect(out["mcp.as.metadata"]?.status).toBe("supported");
    expect(out["mcp.as.issuer-match"]?.status).toBe("supported");
  });

  it("no-prm: well-known unsupported, everything else unknown (the endpoint answered 404 to both steps)", async () => {
    const { requests, out } = await statuses("no-prm");
    expect(requests).toEqual([PRM_PATH, PRM_ROOT, ENDPOINT, POST_ENDPOINT]);
    expect(out["mcp.prm.well-known"]?.status).toBe("unsupported");
    expect(out["mcp.prm.well-known"]?.evidence).toContain("HTTP 404");
    for (const id of Object.keys(out).filter((k) => k !== "mcp.prm.well-known")) {
      expect(out[id]?.status, id).toBe("unknown");
    }
    expect(out["mcp.prm.www-authenticate"]?.evidence).toBe(
      `${ENDPOINT} — HTTP 404; no 401 challenge to an unauthenticated request (GET HTTP 404, POST HTTP 404), nothing to judge`,
    );
    expect(out["mcp.rs.scope-challenge"]?.status).toBe("unknown");
    expect(out["mcp.prm"]?.evidence).toContain("none reached through the challenge");
  });

  it.each(["prm-5xx", "prm-timeout", "redirect-cross-host"])(
    "%s: every check unknown, never unsupported",
    async (name) => {
      const { out } = await statuses(name);
      for (const [id, o] of Object.entries(out)) expect(o.status, id).toBe("unknown");
    },
  );

  it("redirect-cross-host: the evidence names the redirect", async () => {
    const { out } = await statuses("redirect-cross-host");
    expect(out["mcp.prm.well-known"]?.evidence).toMatch(/redirect/);
    expect(out["mcp.prm.well-known"]?.evidence).toContain("elsewhere.example.net");
  });

  it("not-json: a 200 that is not JSON counts as absent at that location", async () => {
    const { out } = await statuses("not-json");
    expect(out["mcp.prm.well-known"]?.status).toBe("unsupported");
    expect(out["mcp.prm.well-known"]?.evidence).toContain("not JSON");
    expect(out["mcp.prm"]?.status).toBe("unknown");
  });

  it("no-as: PRM checks judged, AS metadata unsupported, the other AS checks unknown", async () => {
    const { requests, out } = await statuses("no-as");
    expect(requests).toEqual([PRM_PATH, ENDPOINT, POST_ENDPOINT, AS_RFC, AS_OIDC]);
    expect(out["mcp.prm"]?.status).toBe("supported");
    expect(out["mcp.as.metadata"]?.status).toBe("unsupported");
    for (const id of [
      "mcp.as.issuer-match",
      "mcp.as.https",
      "mcp.as.pkce-s256",
      "mcp.as.cimd",
      "mcp.as.dcr",
      "mcp.as.iss-param",
    ]) {
      expect(out[id]?.status, id).toBe("unknown");
    }
  });

  it("as-timeout: AS metadata unknown with the failure named", async () => {
    const { out } = await statuses("as-timeout");
    expect(out["mcp.as.metadata"]?.status).toBe("unknown");
    expect(out["mcp.as.metadata"]?.evidence).toMatch(/timeout|connection/);
    expect(out["mcp.as.pkce-s256"]?.status).toBe("unknown");
  });

  it("empty-servers: authorization_servers unsupported and no issuer to check", async () => {
    const { requests, out } = await statuses("empty-servers");
    expect(requests).toEqual([PRM_PATH, ENDPOINT, POST_ENDPOINT]);
    expect(out["mcp.prm.authorization-servers"]?.status).toBe("unsupported");
    expect(out["mcp.as.metadata"]?.status).toBe("unknown");
    expect(out["mcp.as.metadata"]?.evidence).toContain("no authorization server named");
  });

  it("offline-access: advertising offline_access fails the SHOULD", async () => {
    const { out } = await statuses("offline-access");
    expect(out["mcp.prm.no-offline-access"]?.status).toBe("unsupported");
    expect(out["mcp.prm.no-offline-access"]?.evidence).toContain("offline_access");
  });

  it("no-scopes: nothing advertised anywhere, so the offline_access check is unknown and scopes unsupported", async () => {
    const { out } = await statuses("no-scopes");
    expect(out["mcp.prm.no-offline-access"]?.status).toBe("unknown");
    expect(out["mcp.prm.no-offline-access"]?.via).toBe("prm.silent");
    expect(out["mcp.prm.scopes-supported"]?.status).toBe("unsupported");
  });

  it.each(["no-s256", "no-methods"])("%s: PKCE S256 unsupported", async (name) => {
    const { out } = await statuses(name);
    expect(out["mcp.as.pkce-s256"]?.status).toBe("unsupported");
  });

  it("http-endpoint: partial on the HTTPS check, naming the endpoint", async () => {
    const { out } = await statuses("http-endpoint");
    expect(out["mcp.as.https"]?.status).toBe("partial");
    expect(out["mcp.as.https"]?.evidence).toContain(
      "token_endpoint: http://auth.example.com/token",
    );
  });

  it("issuer-mismatch: unsupported, naming both values", async () => {
    const { out } = await statuses("issuer-mismatch");
    expect(out["mcp.as.issuer-match"]?.status).toBe("unsupported");
    expect(out["mcp.as.issuer-match"]?.evidence).toContain("https://other.example.com");
    expect(out["mcp.as.issuer-match"]?.evidence).toContain("https://auth.example.com");
  });

  it("dcr: registration endpoint supported, CIMD and iss parameter unsupported as absent", async () => {
    const { out } = await statuses("dcr");
    expect(out["mcp.as.dcr"]?.status).toBe("supported");
    expect(out["mcp.as.cimd"]?.status).toBe("unsupported");
    expect(out["mcp.as.cimd"]?.evidence).toContain("absent");
    expect(out["mcp.as.iss-param"]?.status).toBe("unsupported");
  });

  it("evidence never exceeds 300 characters", async () => {
    for (const name of [
      "complete",
      "no-prm",
      "redirect-cross-host",
      "http-endpoint",
      "challenge-pointer",
      "challenge-neither",
      "challenge-pointer-private",
      "challenge-post",
      "stale-sse",
      "redirect-landing",
    ]) {
      const { out } = await statuses(name);
      for (const o of Object.values(out)) expect(o.evidence.length).toBeLessThanOrEqual(300);
    }
  });
});

describe("the discovery challenge (008 FR-002, FR-003, FR-004)", () => {
  const PRM_IDS = ["mcp.prm", "mcp.prm.authorization-servers", "mcp.prm.scopes-supported"];

  it("challenge-pointer: no well-known document, the pointer is followed and judged", async () => {
    const { probe: p, requests, out } = await statuses("challenge-pointer");
    expect(requests).toEqual([PRM_PATH, PRM_ROOT, ENDPOINT, POINTER, AS_RFC]);
    expect(out["mcp.prm.well-known"]?.status).toBe("unsupported");
    expect(out["mcp.prm.www-authenticate"]?.status).toBe("supported");
    expect(out["mcp.prm.www-authenticate"]?.evidence).toBe(
      `${ENDPOINT} — HTTP 401; WWW-Authenticate resource_metadata: ${POINTER}`,
    );
    for (const id of PRM_IDS) {
      expect(out[id]?.status, id).toBe("supported");
      expect(out[id]?.evidence, id).toMatch(new RegExp(`^${POINTER} — HTTP 200;`));
    }
    expect(out["mcp.as.metadata"]?.status).toBe("supported");
    expect(p.prm?.location).toBe("challenge");
    expect(p.pointerOutcome).toBe("found");
  });

  it("challenge-pointer: the summary counts discovery as met", async () => {
    const f = fixture("challenge-pointer");
    const report = await scan({ url: f.target }, data, { fetcher: recordingFetcher(f) });
    // the discovery MUST is met through the challenge; nothing at MUST level is left open
    expect(report.summary.open.filter((c) => c.level === "MUST")).toEqual([]);
    expect(report.discovered?.protectedResource?.location).toBe("challenge");
    expect(report.discovered?.challenge).toEqual({
      url: ENDPOINT,
      status: 401,
      method: "GET",
      step: "get",
      header: `Bearer realm="mcp", resource_metadata="${POINTER}"`,
      resourceMetadata: POINTER,
      scope: null,
    });
    expect(report.discovered?.endpointNote).toBeNull();
  });

  it("challenge-no-pointer: a 401 without the parameter is unsupported, quoting the header", async () => {
    const { requests, out } = await statuses("challenge-no-pointer");
    expect(requests).toEqual([PRM_PATH, ENDPOINT, AS_RFC]);
    expect(out["mcp.prm.well-known"]?.status).toBe("supported");
    expect(out["mcp.prm.www-authenticate"]?.status).toBe("unsupported");
    expect(out["mcp.prm.www-authenticate"]?.evidence).toBe(
      `${ENDPOINT} — HTTP 401; WWW-Authenticate: Bearer realm="mcp", no resource_metadata parameter`,
    );
  });

  it("challenge-no-pointer: the summary counts discovery as met, because the well-known way is", async () => {
    const f = fixture("challenge-no-pointer");
    const report = await scan({ url: f.target }, data, { fetcher: recordingFetcher(f) });
    expect(report.summary.open.map((c) => c.feature)).not.toContain("mcp.prm.www-authenticate");
    expect(report.summary.notes.join(" ")).toContain("counts as supported");
  });

  it("challenge-neither: both discovery cells unsupported, the summary naming both", async () => {
    const f = fixture("challenge-neither");
    const { out } = await statuses("challenge-neither");
    expect(out["mcp.prm.well-known"]?.status).toBe("unsupported");
    expect(out["mcp.prm.www-authenticate"]?.status).toBe("unsupported");
    expect(out["mcp.prm"]?.status).toBe("unknown");
    expect(out["mcp.prm"]?.evidence).toContain("challenge without resource_metadata");
    const report = await scan({ url: f.target }, data, { fetcher: recordingFetcher(f) });
    expect(
      report.summary.open
        .filter((c) => c.level === "MUST" && c.status === "unsupported")
        .map((c) => c.feature),
    ).toEqual(expect.arrayContaining(["mcp.prm.well-known", "mcp.prm.www-authenticate"]));
  });

  it("challenge-no-header: a 401 without any WWW-Authenticate header is unsupported", async () => {
    const { out } = await statuses("challenge-no-header");
    expect(out["mcp.prm.www-authenticate"]?.status).toBe("unsupported");
    expect(out["mcp.prm.www-authenticate"]?.evidence).toContain("WWW-Authenticate: absent");
  });

  it("challenge-405: a 405 to both steps is unknown with both named, nothing else moves", async () => {
    const { requests, out } = await statuses("challenge-405");
    expect(requests).toEqual([PRM_PATH, ENDPOINT, POST_ENDPOINT, AS_RFC]);
    expect(out["mcp.prm.www-authenticate"]?.status).toBe("unknown");
    expect(out["mcp.prm.www-authenticate"]?.evidence).toContain("GET HTTP 405, POST HTTP 405");
    expect(out["mcp.prm.well-known"]?.status).toBe("supported");
    expect(out["mcp.as.metadata"]?.status).toBe("supported");
  });

  it("challenge-timeout: an unreachable endpoint is unknown with the failure named", async () => {
    const { out } = await statuses("challenge-timeout");
    expect(out["mcp.prm.www-authenticate"]?.status).toBe("unknown");
    expect(out["mcp.prm.www-authenticate"]?.evidence).toContain("timeout");
    expect(out["mcp.prm"]?.status).toBe("unknown");
  });

  it("challenge-pointer-private: a pointer the guard refuses is not fetched", async () => {
    const guard: Guard = async (url) =>
      url.startsWith("https://10.")
        ? { ok: false, reason: "IP addresses are not scanned; use a host name" }
        : { ok: true, url };
    const { requests, out } = await statuses("challenge-pointer-private", guard);
    expect(requests).toEqual([PRM_PATH, PRM_ROOT, ENDPOINT]);
    expect(out["mcp.prm.www-authenticate"]?.status).toBe("supported");
    for (const id of PRM_IDS) {
      expect(out[id]?.status, id).toBe("unknown");
      expect(out[id]?.evidence, id).toContain("refused (IP addresses are not scanned");
    }
  });

  it("challenge-pointer-5xx: a pointer that errors leaves the metadata unknown, never unsupported", async () => {
    const { requests, out } = await statuses("challenge-pointer-5xx");
    expect(requests).toEqual([PRM_PATH, PRM_ROOT, ENDPOINT, POINTER]);
    expect(out["mcp.prm.www-authenticate"]?.status).toBe("supported");
    expect(out["mcp.prm.well-known"]?.status).toBe("unsupported");
    for (const id of PRM_IDS) expect(out[id]?.status, id).toBe("unknown");
    expect(out["mcp.prm"]?.evidence).toContain("HTTP 503");
  });

  it("challenge-pointer-http: a plain-http pointer is refused by the guard, not fetched", async () => {
    const { requests, out } = await statuses("challenge-pointer-http", guardUrl);
    expect(requests).toEqual([PRM_PATH, PRM_ROOT, ENDPOINT]);
    expect(out["mcp.prm"]?.evidence).toContain("only https: URLs are scanned");
  });
});

describe("composable discovery strategies (010)", () => {
  it("challenge-post: a GET answered 405 is followed by one empty POST, whose 401 is judged", async () => {
    const { probe: p, requests, out } = await statuses("challenge-post");
    expect(requests).toEqual([PRM_PATH, PRM_ROOT, ENDPOINT, POST_ENDPOINT, POINTER, AS_RFC]);
    expect(p.challenge).toMatchObject({ method: "POST", step: "post-empty", status: 401 });
    expect(p.endpointRequests.map((r) => r.method ?? "GET")).toEqual(["GET", "POST"]);
    expect(out["mcp.prm.www-authenticate"]?.status).toBe("supported");
    expect(out["mcp.prm.www-authenticate"]?.via).toBe("challenge.resource-metadata");
    expect(out["mcp.rs.scope-challenge"]?.status).toBe("supported");
    expect(out["mcp.rs.scope-challenge"]?.evidence).toContain("scope: [read]");
    expect(out["mcp.prm"]?.status).toBe("supported");
    expect(p.prm?.location).toBe("challenge");
    expect(p.endpointNote).toBeUndefined();
  });

  it("the ladder stops after a failure to connect: no POST after a timeout", async () => {
    const { requests } = await statuses("challenge-timeout");
    expect(requests.filter((u) => u.includes(ENDPOINT))).toEqual([ENDPOINT]);
  });

  it("stale-sse: an endpoint gone on both steps leaves the challenge unknown and notes the stale URL", async () => {
    const SSE = "https://mcp.example.com/sse";
    const { probe: p, requests, out } = await statuses("stale-sse");
    expect(requests).toEqual([
      "https://mcp.example.com/.well-known/oauth-protected-resource/sse",
      SSE,
      `POST ${SSE}`,
      AS_RFC,
    ]);
    expect(out["mcp.prm.www-authenticate"]?.status).toBe("unknown");
    expect(out["mcp.prm"]?.status).toBe("supported");
    expect(p.endpointNote).toContain("HTTP 410 and 410");
    expect(p.endpointNote).toContain("/mcp");
    const f = fixture("stale-sse");
    const report = await scan({ url: f.target }, data, { fetcher: recordingFetcher(f) });
    expect(report.discovered?.endpointNote).toBe(p.endpointNote);
  });

  it("redirect-landing: a GET redirected off the host is followed by a POST, whose bare 401 fails both discovery cells", async () => {
    const ROOT = "https://mcp.example.com";
    const { probe: p, requests, out } = await statuses("redirect-landing");
    expect(requests).toEqual([
      `${ROOT}/.well-known/oauth-protected-resource`,
      ROOT,
      `POST ${ROOT}`,
    ]);
    expect(out["mcp.prm.well-known"]?.status).toBe("unsupported");
    expect(out["mcp.prm.www-authenticate"]?.status).toBe("unsupported");
    expect(out["mcp.prm.www-authenticate"]?.evidence).toContain(
      "WWW-Authenticate: Bearer, no resource_metadata",
    );
    expect(out["mcp.rs.scope-challenge"]?.status).toBe("unsupported");
    expect(p.endpointNote).toBeUndefined();
  });

  it("as-scopes: an AS list cannot prove the resource does not request offline_access", async () => {
    const { out } = await statuses("as-scopes");
    expect(out["mcp.prm.no-offline-access"]?.status).toBe("unknown");
    expect(out["mcp.prm.no-offline-access"]?.via).toBe("prm.silent");
  });

  it("as-scopes-offline: an authorization server that offers offline_access leaves the server's choice unknown", async () => {
    const { out } = await statuses("as-scopes-offline");
    expect(out["mcp.prm.no-offline-access"]?.status).toBe("unknown");
    expect(out["mcp.prm.no-offline-access"]?.via).toBe("prm.silent");
    expect(out["mcp.prm.no-offline-access"]?.evidence).toContain("offers offline_access");
  });

  it("challenge-scope-offline: a challenge that asks for offline_access fails the SHOULD", async () => {
    const { out } = await statuses("challenge-scope-offline");
    expect(out["mcp.prm.no-offline-access"]?.status).toBe("unsupported");
    expect(out["mcp.prm.no-offline-access"]?.via).toBe("challenge.scope");
    expect(out["mcp.rs.scope-challenge"]?.status).toBe("supported");
  });

  it("the metadata's own scopes win over the challenge and the authorization server", async () => {
    const { out } = await statuses("offline-access");
    expect(out["mcp.prm.no-offline-access"]?.via).toBe("prm.scopes");
    const { out: ok } = await statuses("complete");
    expect(ok["mcp.prm.no-offline-access"]?.via).toBe("prm.scopes");
  });

  it("every check ends in a fallback that always decides", async () => {
    const { probe: p } = await statuses("prm-timeout");
    for (const [id, check] of Object.entries(PASSIVE_CHECKS)) {
      expect(() => check(p), id).not.toThrow();
    }
  });
});

describe("the auth suggestion (009 FR-006, SC-004)", () => {
  async function suggestion(name: string) {
    const f = fixture(name);
    const report = await scan({ url: f.target }, data, { fetcher: recordingFetcher(f) });
    return report.discovered?.authSuggestion;
  }

  it("is oauth when a metadata document or a challenge pointer was found", async () => {
    expect(await suggestion("complete")).toBe("oauth");
    expect(await suggestion("challenge-pointer")).toBe("oauth");
    expect(await suggestion("challenge-pointer-private")).toBe("oauth");
  });

  it("is none when a step of the ladder was accepted with 200", async () => {
    expect(await suggestion("challenge-open")).toBe("none");
  });

  it("is null for a bare 401, a 405 without metadata, or a failure", async () => {
    expect(await suggestion("challenge-neither")).toBeNull();
    expect(await suggestion("challenge-timeout")).toBeNull();
  });
});

describe("scan() shapes the report (contracts/report.md)", () => {
  it("fills checks, discovered, requests, summary and observations for a listed server", async () => {
    const f = fixture("complete");
    const report = await scan({ url: f.target, serverId: "example" }, data, {
      fetcher: recordingFetcher(f),
      now: "2026-10-15T03:17:04Z",
    });
    expect(report.version).toBe(2);
    expect(report.recorded).toBe(false);
    expect(report.target).toEqual({ url: f.target, server: "example" });
    expect(report.revision).toEqual({ spec: "mcp-authorization", revision });
    expect(report.checks.map((c) => c.feature)).toEqual(features.map((x) => x.id));
    expect(report.checks[0]?.citation).toMatch(/^https:\/\/modelcontextprotocol\.io/);
    expect(report.checks.every((c) => c.observedAt === "2026-10-15T03:17:04Z")).toBe(true);
    expect(report.discovered?.protectedResource?.authorizationServers).toEqual([
      "https://auth.example.com",
      "https://auth2.example.com",
    ]);
    expect(report.discovered?.authorizationServer?.codeChallengeMethodsSupported).toEqual(["S256"]);
    expect(report.summary.open.filter((c) => c.level === "MUST" || c.level === "SHOULD")).toEqual(
      [],
    );
    expect(report.observations).toHaveLength(features.length);
    expect(report.observations[0]).toMatchObject({
      server: "example",
      method: "passive-scan",
      observedBy: OBSERVER,
      observedAt: "2026-10-15T03:17:04Z",
      revision: { spec: "mcp-authorization", revision },
    });
  });

  it("produces no observations for a target that is not a listed server", async () => {
    const f = fixture("complete");
    const report = await scan({ url: f.target }, data, { fetcher: recordingFetcher(f) });
    expect(report.target.server).toBeNull();
    expect(report.observations).toEqual([]);
  });

  it("caches the authorization server across targets within a run", async () => {
    const f = fixture("complete");
    const fetcher = recordingFetcher(f);
    const asCache = new Map();
    await scan({ url: f.target }, data, { fetcher, asCache });
    await scan({ url: f.target }, data, { fetcher, asCache });
    expect(fetcher.requests.filter((u) => u === AS_RFC)).toHaveLength(1);
  });
});

describe("metadata binding regressions", () => {
  it.each([
    undefined,
    17,
    "https://other.example/mcp",
    "http://mcp.example.com/mcp",
    `${ENDPOINT}#fragment`,
  ])("rejects invalid PRM resource %j and never follows its issuer", async (resource) => {
    const f = fixture("complete");
    const document = f.responses[PRM_PATH]?.body as Record<string, unknown>;
    document.resource = resource;
    const fetcher = recordingFetcher(f);
    const p = await probe(f.target, { fetcher });
    const checks = runChecks(p, features);
    expect(checks.find((r) => r.feature.id === "mcp.prm")?.outcome.status).toBe("unsupported");
    expect(p.prm).toBeUndefined();
    expect(p.as).toBeUndefined();
    expect(fetcher.requests).not.toContain(AS_RFC);
    expect(p.prmInvalid?.detail).toContain("resource:");
  });
  it("falls back from an invalid path document to valid root-bound metadata", async () => {
    const f = fixture("root-prm");
    f.responses[PRM_PATH] = {
      body: {
        resource: "https://imposter.example",
        authorization_servers: ["https://evil.example"],
      },
    };
    const p = await probe(f.target, { fetcher: recordingFetcher(f) });
    expect(p.prm?.location).toBe("root");
    expect(p.issuer).toBe("https://auth.example.com/tenant");
  });
  it("rejects an endpoint resource identifier at the root discovery location", async () => {
    const f = fixture("root-prm");
    (f.responses[PRM_ROOT]?.body as Record<string, unknown>).resource = ENDPOINT;
    const p = await probe(f.target, { fetcher: recordingFetcher(f) });
    expect(p.prm).toBeUndefined();
    expect(p.prmInvalid?.detail).toContain("expected exactly https://mcp.example.com");
  });
  it("validates challenge metadata against the endpoint, even at a different metadata host", async () => {
    const f = fixture("challenge-pointer");
    (f.responses[POINTER]?.body as Record<string, unknown>).resource = "https://other.example/mcp";
    const p = await probe(f.target, { fetcher: recordingFetcher(f) });
    expect(p.prm).toBeUndefined();
    expect(p.as).toBeUndefined();
    expect(p.prmInvalid?.url).toBe(POINTER);
  });
  it("does not award issuer-match when only a trailing slash differs", async () => {
    const f = fixture("complete");
    (f.responses[AS_RFC]?.body as Record<string, unknown>).issuer = "https://auth.example.com/";
    const p = await probe(f.target, { fetcher: recordingFetcher(f) });
    expect(
      runChecks(p, features).find((r) => r.feature.id === "mcp.as.issuer-match")?.outcome.status,
    ).toBe("unsupported");
  });
});
