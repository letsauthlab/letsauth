import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import type { RequestOptions } from "node:https";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("node:https", () => ({ request: mocks.request }));

import { nodeTransport } from "../../src/scanner/investigation/transport";

type FakeResponse = EventEmitter & {
  statusCode: number;
  headers: Record<string, string>;
  destroy: ReturnType<typeof vi.fn>;
};
let callback: (response: IncomingMessage) => void;
let requestOptions: RequestOptions;
let req: EventEmitter & { end: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> };

function respond(
  status: number,
  headers: Record<string, string> = { "content-type": "application/json" },
): FakeResponse {
  const res = Object.assign(new EventEmitter(), { statusCode: status, headers, destroy: vi.fn() });
  callback(res as unknown as IncomingMessage);
  return res;
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.lookup.mockReset().mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
  req = Object.assign(new EventEmitter(), { end: vi.fn(), destroy: vi.fn() });
  mocks.request
    .mockReset()
    .mockImplementation((_url: URL, options: RequestOptions, cb: typeof callback) => {
      requestOptions = options;
      callback = cb;
      return req;
    });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("active HTTPS transport", () => {
  it("validates DNS in socket lookup and returns exactly the pinned public address", async () => {
    const pending = nodeTransport()({ url: "https://lab.example.com/mcp", method: "GET" });
    const cb = vi.fn();
    requestOptions.lookup?.("lab.example.com", { all: true }, cb);
    await Promise.resolve();
    await Promise.resolve();
    expect(cb).toHaveBeenCalledWith(null, [{ address: "8.8.8.8", family: 4 }]);
    expect(requestOptions.agent).toBe(false);
    respond(401);
    await expect(pending).resolves.toMatchObject({ status: 401 });
  });
  it("rejects a mixed DNS answer including a private address", async () => {
    mocks.lookup.mockResolvedValue([
      { address: "8.8.8.8", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);
    const pending = nodeTransport()({ url: "https://lab.example.com/mcp", method: "GET" });
    const cb = vi.fn();
    requestOptions.lookup?.("lab.example.com", {}, cb);
    await Promise.resolve();
    await Promise.resolve();
    expect(cb.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    req.emit("error", new Error("sensitive DNS data"));
    await expect(pending).resolves.toEqual({ status: null, error: "network" });
  });
  it("does not follow redirects or retain location/cookies", async () => {
    const pending = nodeTransport()({
      url: "https://lab.example.com/mcp",
      method: "POST",
      headers: { Authorization: "Bearer secret" },
      body: {},
    });
    respond(307, { location: "https://other.example.com/steal", "set-cookie": "secret" });
    expect(await pending).toEqual({ status: 307, error: "redirect" });
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
  it("bounds streaming bodies and rejects oversized responses", async () => {
    const pending = nodeTransport(100, 8)({ url: "https://lab.example.com/mcp", method: "GET" });
    const res = respond(200);
    res.emit("data", Buffer.from("123456789"));
    expect(await pending).toEqual({ status: 200, error: "too-large" });
    expect(res.destroy).toHaveBeenCalled();
  });
  it("times out a stalled body after headers rather than hanging", async () => {
    const pending = nodeTransport(100)({ url: "https://lab.example.com/mcp", method: "GET" });
    respond(200);
    await vi.advanceTimersByTimeAsync(100);
    expect(await pending).toEqual({ status: 200, error: "timeout" });
    expect(req.destroy).toHaveBeenCalled();
  });
  it("finishes matching SSE before a long-lived connection closes", async () => {
    const pending = nodeTransport()({
      url: "https://lab.example.com/mcp",
      method: "POST",
      body: {},
      rpcId: 2,
    });
    const res = respond(200, { "content-type": "text/event-stream" });
    res.emit("data", Buffer.from('data: {"jsonrpc":"2.0","id":2,"result":'));
    res.emit("data", Buffer.from('{"tools":[]}}\r\n\r\n'));
    expect(await pending).toMatchObject({ status: 200, json: { id: 2, result: { tools: [] } } });
    expect(res.destroy).toHaveBeenCalled();
  });
  it("catches aborted streams and malformed JSON without exposing body/error text", async () => {
    const pending = nodeTransport()({ url: "https://lab.example.com/mcp", method: "GET" });
    const res = respond(200);
    res.emit("data", Buffer.from("secret token"));
    res.emit("end");
    expect(await pending).toEqual({ status: 200, error: "invalid-response" });
    const again = nodeTransport()({ url: "https://lab.example.com/mcp", method: "GET" });
    respond(200).emit("aborted");
    expect(await again).toEqual({ status: 200, error: "network" });
  });
  it("does not read denial bodies or retain arbitrary authentication fields", async () => {
    const pending = nodeTransport()({ url: "https://lab.example.com/mcp", method: "GET" });
    const res = respond(403, {
      "www-authenticate":
        'Bearer error="insufficient_scope", scope="private-scope", realm="private-realm"',
    });
    expect(await pending).toEqual({
      status: 403,
      authError: "insufficient_scope",
      hasScopeChallenge: true,
    });
    expect(res.listenerCount("data")).toBe(0);
  });
  it.each(["https://127.0.0.1/", "https://[::1]/", "https://localhost/", "https://a.internal/"])(
    "refuses non-public hostname %s before opening a socket",
    async (url) => {
      await expect(nodeTransport()({ url, method: "GET" })).rejects.toThrow();
      expect(mocks.request).not.toHaveBeenCalled();
    },
  );
});
