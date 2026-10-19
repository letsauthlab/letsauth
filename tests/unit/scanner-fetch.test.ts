import { afterEach, describe, expect, it, vi } from "vitest";
import { currentRevision } from "@/lib/atlas";
import { getDataset } from "@/lib/data";
import { runChecks } from "@/scanner/checks";
import { nodeFetcher, recordingFetcher } from "@/scanner/fetch";
import { guardUrl } from "@/scanner/guard";
import { probe } from "@/scanner/probe";
import { passiveFeatures } from "@/scanner/report";
import { pinnedRequest } from "@/scanner/transport";

vi.mock("@/scanner/transport", () => ({ pinnedRequest: vi.fn() }));
const request = vi.mocked(pinnedRequest);
const url = "https://mcp.example.com/mcp";
afterEach(() => vi.resetAllMocks());

describe("bounded fetch failures", () => {
  it.each(["json", "challenge", "challenge-post"] as const)(
    "records a 429 as uncertainty in %s mode",
    async (mode) => {
      request.mockResolvedValue(new Response(null, { status: 429 }));
      const live = await nodeFetcher()(url, mode);
      const recorded = await recordingFetcher({
        target: url,
        responses: { [url]: { status: 429 } },
      })(url, mode);
      for (const result of [live, recorded])
        expect(result).toMatchObject({ kind: "error", status: 429, error: "rate-limit" });
    },
  );
  it.each([
    new DOMException("expired", "TimeoutError"),
    Object.assign(new Error("reset"), { code: "ECONNRESET" }),
  ])("records stream failure after headers without throwing", async (error) => {
    request.mockResolvedValue(
      new Response(
        new ReadableStream({
          start(c) {
            c.error(error);
          },
        }),
        { status: 200 },
      ),
    );
    expect(await nodeFetcher()(url)).toMatchObject({
      kind: "error",
      status: 200,
      error: error.name === "TimeoutError" ? "timeout" : "connection",
    });
  });
  it("continues to the root discovery fallback when the path response body breaks", async () => {
    request
      .mockResolvedValueOnce(
        new Response(
          new ReadableStream({
            start(c) {
              c.error(new Error("reset"));
            },
          }),
        ),
      )
      .mockResolvedValueOnce(Response.json({ resource: new URL(url).origin }))
      .mockResolvedValue(new Response(null, { status: 401 }));
    const result = await probe(url, { fetcher: nodeFetcher() });
    expect(result.prm?.location).toBe("root");
    expect(result.requests[0]).toMatchObject({ status: 200, error: "connection" });
  });
  it("rejects a redirect after DNS changes to a private address", async () => {
    request.mockResolvedValue(
      new Response(null, { status: 302, headers: { Location: "/metadata" } }),
    );
    const fetcher = nodeFetcher({ guard: (u) => guardUrl(u, async () => ["127.0.0.1"]) });
    expect(await fetcher(url)).toMatchObject({ kind: "error", error: "redirect" });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("cancels a body that exceeds the cap", async () => {
    request.mockResolvedValue(new Response("12345"));
    expect(await nodeFetcher({ maxBytes: 4 })(url)).toMatchObject({
      kind: "error",
      error: "too-large",
    });
  });
});

it("keeps AS-dependent checks unknown when every discovery candidate is rate limited", async () => {
  const fetcher = recordingFetcher({
    target: url,
    responses: {
      "https://mcp.example.com/.well-known/oauth-protected-resource/mcp": {
        body: { resource: url, authorization_servers: ["https://auth.example.com"] },
      },
      "https://auth.example.com/.well-known/oauth-authorization-server": { status: 429 },
      "https://auth.example.com/.well-known/openid-configuration": { status: 429 },
    },
  });
  const result = await probe(url, { fetcher });
  const data = getDataset();
  const checks = runChecks(result, passiveFeatures(data, currentRevision(data).id));
  expect(result.asOutcome).toBe("error");
  for (const check of checks.filter((c) => c.feature.id.startsWith("mcp.as.")))
    expect(check.outcome.status).toBe("unknown");
});
