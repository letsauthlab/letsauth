import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import https from "node:https";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pinnedRequest } from "@/scanner/transport";

const url = "https://mcp.example.com/mcp";
const options = () => ({ method: "GET", headers: {}, signal: AbortSignal.timeout(1000) });
afterEach(() => vi.restoreAllMocks());

describe("DNS-pinned TLS transport", () => {
  it.each(["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"])(
    "pins %s without a second DNS resolution",
    async (address) => {
      const resolver = vi.fn().mockResolvedValueOnce([address]).mockResolvedValue(["127.0.0.1"]);
      const request = vi.spyOn(https, "request").mockImplementation((input, opts, cb) => {
        expect(input).toBe(url); // hostname remains available for Host, SNI and certificate checks
        expect(opts).toMatchObject({ agent: false });
        expect(opts?.rejectUnauthorized).not.toBe(false);
        const lookup = opts?.lookup;
        expect(lookup).toBeDefined();
        lookup?.("mcp.example.com", { all: true }, (err, answers) => {
          expect(err).toBeNull();
          expect(answers).toEqual([{ address, family: address.includes(":") ? 6 : 4 }]);
        });
        lookup?.("mcp.example.com", {}, (err, answer) => {
          expect(err).toBeNull();
          expect(answer).toBe(address);
        });
        const incoming = Object.assign(Readable.from([Buffer.from("{}")]), {
          headers: {},
          statusCode: 200,
        });
        queueMicrotask(() => cb?.(incoming as IncomingMessage));
        return Object.assign(new EventEmitter(), { end() {} }) as ReturnType<typeof https.request>;
      });
      const response = await pinnedRequest(url, options(), resolver);
      expect(await response.json()).toEqual({});
      expect(resolver).toHaveBeenCalledTimes(1);
      expect(request).toHaveBeenCalledTimes(1);
    },
  );

  it.each([["127.0.0.1"], ["93.184.216.34", "169.254.169.254"], ["::1"]])(
    "refuses DNS answers %j before opening a socket",
    async (...addresses) => {
      const request = vi.spyOn(https, "request");
      await expect(pinnedRequest(url, options(), async () => addresses)).rejects.toMatchObject({
        code: "REFUSED",
      });
      expect(request).not.toHaveBeenCalled();
    },
  );
});
