/** Publish a dedicated site namespace: upload first, then remove stale files. */
export const MANIFEST = ".deployment-manifest.json";
const LEGACY_ROOTS = new Set([
  "_astro",
  "pagefind",
  "mcp",
  "atlas",
  "scanner",
  "standards",
  "explorer",
  "breaches",
  "about",
  "contribute",
  "privacy",
  "imprint",
  "disclaimer",
  "accessibility",
  "made-in-europe",
  "brand",
  ".well-known",
]);

export function safePath(path: string): boolean {
  return (
    path.length > 0 &&
    !/[\\?#]/.test(path) &&
    [...path].every((character) => character.charCodeAt(0) >= 32) &&
    path.split("/").every((part) => part !== "" && part !== "." && part !== "..")
  );
}

/** First deployment also cleans the historic site namespaces; unrelated storage is preserved. */
export function ownedPath(path: string): boolean {
  return (
    safePath(path) &&
    (LEGACY_ROOTS.has(path.split("/")[0] ?? "") ||
      /^(?:index|404)\.html$|^sitemap.*\.xml$|^(?:robots\.txt|favicon\.svg|og\.png|apple-touch-icon\.png)$/.test(
        path,
      ))
  );
}

export async function publish(options: {
  files: Map<string, Uint8Array>;
  base: string;
  key: string;
  fetch?: typeof fetch;
}): Promise<{ uploaded: number; deleted: number }> {
  const request = options.fetch ?? fetch;
  const base = `${options.base.replace(/\/+$/, "")}/`;
  const url = (path: string) => base + path.split("/").map(encodeURIComponent).join("/");
  const send = async (path: string, method = "GET", body?: Uint8Array) => {
    const response = await request(url(path), {
      method,
      body: body as BodyInit | undefined,
      redirect: "error",
      headers: {
        AccessKey: options.key,
        ...(body ? { "Content-Type": "application/octet-stream" } : {}),
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok && !(method === "GET" && path === MANIFEST && response.status === 404)) {
      throw new Error(`Storage ${method} ${path || "/"}: HTTP ${response.status}`);
    }
    return response;
  };
  for (const path of options.files.keys()) {
    if (!safePath(path) || path === MANIFEST) throw new Error(`Invalid deployment path: ${path}`);
  }
  const previous = await send(MANIFEST);
  const managed = new Set<string>();
  if (previous.ok) {
    const manifest: unknown = await previous.json();
    if (!Array.isArray(manifest) || !manifest.every((p) => typeof p === "string" && safePath(p))) {
      throw new Error("Invalid previous deployment manifest; refusing cleanup");
    }
    for (const path of manifest) managed.add(path);
  }
  // List before mutating, and validate API-provided names before constructing another URL.
  const remote: string[] = [];
  async function walk(prefix: string): Promise<void> {
    const entries: unknown = await (await send(prefix)).json();
    if (!Array.isArray(entries)) throw new Error("Invalid storage listing");
    for (const entry of entries) {
      if (
        !entry ||
        typeof entry.ObjectName !== "string" ||
        entry.ObjectName.includes("/") ||
        !safePath(entry.ObjectName) ||
        typeof entry.IsDirectory !== "boolean"
      ) {
        throw new Error("Invalid storage entry");
      }
      const path = prefix + entry.ObjectName;
      if (entry.IsDirectory) await walk(`${path}/`);
      else remote.push(path);
    }
  }
  await walk("");
  const pending = [...options.files.entries()];
  // Wait for all in-flight uploads before returning a failure; never clean up a partial release.
  const workers = Array.from({ length: Math.min(8, pending.length) }, async () => {
    for (;;) {
      const file = pending.shift();
      if (!file) return;
      await send(file[0], "PUT", file[1]);
    }
  });
  const uploads = await Promise.allSettled(workers);
  const failure = uploads.find((r) => r.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
  let deleted = 0;
  for (const path of remote) {
    if (path !== MANIFEST && !options.files.has(path) && (managed.has(path) || ownedPath(path))) {
      await send(path, "DELETE");
      deleted++;
    }
  }
  await send(
    MANIFEST,
    "PUT",
    new TextEncoder().encode(JSON.stringify([...options.files.keys()].sort())),
  );
  return { uploaded: options.files.size, deleted };
}
