import { describe, expect, it } from "vitest";
import { type AnalyticsConfig, linkEvent, startAnalytics } from "@/lib/analytics";
import {
  type EdgeRule,
  edgeRules,
  MANAGED_PREFIX,
  syncEdgeRules,
} from "../../scripts/lib/bunny-edge-rules";

const config: AnalyticsConfig = {
  domain: "letsauth.eu",
  endpoint: "/r/e.json",
  host: "letsauth.eu",
  notFound: false,
};

function fakeWindow(opts: { prerendering?: boolean; hostname?: string; webdriver?: boolean } = {}) {
  const sent: { url: string; body: Record<string, unknown> }[] = [];
  const document = Object.assign(new EventTarget(), {
    prerendering: opts.prerendering ?? false,
    referrer: "https://example.org/",
  });
  const hostname = opts.hostname ?? "letsauth.eu";
  const win = Object.assign(new EventTarget(), {
    document,
    location: { hostname, href: `https://${hostname}/mcp/`, pathname: "/mcp/" },
    navigator: { webdriver: opts.webdriver ?? false },
    innerWidth: 1280,
    fetch: async (url: string, init: { body: string }) => {
      sent.push({ url, body: JSON.parse(init.body) });
      return new Response(null, { status: 202 });
    },
  });
  // biome-ignore lint/suspicious/noExplicitAny: a minimal stand-in for Window
  return { win: win as any, document, sent };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe("analytics", () => {
  it("records one pageview through the first-party endpoint", async () => {
    const { win, sent } = fakeWindow();
    expect(startAnalytics(win, config)).not.toBeNull();
    await settle();
    expect(sent).toEqual([
      {
        url: "/r/e.json",
        body: {
          n: "pageview",
          u: "https://letsauth.eu/mcp/",
          d: "letsauth.eu",
          r: "https://example.org/",
          w: 1280,
        },
      },
    ]);
  });

  it("holds a prerendered page's pageview until it is shown, and drops it if never", async () => {
    const { win, document, sent } = fakeWindow({ prerendering: true });
    startAnalytics(win, config);
    await settle();
    expect(sent).toEqual([]);
    document.prerendering = false;
    document.dispatchEvent(new Event("prerenderingchange"));
    await settle();
    expect(sent.map((s) => s.body.n)).toEqual(["pageview"]);
  });

  it("counts a back/forward cache restore, not an ordinary pageshow", async () => {
    const { win, sent } = fakeWindow();
    startAnalytics(win, config);
    win.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: false }));
    win.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
    await settle();
    expect(sent.map((s) => s.body.n)).toEqual(["pageview", "pageview"]);
  });

  it("records a 404 with its path", async () => {
    const { win, sent } = fakeWindow();
    startAnalytics(win, { ...config, notFound: true });
    await settle();
    expect(sent[1]?.body).toMatchObject({ n: "404", p: { path: "/mcp/" } });
  });

  it("never reports off the production host or under automation", () => {
    expect(startAnalytics(fakeWindow({ hostname: "localhost" }).win, config)).toBeNull();
    expect(startAnalytics(fakeWindow({ webdriver: true }).win, config)).toBeNull();
  });

  it("classifies link clicks", () => {
    const here = "https://letsauth.eu/mcp/";
    expect(linkEvent("https://github.com/x", here)?.name).toBe("Outbound Link: Click");
    expect(linkEvent("/mcp/data.json", here)).toEqual({
      name: "File Download",
      props: { url: "https://letsauth.eu/mcp/data.json" },
    });
    expect(linkEvent("/standards/", here)).toBeNull();
    expect(linkEvent("mailto:a@b.eu", here)).toBeNull();
  });
});

describe("bunny edge rules", () => {
  it("forwards the event path to Plausible with the visitor's IP", () => {
    const [rule] = edgeRules() as [EdgeRule];
    expect(rule.ActionParameter1).toBe("https://plausible.io/api/event");
    expect(rule.Triggers[0]?.PatternMatches).toEqual(["*/r/e.json"]);
    expect(rule.ExtraActions).toContainEqual(
      expect.objectContaining({
        ActionParameter1: "X-Forwarded-For",
        ActionParameter2: "%{User.IP}",
      }),
    );
  });

  it("updates and deletes only managed rules", async () => {
    const calls: [string, string, unknown?][] = [];
    const api = async (method: string, path: string, body?: unknown) => {
      calls.push([method, path, body]);
      if (method === "GET")
        return {
          EdgeRules: [
            { Guid: "a", Description: `${MANAGED_PREFIX}Plausible events` },
            { Guid: "b", Description: `${MANAGED_PREFIX}Old rule` },
            { Guid: "c", Description: "Hand-made redirect" },
          ],
        };
      return null;
    };
    const log = await syncEdgeRules(api, "42", edgeRules());
    expect(log).toEqual([
      `updated  ${MANAGED_PREFIX}Plausible events`,
      `deleted  ${MANAGED_PREFIX}Old rule`,
    ]);
    expect(calls[1]).toEqual([
      "POST",
      "/pullzone/42/edgerules/addOrUpdate",
      expect.objectContaining({ Guid: "a" }),
    ]);
    expect(calls[2]?.slice(0, 2)).toEqual(["DELETE", "/pullzone/42/edgerules/b"]);
  });
});
