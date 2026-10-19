import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createServer: vi.fn() }));
vi.mock("node:http", () => ({ createServer: mocks.createServer }));

import { listenForCallback } from "../../src/scanner/investigation/oauth";

let handle: (
  req: { method: string; headers: { host: string }; url: string },
  res: ReturnType<typeof response>,
) => void;
let server: EventEmitter & {
  listen: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  closeAllConnections: ReturnType<typeof vi.fn>;
};
function response() {
  return { setHeader: vi.fn(), writeHead: vi.fn().mockReturnThis(), end: vi.fn() };
}
beforeEach(() => {
  vi.useFakeTimers();
  server = Object.assign(new EventEmitter(), {
    listen: vi.fn((_port, _host, cb) => cb()),
    close: vi.fn(),
    closeAllConnections: vi.fn(),
  });
  mocks.createServer.mockImplementation((callback) => {
    handle = callback;
    return server;
  });
});
afterEach(() => vi.useRealTimers());

describe("local OAuth callback listener", () => {
  it("binds loopback, ignores invalid requests and accepts only one matching callback", async () => {
    const callback = await listenForCallback(8765, "expected-state");
    try {
      expect(server.listen).toHaveBeenCalledWith(8765, "127.0.0.1", expect.any(Function));
      for (const request of [
        {
          method: "POST",
          headers: { host: "127.0.0.1:8765" },
          url: "/callback?state=expected-state&code=test",
        },
        {
          method: "GET",
          headers: { host: "evil.example" },
          url: "/callback?state=expected-state&code=test",
        },
        {
          method: "GET",
          headers: { host: "127.0.0.1:8765" },
          url: "/callback?state=wrong&code=test",
        },
        { method: "GET", headers: { host: "127.0.0.1:8765" }, url: "http://%" },
      ]) {
        const res = response();
        handle(request, res);
        expect(res.writeHead).toHaveBeenCalledWith(400);
      }
      const request = {
        method: "GET",
        headers: { host: "127.0.0.1:8765" },
        url: "/callback?state=expected-state&code=test",
      };
      const res = response();
      handle(request, res);
      expect((await callback.result).searchParams.get("code")).toBe("test");
      expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
      const replay = response();
      handle(request, replay);
      expect(replay.writeHead).toHaveBeenCalledWith(400);
    } finally {
      callback.close();
    }
    expect(server.close).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("rejects a provider cancellation without echoing the provider description", async () => {
    const callback = await listenForCallback(8765, "expected-state");
    try {
      const rejected = expect(callback.result).rejects.toThrow("denied");
      const res = response();
      handle(
        {
          method: "GET",
          headers: { host: "127.0.0.1:8765" },
          url: "/callback?state=expected-state&error=access_denied&error_description=private",
        },
        res,
      );
      await rejected;
      expect(JSON.stringify(res.end.mock.calls)).not.toContain("private");
    } finally {
      callback.close();
    }
  });
  it("times out and releases the listener", async () => {
    const callback = await listenForCallback(8765, "expected-state");
    const rejected = expect(callback.result).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(300_000);
    await rejected;
    expect(server.closeAllConnections).toHaveBeenCalled();
    expect(callback.signal?.aborted).toBe(true);
    expect(server.close).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cleans up when the port is unavailable", async () => {
    server.listen.mockImplementation(() => {
      server.emit("error", new Error("EADDRINUSE"));
    });
    await expect(listenForCallback(8765, "expected-state")).rejects.toThrow(
      "choose another callback port",
    );
    expect(server.close).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
