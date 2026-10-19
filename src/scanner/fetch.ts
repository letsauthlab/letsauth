import type { Guard, Resolver } from "./guard";
import { pinnedRequest } from "./transport";
import { USER_AGENT } from "./version";

/**
 * The one way the scanner talks to the network (004 research R2): GET, HTTPS, a timeout, a body
 * cap, redirects followed only to the same host over HTTPS. `Fetcher` is injected so the whole
 * pipeline runs over recorded responses in tests, which must not touch the network.
 *
 * Three modes. "json" (the default) reads a metadata document. "challenge" (008) is a request to
 * the MCP endpoint itself: the same GET with the Accept header a client sends, no credentials,
 * no body; only the status and the WWW-Authenticate header are read, and the response body is
 * cancelled before a byte of it is consumed. "challenge-post" (010) is the same request as a
 * POST with an empty body and the JSON content type: it carries no JSON-RPC message, so the
 * server has nothing to act on, but a streamable HTTP server that answers GET with 405 (as the
 * transport allows) authenticates it like a client's first call.
 */

export type FetchError =
  | "timeout"
  | "connection"
  | "tls"
  | "redirect"
  | "not-json"
  | "too-large"
  | "refused"
  | "server-error"
  | "rate-limit";

/**
 * json mode — found: 2xx and a JSON object. absent: a definite answer without one (4xx, or 2xx
 * that is not JSON). error: no answer to judge by.
 * challenge mode — found: a 401 (a challenge to read, header present or not). absent: any other
 * definite status. error: no answer to judge by.
 */
export type FetchKind = "found" | "absent" | "error";

export type FetchMode = "json" | "challenge" | "challenge-post";

export type FetchMethod = "GET" | "POST";

/** The HTTP method a mode sends. */
export function methodOf(mode: FetchMode): FetchMethod {
  return mode === "challenge-post" ? "POST" : "GET";
}

/** What an MCP client sends on its first request; both transports accept it. */
export const CHALLENGE_ACCEPT = "application/json, text/event-stream";

export interface FetchResult {
  url: string;
  /** Absent means GET. */
  method?: FetchMethod;
  kind: FetchKind;
  /** HTTP status, or null when no response arrived. */
  status: number | null;
  contentType?: string;
  /** The parsed JSON object when `kind` is "found" in json mode. */
  json?: Record<string, unknown>;
  /** The WWW-Authenticate header as received, in challenge mode, when the server sent one. */
  wwwAuthenticate?: string;
  error?: FetchError;
  /** One line a reader can act on: the redirect target, the exception name, the byte count. */
  detail?: string;
}

export type Fetcher = (url: string, mode?: FetchMode) => Promise<FetchResult>;

export interface NodeFetcherOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  /** Re-run on every redirect target; the initial URL is guarded by the caller. */
  guard?: Guard;
  /** DNS answers are validated and pinned to the actual TLS connection. */
  resolve?: Resolver;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Classifies a thrown fetch error by its cause, without depending on undici's types. */
function classify(err: unknown): { error: FetchError; detail: string } {
  const e = err as {
    name?: string;
    code?: string;
    cause?: { code?: string; message?: string };
    message?: string;
  };
  if (e?.name === "TimeoutError" || e?.name === "AbortError")
    return { error: "timeout", detail: "timed out" };
  const code = e?.cause?.code ?? e?.code ?? "";
  if (code === "REFUSED") return { error: "refused", detail: e.message ?? "refused" };
  if (/CERT|TLS|SSL|EPROTO|UNABLE_TO_VERIFY|DEPTH_ZERO|SELF_SIGNED|HOSTNAME_MISMATCH/i.test(code)) {
    return { error: "tls", detail: code };
  }
  return { error: "connection", detail: code || e?.cause?.message || e?.message || "failed" };
}

async function readCapped(res: Response, maxBytes: number): Promise<string | undefined> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      return undefined;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** A guarded, DNS-pinned HTTPS transport with bounded response reads. */
export function nodeFetcher(options: NodeFetcherOptions = {}): Fetcher {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxBytes = options.maxBytes ?? 1_048_576;
  const maxRedirects = options.maxRedirects ?? 3;
  return async (start, mode = "json") => {
    let url = start;
    const method = methodOf(mode);
    const tag = (r: FetchResult): FetchResult => (method === "POST" ? { ...r, method } : r);
    const headers: Record<string, string> = {
      Accept: mode === "json" ? "application/json" : CHALLENGE_ACCEPT,
      "User-Agent": USER_AGENT,
    };
    // an empty body with the JSON content type: not a JSON-RPC message, nothing to act on
    if (method === "POST") {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = "0";
    }
    for (let hop = 0; ; hop += 1) {
      let res: Response;
      try {
        res = await pinnedRequest(
          url,
          {
            method,
            headers,
            signal: AbortSignal.timeout(timeoutMs),
          },
          options.resolve,
        );
      } catch (err) {
        return tag({ url, kind: "error", status: null, ...classify(err) });
      }
      const status = res.status;
      const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() || undefined;
      if (status >= 300 && status < 400) {
        const location = res.headers.get("location");
        await res.body?.cancel().catch(() => {});
        if (!location)
          return tag({
            url,
            kind: "error",
            status,
            error: "redirect",
            detail: "no Location header",
          });
        let next: URL;
        try {
          next = new URL(location, url);
        } catch {
          return tag({
            url,
            kind: "error",
            status,
            error: "redirect",
            detail: `bad Location "${location}"`,
          });
        }
        const from = new URL(url);
        if (next.protocol !== "https:" || next.host !== from.host || hop >= maxRedirects) {
          return tag({
            url,
            kind: "error",
            status,
            error: "redirect",
            detail: `not followed to ${next.href}`,
          });
        }
        if (options.guard) {
          const g = await options.guard(next.href);
          if (!g.ok)
            return tag({
              url,
              kind: "error",
              status,
              error: "redirect",
              detail: `not followed to ${next.href}: ${g.reason}`,
            });
        }
        url = next.href;
        continue;
      }
      if (status === 429 || status >= 500) {
        await res.body?.cancel().catch(() => {});
        return tag({
          url,
          kind: "error",
          status,
          contentType,
          error: status === 429 ? "rate-limit" : "server-error",
          detail: `HTTP ${status}`,
        });
      }
      if (mode !== "json") {
        // the endpoint itself: headers only, the body is never read (008 FR-001)
        await res.body?.cancel().catch(() => {});
        return tag(challengeResult(url, status, contentType, res.headers.get("www-authenticate")));
      }
      if (status < 200 || status >= 300) {
        await res.body?.cancel().catch(() => {});
        return { url, kind: "absent", status, contentType };
      }
      let text: string | undefined;
      try {
        text = await readCapped(res, maxBytes);
      } catch (err) {
        return { url, kind: "error", status, contentType, ...classify(err) };
      }
      if (text === undefined)
        return {
          url,
          kind: "error",
          status,
          contentType,
          error: "too-large",
          detail: `body over ${maxBytes} bytes`,
        };
      try {
        const json: unknown = JSON.parse(text);
        if (!isObject(json))
          return {
            url,
            kind: "absent",
            status,
            contentType,
            error: "not-json",
            detail: "JSON but not an object",
          };
        return { url, kind: "found", status, contentType, json };
      } catch {
        return {
          url,
          kind: "absent",
          status,
          contentType,
          error: "not-json",
          detail: `${contentType ?? "unknown content type"}, not JSON`,
        };
      }
    }
  };
}

/** The result of the endpoint request from its status and challenge header. */
function challengeResult(
  url: string,
  status: number,
  contentType: string | undefined,
  header: string | null | undefined,
): FetchResult {
  const out: FetchResult = { url, kind: status === 401 ? "found" : "absent", status };
  if (contentType) out.contentType = contentType;
  if (header) out.wwwAuthenticate = header;
  return out;
}

/** A recorded response for tests and the quickstart fixture server. */
export interface FixtureResponse {
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
  error?: "timeout" | "connection" | "tls";
}

export interface Fixture {
  /** The MCP server URL the fixture describes. */
  target: string;
  /**
   * URL → response. A URL not listed answers 404. A POST to the endpoint reads the entry keyed
   * `POST <url>` when there is one, else the URL's own entry.
   */
  responses: Record<string, FixtureResponse>;
}

export interface RecordingFetcher extends Fetcher {
  /** Every URL asked, in order. */
  requests: string[];
}

/** Answers from a fixture and records every URL asked; never touches the network. */
export function recordingFetcher(fixture: Fixture): RecordingFetcher {
  const requests: string[] = [];
  const fetcher = (async (url: string, mode: FetchMode = "json"): Promise<FetchResult> => {
    const method = methodOf(mode);
    requests.push(method === "POST" ? `POST ${url}` : url);
    const tag = (r: FetchResult): FetchResult => (method === "POST" ? { ...r, method } : r);
    const r =
      (method === "POST" ? fixture.responses[`POST ${url}`] : undefined) ?? fixture.responses[url];
    if (!r) return tag({ url, kind: "absent", status: 404 });
    if (r.error) {
      const detail =
        r.error === "timeout"
          ? "timed out"
          : r.error === "tls"
            ? "CERT_HAS_EXPIRED"
            : "ECONNREFUSED";
      return tag({ url, kind: "error", status: null, error: r.error, detail });
    }
    const status = r.status ?? 200;
    const contentType = r.headers?.["content-type"]?.split(";")[0]?.trim();
    if (status >= 300 && status < 400) {
      return tag({
        url,
        kind: "error",
        status,
        error: "redirect",
        detail: `not followed to ${r.headers?.location ?? "?"}`,
      });
    }
    if (status === 429 || status >= 500)
      return tag({
        url,
        kind: "error",
        status,
        contentType,
        error: status === 429 ? "rate-limit" : "server-error",
        detail: `HTTP ${status}`,
      });
    if (mode !== "json")
      return tag(challengeResult(url, status, contentType, r.headers?.["www-authenticate"]));
    if (status < 200 || status >= 300) return { url, kind: "absent", status, contentType };
    const body = typeof r.body === "string" ? safeParse(r.body) : r.body;
    if (!isObject(body))
      return {
        url,
        kind: "absent",
        status,
        contentType,
        error: "not-json",
        detail: `${contentType ?? "unknown content type"}, not JSON`,
      };
    return { url, kind: "found", status, contentType, json: body };
  }) as RecordingFetcher;
  fetcher.requests = requests;
  return fetcher;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
