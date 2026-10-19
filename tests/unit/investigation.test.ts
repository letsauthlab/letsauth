import { describe, expect, it } from "vitest";
import { getDataset } from "../../src/lib/data";
import {
  challenge,
  configSchema,
  digest,
  endpoint,
  PROOF_PATH,
  PROTOCOL,
  type Proof,
  plan,
  redact,
  reportSchema,
} from "../../src/scanner/investigation/model";
import { observation } from "../../src/scanner/investigation/record";
import { run, verifyControl } from "../../src/scanner/investigation/run";
import {
  authSummary,
  object,
  publicAddress,
  type Request,
  type Response,
  sseResponse,
  type Transport,
} from "../../src/scanner/investigation/transport";

const data = getDataset();
const target = "https://lab.example.com/mcp";
const valid = "baseline-secret-token";
const other = "comparison-secret-token";
const env = { GOOD_TOKEN: valid, OTHER_TOKEN: other };
const baseConfig = {
  version: 1,
  recipe: "baseline",
  target,
  tokenEnv: "GOOD_TOKEN",
  context: "Controlled test account and read-only tool listing.",
  request: { method: "tools/list" },
};
const parsed = (overrides: Record<string, unknown> = {}) =>
  configSchema.parse({ ...baseConfig, ...overrides });

function fixture(proof: Proof, alter?: (r: Request) => Response | undefined) {
  const requests: Request[] = [];
  const send: Transport = async (r) => {
    requests.push(structuredClone(r));
    const changed = alter?.(r);
    if (changed) return changed;
    if (r.url === new URL(PROOF_PATH, proof.target).href) return { status: 200, json: proof };
    if (r.method === "DELETE") return { status: 204 };
    const body = object(r.body) ? r.body : {};
    if (body.method === "initialize")
      return {
        status: 200,
        session: `session-${requests.length}`,
        json: {
          jsonrpc: "2.0",
          id: 1,
          result: {
            protocolVersion: PROTOCOL,
            capabilities: {},
            serverInfo: { name: "fixture", version: "1" },
          },
        },
      };
    if (body.method === "notifications/initialized") return { status: 202 };
    return { status: 200, json: { jsonrpc: "2.0", id: 2, result: { tools: [] } } };
  };
  return { requests, send };
}

describe("investigation plans and strict contracts", () => {
  it("uses shared feature citations and includes manual/source procedures", () => {
    const p = plan(data, "figma");
    expect(p.server).toBe("figma");
    expect(p.recipes.find((r) => r.id === "audience")?.citations[0]?.feature).toBe(
      "mcp.rs.audience-validation",
    );
    expect(p.manual.some((m) => m.feature === "mcp.rs.no-passthrough")).toBe(true);
    expect(p.recipes.find((r) => r.id === "revocation")?.citations).toEqual([]);
    expect(() => plan(data, "figma", "made-up")).toThrow();
  });
  it.each([
    "http://example.com",
    "https://u:p@example.com/mcp",
    "https://example.com:8443/mcp",
    "https://example.com/mcp?token=secret",
    "https://example.com/#token",
  ])("refuses credential-bearing/non-HTTPS URL %s", (url) => expect(() => endpoint(url)).toThrow());
  it("rejects typos, raw tokens, incomplete recipes and missing operation arguments", () => {
    expect(() => parsed({ token: valid })).toThrow();
    expect(() => parsed({ recipe: "audience" })).toThrow();
    expect(() => parsed({ recipe: "revocation" })).toThrow();
    expect(() => parsed({ request: { method: "tools/call" } })).toThrow();
    expect(() => parsed({ request: { method: "resources/read" } })).toThrow();
  });
});

describe("owner control", () => {
  it("sends no credentials/protocol messages when control cannot be verified", async () => {
    const p = challenge(target);
    const f = fixture(p, () => ({ status: 200, json: { ...p, nonce: "a".repeat(64) } }));
    await expect(run(parsed(), p, data, f.send, env)).rejects.toThrow("owner control");
    expect(f.requests).toEqual([{ method: "GET", url: new URL(PROOF_PATH, target).href }]);
  });
  it("rejects expired, distant and different-endpoint proof before networking", async () => {
    const p = challenge(target);
    const f = fixture(p);
    for (const proof of [
      { ...p, expiresAt: new Date(Date.now() - 1).toISOString() },
      { ...p, expiresAt: new Date(Date.now() + 7_200_000).toISOString() },
      { ...p, target: `${target}/other` },
    ])
      await expect(verifyControl(proof, target, f.send)).rejects.toThrow();
    expect(f.requests).toHaveLength(0);
  });
  it("validates all token prerequisites before any network request", async () => {
    const p = challenge(target);
    const f = fixture(p);
    await expect(run(parsed(), p, data, f.send, {})).rejects.toThrow("environment variable");
    await expect(
      run(parsed({ recipe: "scope", comparisonTokenEnv: "OTHER_TOKEN" }), p, data, f.send, {
        ...env,
        OTHER_TOKEN: valid,
      }),
    ).rejects.toThrow("must differ");
    expect(f.requests).toHaveLength(0);
  });
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "::1",
    "::ffff:127.0.0.1",
    "64:ff9b::7f00:1",
    "2002:7f00:1::",
    "2001:db8::1",
    "fc00::1",
  ])("refuses non-public/transitional address %s", (ip) => expect(publicAddress(ip)).toBe(false));
  it("accepts ordinary global addresses", () => {
    expect(publicAddress("8.8.8.8")).toBe(true);
    expect(publicAddress("2606:4700:4700::1111")).toBe(true);
  });
});

describe("MCP measurements", () => {
  it("initializes, sends the configured operation and cleans up each session independently", async () => {
    const p = challenge(target);
    const f = fixture(p);
    const report = await run(
      parsed({
        recipe: "audience",
        comparisonTokenEnv: "OTHER_TOKEN",
        context: `Different audience, baseline ${valid}, comparison ${other}`,
      }),
      p,
      data,
      f.send,
      env,
    );
    expect(report.conclusion).toBe("review-required");
    expect(report.samples.filter((s) => s.stage === "operation").map((s) => s.outcome)).toEqual([
      "accepted",
      "accepted",
    ]);
    const inits = f.requests.filter((r) => object(r.body) && r.body.method === "initialize");
    expect(inits).toHaveLength(2);
    expect(inits.every((r) => !r.headers?.["MCP-Session-Id"])).toBe(true);
    const operations = f.requests.filter((r) => object(r.body) && r.body.method === "tools/list");
    expect(operations[0]?.headers?.["MCP-Session-Id"]).not.toBe(
      operations[1]?.headers?.["MCP-Session-Id"],
    );
    expect(operations.every((r) => r.headers?.["MCP-Protocol-Version"] === PROTOCOL)).toBe(true);
    expect(JSON.stringify(report)).not.toContain(valid);
    expect(JSON.stringify(report)).not.toContain(other);
    expect(JSON.stringify(report)).not.toContain("session-");
  });
  it("does not run negative cases when the baseline fails", async () => {
    const p = challenge(target);
    const f = fixture(p, (r) => (r.method === "POST" ? { status: 401 } : undefined));
    const report = await run(parsed({ recipe: "invalid-token" }), p, data, f.send, env);
    expect(report.conclusion).toBe("inconclusive");
    expect(f.requests).toHaveLength(2);
  });
  it("records missing and random invalid token denials after an accepted baseline", async () => {
    const p = challenge(target);
    const f = fixture(p, (r) =>
      r.method === "POST" && r.headers?.Authorization !== `Bearer ${valid}`
        ? { status: 401, authError: "invalid_token" }
        : undefined,
    );
    const report = await run(parsed({ recipe: "invalid-token" }), p, data, f.send, env);
    expect(report.conclusion).toBe("review-required");
    expect(report.samples.filter((s) => s.outcome === "http-denied").map((s) => s.label)).toEqual([
      "missing-token",
      "invalid-token",
    ]);
    expect(
      f.requests.find(
        (r) => object(r.body) && r.body.method === "initialize" && !r.headers?.Authorization,
      ),
    ).toBeDefined();
  });
  it.each([
    { status: 200, json: { jsonrpc: "2.0", id: 2, error: { code: -32603, message: valid } } },
    { status: 200, json: { jsonrpc: "2.0", id: 999, result: { tools: [] } } },
    { status: 200, json: { jsonrpc: "2.0", id: 2, result: {} } },
    { status: 429 },
    { status: 500 },
    { status: null, error: "timeout" as const },
  ])("keeps broken operations inconclusive: %j", async (response) => {
    const p = challenge(target);
    const f = fixture(p, (r) =>
      object(r.body) && r.body.method === "tools/list" ? response : undefined,
    );
    const report = await run(parsed({ recipe: "invalid-token" }), p, data, f.send, env);
    expect(report.conclusion).toBe("inconclusive");
    expect(report.samples.every((s) => s.label === "baseline")).toBe(true);
    expect(JSON.stringify(report)).not.toContain(valid);
  });
  it("does not treat a tool-level error as successful authorization", async () => {
    const p = challenge(target);
    const f = fixture(p, (r) =>
      object(r.body) && r.body.method === "tools/call"
        ? { status: 200, json: { jsonrpc: "2.0", id: 2, result: { content: [], isError: true } } }
        : undefined,
    );
    const report = await run(
      parsed({ request: { method: "tools/call", params: { name: "read-test" } } }),
      p,
      data,
      f.send,
      env,
    );
    expect(report.samples.some((s) => s.outcome === "tool-error")).toBe(true);
    expect(report.conclusion).toBe("inconclusive");
  });
  it("requires the supported protocol version instead of guessing", async () => {
    const p = challenge(target);
    const f = fixture(p, (r) =>
      object(r.body) && r.body.method === "initialize"
        ? {
            status: 200,
            json: { jsonrpc: "2.0", id: 1, result: { protocolVersion: "2099-01-01" } },
          }
        : undefined,
    );
    expect((await run(parsed(), p, data, f.send, env)).conclusion).toBe("inconclusive");
  });
  it("captures scope challenge semantics without arbitrary values", async () => {
    const p = challenge(target);
    const f = fixture(p, (r) =>
      r.headers?.Authorization === `Bearer ${other}`
        ? { status: 403, authError: "insufficient_scope", hasScopeChallenge: true }
        : undefined,
    );
    const report = await run(
      parsed({ recipe: "scope", comparisonTokenEnv: "OTHER_TOKEN" }),
      p,
      data,
      f.send,
      env,
    );
    expect(report.samples.at(-1)).toMatchObject({
      label: "insufficient-scope",
      status: 403,
      authError: "insufficient_scope",
      hasScopeChallenge: true,
    });
  });
});

describe("DCR and revocation", () => {
  it("creates only one client, confines credentials to AS, and omits returned secrets", async () => {
    const url = "https://issuer.example.com/register";
    const p = challenge(url);
    const f = fixture(p, (r) =>
      r.method === "POST"
        ? {
            status: 201,
            json: {
              client_id: "private-id",
              client_secret: "private-secret",
              registration_access_token: "private-management-token",
            },
          }
        : undefined,
    );
    const c = configSchema.parse({
      version: 1,
      recipe: "dcr",
      target: url,
      context: "Test client will be removed using the administration UI.",
      registration: {
        client_name: "letsauth-test-unique-name",
        redirect_uris: ["https://lab.example.com/callback"],
      },
    });
    const report = await run(c, p, data, f.send, {});
    expect(f.requests).toHaveLength(2);
    expect(f.requests.every((r) => !r.headers?.Authorization)).toBe(true);
    expect(report.samples[0]?.outcome).toBe("registered");
    expect(JSON.stringify(report)).not.toContain("private-");
  });
  it("does not treat DCR denial as unsupported", async () => {
    const url = "https://issuer.example.com/register";
    const p = challenge(url);
    const f = fixture(p, (r) => (r.method === "POST" ? { status: 403 } : undefined));
    const c = configSchema.parse({
      version: 1,
      recipe: "dcr",
      target: url,
      context: "Test registration with controlled client metadata.",
      registration: {
        client_name: "unique-name",
        redirect_uris: ["https://lab.example.com/callback"],
      },
    });
    const report = await run(c, p, data, f.send, {});
    expect(report.samples[0]?.outcome).toBe("registration-rejected");
    expect(JSON.stringify(report)).not.toContain("unsupported");
  });
  it("pairs a revocation run with the same successful baseline token and operation", async () => {
    const p = challenge(target);
    const f = fixture(p);
    const before = await run(parsed(), p, data, f.send, env);
    const c = parsed({
      recipe: "revocation",
      baseline: "before.json",
      revokedAt: new Date().toISOString(),
    });
    const after = await run(c, p, data, f.send, env, before);
    expect(after.baselineDigest).toBe(digest(before));
    expect(after.samples[0]?.label).toBe("after-revocation");
    const mismatched = fixture(p);
    await expect(run(c, p, data, mismatched.send, { GOOD_TOKEN: other }, before)).rejects.toThrow(
      "matching baseline",
    );
    await expect(
      run(
        { ...c, request: { method: "resources/list", params: {} } },
        p,
        data,
        mismatched.send,
        env,
        before,
      ),
    ).rejects.toThrow("matching baseline");
    expect(mismatched.requests).toHaveLength(0);
  });
});

describe("evidence and observations", () => {
  it("extracts complete matching SSE responses, ignoring partial frames/notifications", () => {
    const event = 'data: {"jsonrpc":"2.0","id":2,"result":{"tools":[]}}';
    expect(sseResponse(`${event}\n`, 2)).toBeUndefined();
    expect(
      sseResponse(`: keepalive\r\n\r\ndata: {"method":"ping"}\r\n\r\n${event}\r\n\r\n`, 2),
    ).toMatchObject({ id: 2 });
    expect(sseResponse(`${event}\n\n`, 1)).toBeUndefined();
  });
  it("retains only bounded auth challenge vocabulary", () => {
    expect(
      authSummary('Bearer error="insufficient_scope", scope="secret-scope", realm="secret-realm"'),
    ).toEqual({ authError: "insufficient_scope", hasScopeChallenge: true });
    expect(authSummary('Basic realm="secret"')).toEqual({});
    expect(redact(`Bearer ${valid} https://example.com/?access_token=${other}`)).not.toContain(
      valid,
    );
  });
  it("prepares manual observations with citations and refuses client-party or unknown entities", () => {
    const input = {
      server: "figma",
      feature: "mcp.as.dcr",
      status: "partial",
      by: "jbspeakr",
      evidence:
        "Reviewed vendor documentation; registration is restricted to approved client names.",
    };
    expect(observation(data, input)).toMatchObject({
      method: "manual",
      status: "partial",
      revision: { spec: "mcp-authorization" },
    });
    expect(() => observation(data, { ...input, server: "not-listed" })).toThrow();
    expect(() => observation(data, { ...input, feature: "mcp.client.pkce" })).toThrow();
    expect(() => observation(data, { ...input, status: "pass" })).toThrow();
    expect(() =>
      observation(data, { ...input, evidence: `Used Bearer ${valid} to call a test operation` }),
    ).toThrow("redact");
  });
  it("refuses attaching an unrelated report to a manual finding", async () => {
    const p = challenge(target);
    const f = fixture(p);
    const r = await run(parsed(), p, data, f.send, env);
    expect(reportSchema.safeParse({ ...r, rawToken: valid }).success).toBe(false);
    expect(() =>
      observation(data, {
        server: "figma",
        feature: "mcp.as.dcr",
        status: "unknown",
        by: "jbspeakr",
        evidence: "This unrelated baseline cannot support a registration observation.",
        report: r,
      }),
    ).toThrow("does not cite");
  });
  it("attaches an unlisted endpoint report after adding that exact server", async () => {
    const p = challenge(target);
    const f = fixture(p);
    const report = await run(parsed({ recipe: "invalid-token" }), p, data, f.send, env);
    const input = {
      server: "new-server",
      feature: "mcp.rs.401-on-invalid",
      status: "unknown",
      by: "test-reviewer",
      evidence: "Reviewed the recorded token comparison; follow-up investigation is needed.",
      report,
    };
    expect(() => observation(data, input)).toThrow();
    const server = {
      id: "new-server",
      name: "New server",
      url: target,
      transport: "streamable-http" as const,
      listed: "maintainer-added" as const,
      source: "https://lab.example.com/docs",
    };
    const withServer = { ...data, servers: [...data.servers, server] };
    expect(observation(withServer, input)).toMatchObject({
      server: "new-server",
      method: "manual",
    });
    for (const changed of [
      { target: "https://other.example.com/mcp" },
      { server: "figma" },
      { recipe: "dcr" as const },
    ]) {
      expect(() =>
        observation(withServer, { ...input, report: { ...report, ...changed } }),
      ).toThrow("does not cite");
    }
  });
});
