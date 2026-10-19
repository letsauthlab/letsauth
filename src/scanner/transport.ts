import https from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { Readable } from "node:stream";
import { defaultResolver, guardUrl, type Resolver } from "./guard";

/** Resolve once per hop. The socket uses only these validated addresses, never a second lookup. */
export async function pinnedRequest(
  input: string,
  options: { method: string; headers: Record<string, string>; signal: AbortSignal },
  resolve: Resolver = defaultResolver,
): Promise<Response> {
  let addresses: string[] = [];
  const guarded = await guardUrl(input, async (host) => {
    addresses = await resolve(host);
    return addresses;
  });
  if (!guarded.ok) throw Object.assign(new Error(guarded.reason), { code: "REFUSED" });
  options.signal.throwIfAborted();
  const lookup: LookupFunction = (_host, opts, callback) => {
    const answers = addresses.map((address) => ({ address, family: isIP(address) }));
    if (opts.all) callback(null, answers);
    else {
      const first = answers[0];
      if (!first) return callback(new Error("No validated DNS address"), "", 0);
      callback(null, first.address, first.family);
    }
  };
  return new Promise((resolveResponse, reject) => {
    // Keep the original hostname for Host, SNI and certificate verification. No pooled sockets
    // can bypass this hop's DNS validation. Redirects are handled by the caller.
    const request = https.request(
      guarded.url,
      {
        ...options,
        headers: { ...options.headers, "Accept-Encoding": "identity" },
        agent: false,
        lookup,
      },
      (incoming) => {
        try {
          const headers = new Headers();
          for (const [name, value] of Object.entries(incoming.headers)) {
            if (Array.isArray(value)) for (const part of value) headers.append(name, part);
            else if (value !== undefined) headers.set(name, value);
          }
          const status = incoming.statusCode ?? 502;
          // Response forbids bodies on these statuses, even an empty stream.
          const body = [204, 205, 304].includes(status) ? null : Readable.toWeb(incoming);
          if (body === null) incoming.resume();
          resolveResponse(
            new Response(body as ReadableStream<Uint8Array> | null, { status, headers }),
          );
        } catch (error) {
          incoming.destroy();
          reject(error);
        }
      },
    );
    request.on("error", reject);
    request.end();
  });
}
