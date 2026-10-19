import { describe, expect, it } from "vitest";
import { MANIFEST, publish } from "../../scripts/lib/storage";

function storage(initial: Record<string, string>, fail?: string) {
  const remote = new Map(Object.entries(initial));
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const path = decodeURIComponent(String(input).replace("https://storage.example/zone/", ""));
    const method = init?.method ?? "GET";
    calls.push(`${method} ${path}`);
    expect(new Headers(init?.headers).get("AccessKey")).toBe("test-key");
    expect(init?.redirect).toBe("error");
    if (`${method} ${path}` === fail) return new Response(null, { status: 503 });
    if (method === "GET" && (path === "" || path.endsWith("/"))) {
      const names = new Map<string, boolean>();
      for (const key of remote.keys()) {
        if (!key.startsWith(path)) continue;
        const rest = key.slice(path.length);
        const name = rest.split("/")[0];
        if (name) names.set(name, rest.includes("/"));
      }
      return Response.json(
        [...names].map(([ObjectName, IsDirectory]) => ({ ObjectName, IsDirectory })),
      );
    }
    if (method === "GET")
      return new Response(remote.get(path), { status: remote.has(path) ? 200 : 404 });
    if (method === "PUT") remote.set(path, new TextDecoder().decode(init?.body as Uint8Array));
    if (method === "DELETE") remote.delete(path);
    return new Response(null, { status: 200 });
  };
  return { remote, calls, fetchImpl };
}
const files = new Map([["index.html", new TextEncoder().encode("new page")]]);

describe("site storage reconciliation", () => {
  it("removes withdrawn exports and obsolete assets on the first release, preserving unrelated files", async () => {
    const s = storage({
      "index.html": "old",
      "mcp/servers/withdrawn.json": "private now",
      "_astro/old.css": "css",
      "uploads/customer.pdf": "keep",
    });
    expect(
      await publish({
        files,
        base: "https://storage.example/zone",
        key: "test-key",
        fetch: s.fetchImpl,
      }),
    ).toEqual({ uploaded: 1, deleted: 2 });
    expect(s.remote.get("index.html")).toBe("new page");
    expect(s.remote.get("uploads/customer.pdf")).toBe("keep");
    expect(s.remote.has("mcp/servers/withdrawn.json")).toBe(false);
    expect(s.calls.indexOf("PUT index.html")).toBeLessThan(
      s.calls.indexOf("DELETE mcp/servers/withdrawn.json"),
    );
    expect(s.calls.at(-1)).toBe(`PUT ${MANIFEST}`);
  });
  it("uses the prior manifest to remove files outside historic namespaces", async () => {
    const s = storage({
      [MANIFEST]: JSON.stringify(["new-section/old.html"]),
      "new-section/old.html": "old",
      "new-section/manual.txt": "keep",
    });
    await publish({
      files,
      base: "https://storage.example/zone",
      key: "test-key",
      fetch: s.fetchImpl,
    });
    expect(s.remote.has("new-section/old.html")).toBe(false);
    expect(s.remote.get("new-section/manual.txt")).toBe("keep");
  });
  it("does not delete files or overwrite the manifest after an upload failure", async () => {
    const s = storage({ "mcp/old.json": "evidence", [MANIFEST]: "[]" }, "PUT index.html");
    await expect(
      publish({ files, base: "https://storage.example/zone", key: "test-key", fetch: s.fetchImpl }),
    ).rejects.toThrow("503");
    expect(s.calls.some((c) => c.startsWith("DELETE"))).toBe(false);
    expect(s.remote.get(MANIFEST)).toBe("[]");
  });
  it("fails before mutation on a malformed manifest", async () => {
    const s = storage({ [MANIFEST]: '["../outside"]' });
    await expect(
      publish({ files, base: "https://storage.example/zone", key: "test-key", fetch: s.fetchImpl }),
    ).rejects.toThrow("Invalid previous");
    expect(s.calls.every((c) => c.startsWith("GET"))).toBe(true);
  });
  it("fails before mutation when a listing is unavailable", async () => {
    const s = storage({ "mcp/old.json": "old" }, "GET mcp/");
    await expect(
      publish({ files, base: "https://storage.example/zone", key: "test-key", fetch: s.fetchImpl }),
    ).rejects.toThrow("503");
    expect(s.calls.every((c) => c.startsWith("GET"))).toBe(true);
  });
});
