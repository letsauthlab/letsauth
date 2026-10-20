import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { oauthOptionsSchema } from "../../src/scanner/investigation/model";
import { callbackParams, login, oauthFetch } from "../../src/scanner/investigation/oauth";
import type { Request, Response, Transport } from "../../src/scanner/investigation/transport";

const target = "https://mcp.example.com/mcp";
const issuer = "https://auth.example.com";
const redirectUrl = "http://127.0.0.1:8765/callback";
const accessToken = "sensitive-test-access-token";
const options = oauthOptionsSchema.parse({});

function setup(change?: (r: Request) => Response | undefined, callbackChange?: (url: URL) => void) {
  const requests: Request[] = [];
  const messages: string[] = [];
  const close = vi.fn();
  let complete!: (url: URL) => void;
  let authorization: URL | undefined;
  const result = new Promise<URL>((resolve) => {
    complete = resolve;
  });
  const metadata = {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    registration_endpoint: `${issuer}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_basic"],
    authorization_response_iss_parameter_supported: true,
  };
  const send: Transport = async (r) => {
    requests.push(structuredClone(r));
    const changed = change?.(r);
    if (changed) return changed;
    if (r.url === target)
      return {
        status: 401,
        wwwAuthenticate: `Bearer resource_metadata="https://mcp.example.com/metadata", scope="tools:read"`,
      };
    if (r.url === "https://mcp.example.com/metadata")
      return {
        status: 200,
        json: {
          resource: target,
          authorization_servers: [issuer],
          scopes_supported: ["all:tools"],
        },
      };
    if (r.url === `${issuer}/.well-known/oauth-authorization-server`)
      return { status: 200, json: metadata };
    if (r.url === `${issuer}/register`)
      return { status: 201, json: { ...JSON.parse(r.body as string), client_id: "test-client" } };
    if (r.url === `${issuer}/token`)
      return {
        status: 200,
        json: {
          access_token: accessToken,
          token_type: "Bearer",
          refresh_token: "do-not-persist-refresh",
          expires_in: 3600,
        },
      };
    return { status: 404 };
  };
  const deps = {
    send,
    notify: (message: string) => messages.push(message),
    callback: async () => ({ redirectUrl, result, close }),
    open: async (url: URL) => {
      authorization = url;
      const callback = new URL(redirectUrl);
      callback.searchParams.set("state", url.searchParams.get("state") as string);
      callback.searchParams.set("code", "private-authorization-code");
      callback.searchParams.set("iss", issuer);
      callbackChange?.(callback);
      complete(callback);
    },
  };
  return { requests, messages, close, deps, metadata, authorization: () => authorization };
}

describe("interactive OAuth using the real MCP SDK", () => {
  it("discovers, registers, uses PKCE/state/resource and exchanges the browser code", async () => {
    const f = setup();
    expect(await login(target, options, {}, f.deps)).toBe(accessToken);
    const authorize = f.authorization();
    expect(authorize?.searchParams.get("scope")).toBe("tools:read");
    expect(authorize?.searchParams.get("resource")).toBe(target);
    expect(authorize?.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorize?.searchParams.get("state")?.length).toBeGreaterThanOrEqual(32);
    const request = f.requests.find((r) => r.url === `${issuer}/token`);
    const form = new URLSearchParams(request?.body as string);
    expect(form.get("code")).toBe("private-authorization-code");
    expect(form.get("resource")).toBe(target);
    expect(form.get("redirect_uri")).toBe(redirectUrl);
    expect(
      createHash("sha256")
        .update(form.get("code_verifier") as string)
        .digest("base64url"),
    ).toBe(authorize?.searchParams.get("code_challenge"));
    expect(f.requests.filter((r) => r.url.endsWith("/register"))).toHaveLength(1);
    expect(f.requests.every((r) => r.oauth)).toBe(true);
    for (const secret of [
      accessToken,
      "do-not-persist-refresh",
      "private-authorization-code",
      form.get("code_verifier") as string,
    ])
      expect(f.messages.join("\n")).not.toContain(secret);
    expect(f.close).toHaveBeenCalledTimes(1);
  });
  it("uses preregistered client credentials and an explicit scope without DCR", async () => {
    const f = setup();
    const configured = oauthOptionsSchema.parse({
      clientId: "existing-client",
      clientSecretEnv: "CLIENT_SECRET",
      scope: "files:read",
    });
    await login(target, configured, { CLIENT_SECRET: "hidden-client-secret" }, f.deps);
    expect(f.requests.some((r) => r.url.endsWith("/register"))).toBe(false);
    expect(f.authorization()?.searchParams.get("client_id")).toBe("existing-client");
    expect(f.authorization()?.searchParams.get("scope")).toBe("files:read");
    const token = f.requests.find((r) => r.url.endsWith("/token"));
    expect(token?.headers?.authorization).toBe(
      `Basic ${Buffer.from("existing-client:hidden-client-secret").toString("base64")}`,
    );
    expect(f.messages.join("\n")).not.toContain("hidden-client-secret");
  });
  it("uses a supplied CIMD URL when the AS supports it", async () => {
    const f = setup((r) =>
      r.url.endsWith("oauth-authorization-server")
        ? { status: 200, json: { ...f.metadata, client_id_metadata_document_supported: true } }
        : undefined,
    );
    const clientMetadataUrl = "https://client.example.com/oauth.json";
    await login(target, oauthOptionsSchema.parse({ clientMetadataUrl }), {}, f.deps);
    expect(f.requests.some((r) => r.url.endsWith("/register"))).toBe(false);
    expect(f.authorization()?.searchParams.get("client_id")).toBe(clientMetadataUrl);
  });
  it.each(["state", "iss", "missing-iss", "error", "duplicate-code"])(
    "refuses %s callback before token exchange",
    async (kind) => {
      const f = setup(undefined, (url) => {
        if (kind === "missing-iss") url.searchParams.delete("iss");
        else if (kind === "duplicate-code") url.searchParams.append("code", "injected-code");
        else
          url.searchParams.set(
            kind,
            kind === "iss" ? "https://wrong.example.com" : "malicious-value",
          );
      });
      await expect(login(target, options, {}, f.deps)).rejects.toThrow();
      expect(f.requests.some((r) => r.url.endsWith("/token"))).toBe(false);
      expect(f.close).toHaveBeenCalledTimes(1);
      expect(f.messages.join("\n")).not.toContain("malicious-value");
    },
  );
  it("fails clearly when registration is unavailable and no client was supplied", async () => {
    const f = setup((r) =>
      r.url.endsWith("oauth-authorization-server")
        ? { status: 200, json: { ...f.metadata, registration_endpoint: undefined } }
        : undefined,
    );
    await expect(login(target, options, {}, f.deps)).rejects.toThrow("supply --client-id");
    expect(f.authorization()).toBeUndefined();
    expect(f.close).toHaveBeenCalledTimes(1);
  });
  it.each(["issuer", "pkce", "resource"])(
    "rejects invalid %s metadata before registration",
    async (kind) => {
      const f = setup((r) => {
        if (kind === "resource" && r.url.endsWith("/metadata"))
          return {
            status: 200,
            json: { resource: "https://other.example.com/mcp", authorization_servers: [issuer] },
          };
        if (kind !== "resource" && r.url.endsWith("oauth-authorization-server"))
          return {
            status: 200,
            json: {
              ...f.metadata,
              ...(kind === "issuer"
                ? { issuer: "https://other.example.com" }
                : { code_challenge_methods_supported: ["plain"] }),
            },
          };
        return undefined;
      });
      await expect(login(target, options, {}, f.deps)).rejects.toThrow();
      expect(f.requests.some((r) => r.url.endsWith("/register") || r.url.endsWith("/token"))).toBe(
        false,
      );
    },
  );
  it("does not retry a rejected grant or expose its error description", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const f = setup((r) =>
        r.url.endsWith("/token")
          ? {
              status: 400,
              json: {
                error: "invalid_grant",
                error_description: "private-authorization-code hidden-client-secret",
              },
            }
          : undefined,
      );
      await expect(login(target, options, {}, f.deps)).rejects.toThrow(
        "credentials or grant were rejected",
      );
      expect(f.requests.filter((r) => r.url.endsWith("/token"))).toHaveLength(1);
      expect(JSON.stringify(warn.mock.calls)).not.toContain("private-authorization-code");
      expect(f.close).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });
  it("does not reuse a previous run's client or tokens", async () => {
    for (let i = 0; i < 2; i++) {
      const f = setup();
      await login(target, options, {}, f.deps);
      expect(f.requests.filter((r) => r.url.endsWith("/register"))).toHaveLength(1);
      expect(f.authorization()).toBeDefined();
    }
  });
  it("closes callback listener when discovery transport fails", async () => {
    const f = setup(() => ({ status: null, error: "timeout" }));
    await expect(login(target, options, {}, f.deps)).rejects.toThrow("OAuth request failed");
    expect(f.close).toHaveBeenCalledTimes(1);
  });
});

describe("callback and fetch boundaries", () => {
  it("stops making requests after login cancellation or timeout", async () => {
    const controller = new AbortController();
    controller.abort();
    const send = vi.fn<Transport>();
    await expect(oauthFetch(send, controller.signal)(target)).rejects.toThrow(
      "cancelled or timed out",
    );
    expect(send).not.toHaveBeenCalled();
  });
  it("accepts only the configured origin/path and state", () => {
    for (const address of [
      "http://127.0.0.1:8766/callback?state=expected&code=test",
      "http://127.0.0.1:8765/other?state=expected&code=test",
      "http://127.0.0.1:8765/callback?state=wrong&code=test",
      "http://127.0.0.1:8765/callback?state=expected&state=wrong&code=test",
    ])
      expect(() => callbackParams(new URL(address), redirectUrl, "expected")).toThrow();
  });
  it("never follows token-endpoint redirects", async () => {
    const send = vi.fn<Transport>().mockResolvedValue({ status: 302, error: "redirect" });
    await expect(
      oauthFetch(send)(`${issuer}/token`, { method: "POST", body: "code=secret" }),
    ).rejects.toThrow("no redirect followed");
    expect(send).toHaveBeenCalledTimes(1);
  });
});
