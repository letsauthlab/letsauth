import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import {
  auth,
  extractWWWAuthenticateParams,
  type FetchLike,
  type OAuthClientProvider,
  type OAuthDiscoveryState,
  OAuthErrorCode,
  type StoredOAuthClientInformation,
  type StoredOAuthTokens,
} from "@modelcontextprotocol/client";
import { endpoint, type OAuthOptions, PROTOCOL } from "./model";
import { nodeTransport, object, type Transport } from "./transport";

class LoginError extends Error {}

/** SDK fetch adapter: reuse pinned public DNS, HTTPS, byte limits and request deadlines. */
export function oauthFetch(send: Transport, signal?: AbortSignal): FetchLike {
  return async (input, init) => {
    if (signal?.aborted) throw new LoginError("OAuth login cancelled or timed out");
    const request = new Request(input, init);
    if (request.method !== "GET" && request.method !== "POST")
      throw new LoginError("Unexpected OAuth request method");
    const result = await send({
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers),
      ...(request.method === "POST" ? { body: await request.text() } : {}),
      oauth: true,
    });
    if (result.error || result.status === null)
      throw new LoginError(
        `OAuth request failed (${result.error ?? "network"}); no redirect followed`,
      );
    // SDK diagnostics may log OAuth error descriptions. Supply protocol codes only.
    const body =
      result.status >= 400 && result.json !== undefined
        ? {
            error:
              object(result.json) &&
              Object.values(OAuthErrorCode).includes(result.json.error as OAuthErrorCode)
                ? result.json.error
                : "server_error",
          }
        : result.json;
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status: result.status,
      headers: {
        "content-type": "application/json",
        ...(result.wwwAuthenticate ? { "www-authenticate": result.wwwAuthenticate } : {}),
      },
    });
  };
}

/** Validate the callback before any authorization code can be exchanged. */
export function callbackParams(url: URL, redirectUrl: string, state: string): URLSearchParams {
  const expected = new URL(redirectUrl);
  if (url.origin !== expected.origin || url.pathname !== expected.pathname || url.hash)
    throw new LoginError("Unexpected OAuth callback URL");
  const params = url.searchParams;
  for (const name of ["state", "code", "iss", "error"])
    if (params.getAll(name).length > 1) throw new LoginError("Duplicate OAuth callback parameter");
  if (params.get("state") !== state) throw new LoginError("OAuth callback state mismatch");
  if (params.has("error")) throw new LoginError("Login was denied or cancelled by the provider");
  if (!params.get("code")) throw new LoginError("OAuth callback has no authorization code");
  return params;
}

export interface Callback {
  redirectUrl: string;
  result: Promise<URL>;
  signal?: AbortSignal;
  close(): void;
}

/** Loopback listener only; closed after success, timeout, cancellation or any flow error. */
export async function listenForCallback(port: number, state: string): Promise<Callback> {
  const controller = new AbortController();
  const redirectUrl = `http://127.0.0.1:${port}/callback`;
  let succeed!: (url: URL) => void;
  let fail!: (error: Error) => void;
  const result = new Promise<URL>((resolve, reject) => {
    succeed = resolve;
    fail = reject;
  });
  // A timeout can fire while discovery is still in progress. The caller will await this later.
  void result.catch(() => {});
  let received = false;
  const server = createServer((req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Content-Security-Policy", "default-src 'none'");
    if (received || req.method !== "GET" || req.headers.host !== new URL(redirectUrl).host) {
      res.writeHead(400).end("Invalid callback");
      return;
    }
    let url: URL;
    try {
      url = new URL(req.url ?? "/", redirectUrl);
    } catch {
      res.writeHead(400).end("Invalid callback");
      return;
    }
    try {
      callbackParams(url, redirectUrl, state);
      received = true;
      res.end("Login received. Return to the terminal; token validation is continuing.");
      succeed(url);
    } catch {
      res.writeHead(400).end("Invalid or declined OAuth callback. Return to the terminal.");
      if (url.pathname === "/callback" && url.searchParams.get("state") === state)
        fail(new LoginError("Login was denied or the callback was invalid"));
    }
  });
  server.headersTimeout = 10_000;
  server.requestTimeout = 10_000;
  const close = () => {
    controller.abort();
    clearTimeout(timer);
    server.closeAllConnections();
    server.close();
    process.removeListener("SIGINT", cancel);
  };
  const cancel = () => {
    fail(new LoginError("Login cancelled"));
    close();
  };
  const timer = setTimeout(() => {
    fail(new LoginError("Login timed out after five minutes"));
    close();
  }, 300_000);
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", () =>
        reject(new LoginError("Cannot listen for OAuth callback; choose another callback port")),
      );
      server.listen(port, "127.0.0.1", resolve);
    });
    process.once("SIGINT", cancel);
    return { redirectUrl, result, close, signal: controller.signal };
  } catch (error) {
    close();
    throw error;
  }
}

/** No shell interpolation: URL is one argument, including on Windows. */
export async function openBrowser(url: URL): Promise<void> {
  const [command, args] =
    process.platform === "darwin"
      ? ["open", [url.href]]
      : process.platform === "win32"
        ? ["rundll32.exe", ["url.dll,FileProtocolHandler", url.href]]
        : ["xdg-open", [url.href]];
  await new Promise<void>((resolve) => {
    const child = spawn(command as string, args as string[], { stdio: "ignore", shell: false });
    const timer = setTimeout(() => {
      child.kill();
      resolve();
    }, 5000);
    const finish = () => {
      clearTimeout(timer);
      resolve();
    };
    child.once("error", finish);
    child.once("exit", finish);
  });
}

export interface LoginDependencies {
  send?: Transport;
  callback?: (port: number, state: string) => Promise<Callback>;
  open?: (url: URL) => Promise<void>;
  notify?: (message: string) => void;
}

/** One OAuth session for one endpoint, in memory only. The SDK owns the OAuth protocol. */
export async function login(
  target: string,
  options: OAuthOptions,
  env: NodeJS.ProcessEnv = process.env,
  deps: LoginDependencies = {},
): Promise<string> {
  endpoint(target);
  const secret = options.clientSecretEnv ? env[options.clientSecretEnv] : undefined;
  if (options.clientSecretEnv && (!secret || !options.clientId))
    throw new LoginError("Client secret environment variable and client ID are required");
  const notify = deps.notify ?? ((message) => console.error(message));
  const state = randomBytes(32).toString("base64url");
  const callback = await (deps.callback ?? listenForCallback)(options.callbackPort, state);
  const fetchFn = oauthFetch(deps.send ?? nodeTransport(), callback.signal);
  let discovery: OAuthDiscoveryState | undefined;
  let client: StoredOAuthClientInformation | undefined = options.clientId
    ? { client_id: options.clientId, ...(secret ? { client_secret: secret } : {}) }
    : undefined;
  let tokens: StoredOAuthTokens | undefined;
  let verifier: string | undefined;
  let browserOpened = false;
  const provider: OAuthClientProvider = {
    redirectUrl: callback.redirectUrl,
    clientMetadataUrl: options.clientMetadataUrl,
    clientMetadata: {
      client_name: `letsauth-local-${randomBytes(4).toString("hex")}`,
      redirect_uris: [callback.redirectUrl],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: secret ? "client_secret_basic" : "none",
      application_type: "native",
    },
    state: () => state,
    clientInformation: (ctx) =>
      client?.issuer && ctx?.issuer !== client.issuer ? undefined : client,
    saveClientInformation: (value) => {
      client = value;
    },
    tokens: () => tokens,
    saveTokens: (value) => {
      tokens = value;
    },
    codeVerifier: () => {
      if (!verifier) throw new LoginError("Missing PKCE verifier");
      return verifier;
    },
    saveCodeVerifier: (value) => {
      verifier = value;
    },
    discoveryState: () => discovery,
    saveDiscoveryState: (value) => {
      const metadata = value.authorizationServerMetadata;
      if (!metadata?.authorization_endpoint || !metadata.token_endpoint)
        throw new LoginError(
          "Provider has no usable OAuth metadata; check its documented client setup",
        );
      for (const address of [
        metadata.authorization_endpoint,
        metadata.token_endpoint,
        metadata.registration_endpoint,
      ].filter(Boolean)) {
        const url = new URL(address as string);
        url.search = "";
        endpoint(url.href);
      }
      if (!metadata.code_challenge_methods_supported?.includes("S256"))
        throw new LoginError("Provider does not advertise S256 PKCE support");
      if (
        !client &&
        !(options.clientMetadataUrl && metadata.client_id_metadata_document_supported) &&
        !metadata.registration_endpoint
      )
        throw new LoginError(
          "Provider requires client setup: supply --client-id or a supported --client-metadata-url",
        );
      discovery = value;
      notify(`OAuth issuer: ${new URL(metadata.issuer).origin}. Callback: ${callback.redirectUrl}`);
      if (!client && !(options.clientMetadataUrl && metadata.client_id_metadata_document_supported))
        notify(
          `Registering test client ${provider.clientMetadata.client_name}; remove it in the provider UI after testing.`,
        );
    },
    redirectToAuthorization: async (url) => {
      if (callback.signal?.aborted) throw new LoginError("OAuth login cancelled or timed out");
      if (browserOpened) throw new LoginError("OAuth attempted an unexpected second login");
      browserOpened = true;
      // URL has state and PKCE challenge, never tokens, client secret or PKCE verifier.
      notify(
        `Complete login and consent in your browser. If it does not open, visit:\n${url.href}`,
      );
      await (deps.open ?? openBrowser)(url);
    },
    // A measurement must not silently register again or retry a rejected code.
    invalidateCredentials: () => {
      throw new LoginError(
        "OAuth credentials or grant were rejected; check the provider client setup and retry explicitly",
      );
    },
  };
  try {
    let challenge = await fetchFn(target, { headers: { "MCP-Protocol-Version": PROTOCOL } });
    if (challenge.status === 405)
      challenge = await fetchFn(target, {
        method: "POST",
        headers: { "content-type": "application/json", "MCP-Protocol-Version": PROTOCOL },
        body: "{}",
      });
    const discovered = extractWWWAuthenticateParams(challenge);
    const authOptions = {
      serverUrl: target,
      fetchFn,
      resourceMetadataUrl: discovered.resourceMetadataUrl,
      scope: options.scope ?? discovered.scope,
    };
    if ((await auth(provider, authOptions)) !== "REDIRECT")
      throw new LoginError("Expected interactive OAuth login");
    const params = callbackParams(await callback.result, callback.redirectUrl, state);
    if (
      (await auth(provider, {
        ...authOptions,
        authorizationCode: params.get("code") as string,
        iss: params.get("iss") ?? undefined,
      })) !== "AUTHORIZED"
    )
      throw new LoginError("OAuth code exchange did not complete");
    const acquired = await provider.tokens();
    if (
      !acquired ||
      typeof acquired !== "object" ||
      !("access_token" in acquired) ||
      acquired.token_type.toLowerCase() !== "bearer"
    )
      throw new LoginError("Provider did not return a supported Bearer access token");
    notify("Login complete. Running the selected checks; credentials will not be saved.");
    return acquired.access_token;
  } catch (error) {
    if (error instanceof LoginError) throw error;
    // SDK errors may contain raw response bodies, credentials or callback parameters.
    throw new LoginError(
      "OAuth login failed. Check provider client/redirect settings, issuer metadata and requested scopes; no credentials were saved",
    );
  } finally {
    callback.close();
    tokens = undefined;
    client = undefined;
    verifier = undefined;
    discovery = undefined;
  }
}
