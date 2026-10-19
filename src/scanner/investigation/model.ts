import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { currentRevision } from "../../lib/atlas";
import type { Dataset } from "../../lib/data";

export const VERSION = "letsauth-investigate/1.0.0";
export const PROOF_PATH = "/.well-known/letsauth-investigation.json";
export const PROTOCOL = "2025-11-25";

export function endpoint(input: string): string {
  const u = new URL(input);
  if (u.protocol !== "https:" || u.username || u.password || u.port || u.search || u.hash) {
    throw new Error("endpoint must be HTTPS on port 443, without credentials, query or fragment");
  }
  return u.href;
}

const httpsEndpoint = z.string().transform((s, ctx) => {
  try {
    return endpoint(s);
  } catch {
    ctx.addIssue({
      code: "custom",
      message: "expected HTTPS endpoint without credentials/query/fragment",
    });
    return z.NEVER;
  }
});
const envName = z.string().regex(/^[A-Z][A-Z0-9_]*$/);
export const recipeId = z.enum([
  "baseline",
  "invalid-token",
  "audience",
  "scope",
  "revocation",
  "dcr",
]);
export type RecipeId = z.infer<typeof recipeId>;

export const recipes = {
  baseline: {
    feature: undefined,
    title: "Authenticated MCP baseline",
    steps: [
      "Complete the provider's normal OAuth login with an existing client (authorization code + S256 PKCE). Verify state, issuer, redirect URI and resource binding in that client.",
      "Put the resulting short-lived access token in tokenEnv. Select a harmless operation that should succeed for this account.",
      "A successful operation is a prerequisite for negative comparisons; initialization alone is insufficient.",
    ],
  },
  "invalid-token": {
    feature: "mcp.rs.401-on-invalid",
    title: "Missing and invalid token handling",
    steps: [
      "Obtain a valid baseline token and select a protected operation.",
      "The runner repeats the operation without a token and with a random invalid bearer token.",
      "Inspect the stage and status: 401 is expected; errors and timeouts do not establish enforcement.",
    ],
  },
  audience: {
    feature: "mcp.rs.audience-validation",
    title: "Wrong-audience token comparison",
    steps: [
      "Obtain two valid, unexpired tokens from the same issuer for the same user and equivalent scopes: one for this resource, one for a different resource.",
      "Confirm those properties using trusted issuer information; never edit a JWT payload or treat decoding as signature verification.",
      "Set tokenEnv and comparisonTokenEnv. Explain the controlled difference in context. Rejection alone does not prove that audience caused it.",
    ],
  },
  scope: {
    feature: "mcp.rs.insufficient-scope",
    title: "Insufficient-scope comparison",
    steps: [
      "Obtain tokens with the same user, issuer and audience, one including and one lacking the required scope.",
      "Choose a known scope-protected operation; tools/list may be public and is not evidence of tool authorization.",
      "Set tokenEnv and comparisonTokenEnv and document the scope difference in context. Inspect HTTP 403 and the Bearer insufficient_scope challenge.",
    ],
  },
  revocation: {
    feature: undefined,
    title: "Access after manual revocation",
    steps: [
      "Save a successful baseline report for the exact token, endpoint and operation.",
      "Revoke the token or grant through the provider's supported UI/client. Record exactly what was revoked and when, plus expected propagation/expiry semantics.",
      "Run revocation with the same tokenEnv, request, baseline report and revokedAt. A fresh MCP session is used; existing-session behavior is outside this check.",
      "Continued access may reflect access-token lifetime or propagation, not necessarily a violation of RFC 7009. No automatic atlas mapping.",
    ],
  },
  dcr: {
    feature: "mcp.as.dcr",
    title: "One dynamic client registration attempt",
    steps: [
      "Read the advertised registration endpoint and registration policy. Control proof is required at that authorization server origin, not just the MCP origin.",
      "Supply deliberate client metadata with a unique client_name and a callback you control. This sends one registration request and may create a client.",
      "Record the result and remove the test client through the provider's administration UI. Client IDs/secrets are deliberately not saved; locate the client by its unique name.",
      "One rejection may mean invalid metadata, a required initial token or policy restrictions. It does not establish unsupported DCR.",
    ],
  },
} satisfies Record<RecipeId, { feature: string | undefined; title: string; steps: string[] }>;

const operation = z.strictObject({
  method: z.enum(["tools/list", "resources/list", "resources/read", "tools/call"]),
  params: z.record(z.string(), z.unknown()).default({}),
});

export const configSchema = z
  .strictObject({
    version: z.literal(1),
    recipe: recipeId,
    target: httpsEndpoint,
    server: z.string().optional(),
    revision: z.string().optional(),
    context: z.string().trim().min(20).max(4000),
    tokenEnv: envName.optional(),
    comparisonTokenEnv: envName.optional(),
    request: operation.optional(),
    registration: z
      .strictObject({
        client_name: z.string().min(1).max(200),
        redirect_uris: z.array(z.url()).min(1).max(5),
        grant_types: z
          .array(z.enum(["authorization_code", "refresh_token"]))
          .default(["authorization_code"]),
        response_types: z.array(z.literal("code")).default(["code"]),
        token_endpoint_auth_method: z.literal("none").default("none"),
        application_type: z.enum(["web", "native"]).optional(),
        scope: z.string().optional(),
      })
      .optional(),
    baseline: z.string().optional(),
    revokedAt: z.iso.datetime().optional(),
  })
  .superRefine((c, ctx) => {
    const problem = (message: string) => ctx.addIssue({ code: "custom", message });
    if (c.recipe === "dcr") {
      if (!c.registration) problem("dcr requires registration metadata");
      if (c.request || c.comparisonTokenEnv || c.baseline || c.revokedAt)
        problem("unexpected MCP/revocation fields for dcr");
    } else {
      if (!c.tokenEnv || !c.request) problem("MCP recipes require tokenEnv and request");
      if (c.registration) problem("registration is only valid for dcr");
      if (c.request?.method === "resources/read" && typeof c.request.params.uri !== "string")
        problem("resources/read requires params.uri");
      if (c.request?.method === "tools/call" && typeof c.request.params.name !== "string")
        problem("tools/call requires params.name");
    }
    if (c.recipe === "audience" || c.recipe === "scope") {
      if (!c.comparisonTokenEnv || c.comparisonTokenEnv === c.tokenEnv)
        problem("comparison requires a different comparisonTokenEnv");
    } else if (c.comparisonTokenEnv) problem("comparisonTokenEnv is only valid for audience/scope");
    if (c.recipe === "revocation") {
      if (!c.baseline || !c.revokedAt) problem("revocation requires baseline report and revokedAt");
    } else if (c.baseline || c.revokedAt)
      problem("baseline/revokedAt are only valid for revocation");
  });
export type Config = z.infer<typeof configSchema>;

export const proofSchema = z.strictObject({
  version: z.literal(1),
  target: httpsEndpoint,
  nonce: z.string().regex(/^[a-f0-9]{64}$/),
  expiresAt: z.iso.datetime(),
});
export type Proof = z.infer<typeof proofSchema>;
export function challenge(target: string, now = Date.now()): Proof {
  return {
    version: 1,
    target: endpoint(target),
    nonce: randomBytes(32).toString("hex"),
    expiresAt: new Date(now + 3_600_000).toISOString(),
  };
}
export function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function resolveTarget(data: Dataset, target: string) {
  const server = data.servers.find((s) => s.id === target);
  if (server?.withdrawn || server?.transport === "stdio-only")
    throw new Error("server is withdrawn or has no HTTP endpoint");
  return { target: endpoint(server?.url ?? target), ...(server ? { server: server.id } : {}) };
}

export function citations(data: Dataset, feature: string | undefined, revision?: string) {
  const selected = revision ?? currentRevision(data).id;
  if (
    !data.specs.some(
      (s) => s.id === "mcp-authorization" && s.revisions.some((r) => r.id === selected),
    )
  )
    throw new Error("unknown MCP authorization revision");
  if (!feature) return [];
  const f = data.features.find((f) => f.id === feature);
  const r = f?.revisions.find((r) => r.spec === "mcp-authorization" && r.revision === selected);
  if (!r) throw new Error("feature is not defined in the selected revision");
  return [{ feature, spec: r.spec, revision: r.revision, section: r.section }];
}

export function plan(data: Dataset, target: string, revision?: string) {
  const resolved = resolveTarget(data, target);
  const selected = revision ?? currentRevision(data).id;
  citations(data, undefined, selected);
  return {
    version: 1,
    ...resolved,
    revision: selected,
    passive: `pnpm scan ${resolved.server ?? resolved.target} --json`,
    recipes: Object.entries(recipes).map(([id, r]) => ({
      id,
      ...r,
      citations: citations(data, r.feature, selected),
    })),
    manual: data.features
      .filter(
        (f) =>
          f.party !== "client" &&
          f.observable === "manual" &&
          f.revisions.some((r) => r.revision === selected),
      )
      .map((f) => ({
        feature: f.id,
        question: f.description,
        citations: citations(data, f.id, selected),
        procedure:
          "Inspect the vendor's documentation or source at a pinned version. Record the exact URL/file/lines and what demonstrates this requirement. If unavailable, record unknown; a directory label is only vendor-claim.",
      })),
    limits:
      "Optional checklist; use init to create a run configuration. Active execution requires owner control at the target origin. Reports require interpretation and do not set atlas statuses.",
  };
}

const outcome = z.enum([
  "accepted",
  "http-denied",
  "protocol-error",
  "tool-error",
  "inconclusive",
  "registered",
  "registration-rejected",
]);
export const sampleSchema = z.strictObject({
  label: z.string(),
  stage: z.string(),
  status: z.number().int().nullable(),
  outcome,
  error: z
    .enum(["network", "timeout", "too-large", "redirect", "invalid-response", "refused"])
    .optional(),
  authError: z.enum(["invalid_token", "insufficient_scope", "invalid_request"]).optional(),
  hasScopeChallenge: z.boolean().optional(),
});
export type Sample = z.infer<typeof sampleSchema>;
export const reportSchema = z.strictObject({
  version: z.literal(1),
  runner: z.literal(VERSION),
  recipe: recipeId,
  target: httpsEndpoint,
  server: z.string().optional(),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime(),
  configDigest: z.string(),
  operationDigest: z.string(),
  tokenDigest: z.string().optional(),
  context: z.string(),
  citations: z.array(
    z.strictObject({
      feature: z.string(),
      spec: z.string(),
      revision: z.string(),
      section: z.string(),
    }),
  ),
  references: z.array(z.url()),
  samples: z.array(sampleSchema),
  conclusion: z.enum(["review-required", "inconclusive"]),
  baselineDigest: z.string().optional(),
  revokedAt: z.iso.datetime().optional(),
});
export type Report = z.infer<typeof reportSchema>;

/** Defense in depth for operator notes. Network evidence itself uses a field allowlist. */
export function redact(text: string, secrets: string[] = []): string {
  let result = text;
  for (const secret of secrets.filter(Boolean).sort((a, b) => b.length - a.length))
    result = result.split(secret).join("[REDACTED]");
  return (
    result
      .replace(/\bBearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
      .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED JWT]")
      .replace(
        /([?&](?:code|token|access_token|refresh_token|client_secret|id_token)=)[^&\s]+/gi,
        "$1[REDACTED]",
      )
      // biome-ignore lint/suspicious/noControlCharactersInRegex: strip terminal escapes and control bytes from operator text
      .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
  );
}
