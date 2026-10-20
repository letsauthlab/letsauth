import { randomBytes } from "node:crypto";
import type { Dataset } from "../../lib/data";
import {
  type Config,
  citations,
  configSchema,
  digest,
  PROTOCOL,
  type Report,
  recipes,
  redact,
  reportSchema,
  type Sample,
  VERSION,
} from "./model";
import { object, type Response, type Transport } from "./transport";

export function token(env: NodeJS.ProcessEnv, name: string | undefined): string | undefined {
  if (!name) return undefined;
  const value = env[name];
  if (!value || value.length < 8 || value.length > 8192 || !/^[A-Za-z0-9._~+/-]+=*$/.test(value))
    throw new Error("required token environment variable is missing or not a valid bearer value");
  return value;
}

function sample(label: string, stage: string, r: Response, id?: number): Sample {
  const base = {
    label,
    stage,
    status: r.status,
    ...(r.error ? { error: r.error } : {}),
    ...(r.authError ? { authError: r.authError } : {}),
    ...(r.hasScopeChallenge !== undefined ? { hasScopeChallenge: r.hasScopeChallenge } : {}),
  };
  if (r.error || r.status === null || r.status === 429 || r.status >= 500)
    return { ...base, outcome: "inconclusive" };
  if (r.status === 401 || r.status === 403) return { ...base, outcome: "http-denied" };
  if (r.status < 200 || r.status >= 300) return { ...base, outcome: "inconclusive" };
  if (id === undefined) return { ...base, outcome: r.status === 202 ? "accepted" : "inconclusive" };
  if (!object(r.json) || r.json.jsonrpc !== "2.0" || r.json.id !== id)
    return { ...base, outcome: "inconclusive" };
  if ("error" in r.json) return { ...base, outcome: "protocol-error" };
  if (!object(r.json.result)) return { ...base, outcome: "inconclusive" };
  return { ...base, outcome: r.json.result.isError === true ? "tool-error" : "accepted" };
}

function validResult(method: NonNullable<Config["request"]>["method"], value: unknown): boolean {
  if (!object(value)) return false;
  if (method === "tools/list") return Array.isArray(value.tools);
  if (method === "resources/list") return Array.isArray(value.resources);
  if (method === "resources/read") return Array.isArray(value.contents);
  return Array.isArray(value.content) || object(value.structuredContent);
}

/** Independent session per token; no state/headers from the baseline leak into a negative test. */
async function mcp(
  c: Config,
  bearer: string | undefined,
  label: string,
  send: Transport,
  samples: Sample[],
): Promise<Sample> {
  const headers: Record<string, string> = bearer ? { Authorization: `Bearer ${bearer}` } : {};
  const post = (method: string, params: unknown, id?: number) =>
    send({
      url: c.target,
      method: "POST",
      headers: { ...headers },
      rpcId: id,
      body: { jsonrpc: "2.0", ...(id === undefined ? {} : { id }), method, params },
    });
  const init = await post(
    "initialize",
    {
      protocolVersion: PROTOCOL,
      capabilities: {},
      clientInfo: { name: "letsauth-investigate", version: "1.0.0" },
    },
    1,
  );
  let result = sample(label, "initialize", init, 1);
  const initialized = object(init.json) && object(init.json.result) ? init.json.result : undefined;
  if (
    result.outcome === "accepted" &&
    (initialized?.protocolVersion !== PROTOCOL ||
      !object(initialized?.capabilities) ||
      !object(initialized?.serverInfo))
  )
    result = { ...result, outcome: "inconclusive" };
  samples.push(result);
  if (result.outcome !== "accepted") return result;
  headers["MCP-Protocol-Version"] = PROTOCOL;
  if (init.session) headers["MCP-Session-Id"] = init.session;
  try {
    const notification = sample(label, "initialized", await post("notifications/initialized", {}));
    samples.push(notification);
    if (notification.outcome !== "accepted") return notification;
    const operation = c.request;
    if (!operation) throw new Error("missing operation");
    const response = await post(operation.method, operation.params, 2);
    let tested = sample(label, "operation", response, 2);
    if (
      tested.outcome === "accepted" &&
      !validResult(operation.method, object(response.json) ? response.json.result : undefined)
    )
      tested = { ...tested, outcome: "inconclusive" };
    samples.push(tested);
    return tested;
  } finally {
    if (init.session) {
      const closed = await send({ url: c.target, method: "DELETE", headers: { ...headers } });
      samples.push({
        label,
        stage: "cleanup",
        status: closed.status,
        ...(closed.error ? { error: closed.error } : {}),
        outcome:
          !closed.error &&
          closed.status !== null &&
          (closed.status === 405 || (closed.status >= 200 && closed.status < 300))
            ? "accepted"
            : "inconclusive",
      });
    }
  }
}

export function validateBaseline(
  c: Config,
  baseline: Report | undefined,
  bearer: string,
  now: number,
): Report {
  const b = reportSchema.parse(baseline);
  const revoked = Date.parse(c.revokedAt ?? "");
  if (
    b.recipe !== "baseline" ||
    b.target !== c.target ||
    b.server !== c.server ||
    b.operationDigest !== digest(c.request) ||
    b.tokenDigest !== digest(bearer) ||
    b.conclusion !== "review-required" ||
    !b.samples.some(
      (s) => s.label === "baseline" && s.stage === "operation" && s.outcome === "accepted",
    ) ||
    Date.parse(b.completedAt) > revoked ||
    revoked > now ||
    now - Date.parse(b.startedAt) > 86_400_000
  ) {
    throw new Error(
      "revocation needs a successful matching baseline (same endpoint, server, operation and token) within 24 hours, completed before revokedAt",
    );
  }
  return b;
}

export function validateRun(c: Config, data: Dataset): void {
  if (Buffer.byteLength(JSON.stringify(c.request ?? c.registration)) > 260_000)
    throw new Error("configured operation/registration exceeds the request byte limit");
  citations(data, recipes[c.recipe].feature, c.revision);
  if (c.server) {
    const server = data.servers.find((s) => s.id === c.server);
    if (!server || server.withdrawn || server.transport !== "streamable-http")
      throw new Error("listed server must be an active Streamable HTTP server");
    if (c.recipe !== "dcr" && new URL(server.url).href !== c.target)
      throw new Error(
        "target differs from the listed server URL; omit server for an independent lab endpoint",
      );
  }
}

export async function run(
  config: Config,
  data: Dataset,
  send: Transport,
  env: NodeJS.ProcessEnv = process.env,
  baseline?: Report,
): Promise<Report> {
  const c = configSchema.parse(config);
  validateRun(c, data);
  const started = Date.now();
  const refs = citations(data, recipes[c.recipe].feature, c.revision);
  const bearer = token(env, c.tokenEnv);
  const comparison = token(env, c.comparisonTokenEnv);
  if (comparison && comparison === bearer)
    throw new Error("comparison token must differ from the baseline token");
  const before =
    c.recipe === "revocation"
      ? validateBaseline(c, baseline, bearer as string, started)
      : undefined;
  const active: Transport = async (input) => {
    if (input.url !== c.target) return { status: null, error: "refused" };
    return send(input);
  };
  const samples: Sample[] = [];
  let inconclusive = false;
  if (c.recipe === "dcr") {
    const response = await active({
      url: c.target,
      method: "POST",
      body: c.registration,
      ...(bearer ? { headers: { Authorization: `Bearer ${bearer}` } } : {}),
    });
    const created =
      response.status === 201 &&
      object(response.json) &&
      typeof response.json.client_id === "string" &&
      response.json.client_id.length > 0;
    const rejected = response.status !== null && [400, 401, 403].includes(response.status);
    const outcome =
      !response.error && created
        ? "registered"
        : !response.error && rejected
          ? "registration-rejected"
          : "inconclusive";
    samples.push({
      label: "registration",
      stage: "registration",
      status: response.status,
      ...(response.error ? { error: response.error } : {}),
      outcome,
    });
    inconclusive = outcome === "inconclusive";
  } else if (c.recipe === "revocation") {
    const after = await mcp(c, bearer, "after-revocation", active, samples);
    inconclusive = !["accepted", "http-denied"].includes(after.outcome);
  } else {
    const base = await mcp(c, bearer, "baseline", active, samples);
    inconclusive = base.stage !== "operation" || base.outcome !== "accepted";
    if (!inconclusive && c.recipe !== "baseline") {
      const variants =
        c.recipe === "invalid-token"
          ? [
              { label: "missing-token", value: undefined },
              { label: "invalid-token", value: randomBytes(32).toString("base64url") },
            ]
          : [
              {
                label: c.recipe === "audience" ? "wrong-audience" : "insufficient-scope",
                value: comparison,
              },
            ];
      for (const v of variants) {
        const tested = await mcp(c, v.value, v.label, active, samples);
        if (!["accepted", "http-denied"].includes(tested.outcome)) inconclusive = true;
      }
    }
  }
  return reportSchema.parse({
    version: 1,
    runner: VERSION,
    recipe: c.recipe,
    target: c.target,
    ...(c.server ? { server: c.server } : {}),
    startedAt: new Date(started).toISOString(),
    completedAt: new Date().toISOString(),
    configDigest: digest(c),
    operationDigest: digest(c.request ?? c.registration),
    ...(bearer ? { tokenDigest: digest(bearer) } : {}),
    context: redact(c.context, [bearer ?? "", comparison ?? ""]),
    citations: refs,
    references:
      c.recipe === "dcr"
        ? ["https://www.rfc-editor.org/rfc/rfc7591"]
        : [
            "https://modelcontextprotocol.io/specification/2025-11-25/basic/transports",
            ...(c.recipe === "revocation" ? ["https://www.rfc-editor.org/rfc/rfc7009"] : []),
          ],
    samples,
    conclusion: inconclusive ? "inconclusive" : "review-required",
    ...(before ? { baselineDigest: digest(before), revokedAt: c.revokedAt } : {}),
  });
}
