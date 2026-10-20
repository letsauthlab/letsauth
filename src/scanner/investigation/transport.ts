import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import { isPublicAddress } from "../guard";
import { endpoint, VERSION } from "./model";

export interface Request {
  url: string;
  method: "GET" | "POST" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
  rpcId?: number;
  /** OAuth only: form bodies and discovery challenge headers stay in process memory. */
  oauth?: boolean;
}
export interface Response {
  status: number | null;
  json?: unknown;
  session?: string;
  authError?: "invalid_token" | "insufficient_scope" | "invalid_request";
  hasScopeChallenge?: boolean;
  wwwAuthenticate?: string;
  error?: "network" | "timeout" | "too-large" | "redirect" | "invalid-response" | "refused";
}
export type Transport = (input: Request) => Promise<Response>;
export function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Also exclude translation/tunnelling ranges: accept only ordinary global IPv6 unicast. */
export function publicAddress(address: string): boolean {
  return (
    isPublicAddress(address) &&
    (isIP(address) === 4 || (/^[23][0-9a-f]{3}:/i.test(address) && !/^200[12]:/i.test(address)))
  );
}

export async function publicLookup(host: string): Promise<{ address: string; family: number }> {
  const addresses = await lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw new Error("non-public DNS result");
  return addresses[0] as { address: string; family: number };
}

/** Only select a complete SSE event with the matching response ID; ignore notifications. */
export function sseResponse(text: string, id: number): unknown {
  const events = text.replace(/\r\n/g, "\n").split("\n\n");
  events.pop(); // unfinished event is never evidence
  for (const event of events) {
    const body = event
      .split("\n")
      .filter((s) => s.startsWith("data:"))
      .map((s) => s.slice(5).replace(/^ /, ""))
      .join("\n");
    try {
      const value: unknown = JSON.parse(body);
      if (
        object(value) &&
        value.jsonrpc === "2.0" &&
        value.id === id &&
        ("result" in value || "error" in value)
      )
        return value;
    } catch {
      /* comments/keepalives and unrelated messages are not responses */
    }
  }
  return undefined;
}

export function authSummary(
  header: string | undefined,
): Pick<Response, "authError" | "hasScopeChallenge"> {
  // Keep only protocol vocabulary, never arbitrary header text or parameter values.
  if (!header || !/^Bearer\s/i.test(header)) return {};
  const value =
    /(?:^|[,\s])error\s*=\s*"?(invalid_token|insufficient_scope|invalid_request)(?:"|\s|,|$)/i
      .exec(header)?.[1]
      ?.toLowerCase();
  return {
    ...(value ? { authError: value as Response["authError"] } : {}),
    hasScopeChallenge: /(?:^|[,\s])scope\s*=\s*"[^"\r\n]+"/i.test(header),
  };
}

/** A separate active transport. No redirect/retry; credentials never leave the explicit URL.
 * DNS is checked in the actual socket lookup and that exact address is used for the connection.
 * The total timer covers DNS, connection, headers and streaming body. No raw errors escape.
 */
export function nodeTransport(timeoutMs = 10_000, maxBytes = 262_144): Transport {
  return async (input) => {
    const url = new URL(input.url);
    const checked = new URL(url);
    if (input.oauth) checked.search = "";
    endpoint(checked.href);
    if (
      isIP(url.hostname) ||
      url.hostname.includes(":") ||
      !url.hostname.includes(".") ||
      /\.(?:localhost|local|internal|lan|home\.arpa)$/i.test(url.hostname)
    )
      throw new Error("a public DNS hostname is required");
    const body =
      input.body === undefined
        ? undefined
        : input.oauth && typeof input.body === "string"
          ? input.body
          : JSON.stringify(input.body);
    if (body && Buffer.byteLength(body) > maxBytes)
      throw new Error("request body exceeds byte limit");
    return new Promise<Response>((resolve) => {
      let done = false;
      let status: number | null = null;
      const finish = (result: Response) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(result);
        req.destroy();
      };
      const req = request(
        url,
        {
          method: input.method,
          agent: false,
          lookup: (hostname, options, callback) => {
            publicLookup(hostname).then(
              (a) => (options.all ? callback(null, [a]) : callback(null, a.address, a.family)),
              () => callback(new Error("DNS refused"), "", 4),
            );
          },
          headers: {
            Accept: "application/json, text/event-stream",
            "User-Agent": VERSION,
            ...input.headers,
            ...(body === undefined
              ? {}
              : {
                  "Content-Type": input.oauth
                    ? (input.headers?.["content-type"] ?? "application/json")
                    : "application/json",
                  "Content-Length": String(Buffer.byteLength(body)),
                }),
          },
        },
        (res) => {
          status = res.statusCode ?? null;
          if (status !== null && status >= 300 && status < 400) {
            res.destroy();
            finish({ status, error: "redirect" });
            return;
          }
          const summary = authSummary(res.headers["www-authenticate"]);
          const base: Response = { status, ...summary };
          if (input.oauth && res.headers["www-authenticate"])
            base.wwwAuthenticate = res.headers["www-authenticate"];
          const session = res.headers["mcp-session-id"];
          if (typeof session === "string" && /^[\x21-\x7e]{1,1024}$/.test(session))
            base.session = session;
          // Error/notification bodies cannot provide operation success and may contain secrets.
          if (
            status === null ||
            (!input.oauth && (status < 200 || status >= 300)) ||
            status === 202 ||
            input.method === "DELETE"
          ) {
            res.destroy();
            finish(base);
            return;
          }
          const type = res.headers["content-type"]?.split(";")[0]?.trim().toLowerCase();
          if (input.oauth && status >= 400 && type !== "application/json") {
            res.destroy();
            finish(base);
            return;
          }
          if (type !== "application/json" && type !== "text/event-stream") {
            res.destroy();
            finish({ ...base, error: "invalid-response" });
            return;
          }
          const chunks: Buffer[] = [];
          let size = 0;
          res.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > maxBytes) {
              res.destroy();
              finish({ ...base, error: "too-large" });
              return;
            }
            chunks.push(chunk);
            if (type === "text/event-stream" && input.rpcId !== undefined) {
              const json = sseResponse(Buffer.concat(chunks).toString("utf8"), input.rpcId);
              if (json !== undefined) {
                finish({ ...base, json });
                res.destroy();
              }
            }
          });
          res.on("end", () => {
            if (done) return;
            if (type === "text/event-stream") {
              finish({ ...base, error: "invalid-response" });
              return;
            }
            try {
              finish({ ...base, json: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
            } catch {
              finish({ ...base, error: "invalid-response" });
            }
          });
          res.on("error", () => finish({ ...base, error: "network" }));
          res.on("aborted", () => finish({ ...base, error: "network" }));
        },
      );
      const timer = setTimeout(() => finish({ status, error: "timeout" }), timeoutMs);
      req.on("error", () => finish({ status, error: "network" }));
      req.end(body);
    });
  };
}
