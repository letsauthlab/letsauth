import { describe, expect, it } from "vitest";
import {
  type AnalyticsConfig,
  PLAUSIBLE_EVENT_PATH,
  plausibleInit,
  SOFT_NAVIGATION,
  startAnalytics,
  type Track,
} from "@/lib/reach";
import { edgeRules, MANAGED_PREFIX, syncEdgeRules } from "../../scripts/lib/bunny-edge-rules";

const config: AnalyticsConfig = { host: "letsauth.eu", notFound: false };

function fakeWindow(opts: { prerendering?: boolean; hostname?: string; webdriver?: boolean } = {}) {
  const calls: Parameters<Track>[] = [];
  const track: Track = (...args) => {
    calls.push(args);
  };
  const document = Object.assign(new EventTarget(), { prerendering: opts.prerendering ?? false });
  const hostname = opts.hostname ?? "letsauth.eu";
  const win = Object.assign(new EventTarget(), {
    document,
    location: { hostname, href: `https://${hostname}/mcp/`, pathname: "/mcp/" },
    navigator: { webdriver: opts.webdriver ?? false },
  });
  // biome-ignore lint/suspicious/noExplicitAny: a minimal stand-in for Window
  return { win: win as any, document, track, names: () => calls.map((c) => c[0]), calls };
}

describe("analytics", () => {
  it("configures Plausible to post to the first-party endpoint and leave pageviews to us", () => {
    const init = plausibleInit();
    expect(init).toContain(`"endpoint":"${PLAUSIBLE_EVENT_PATH}"`);
    expect(init).toContain('"autoCapturePageviews":false');
    expect(init).toContain('"json"');
  });

  it("records one pageview", () => {
    const { win, track, names } = fakeWindow();
    expect(startAnalytics(win, config, track)).toBe(true);
    expect(names()).toEqual(["pageview"]);
  });

  it("holds a prerendered page's pageview until it is shown, and drops it if never", () => {
    const { win, document, track, names } = fakeWindow({ prerendering: true });
    startAnalytics(win, config, track);
    expect(names()).toEqual([]);
    document.prerendering = false;
    document.dispatchEvent(new Event("prerenderingchange"));
    document.dispatchEvent(new Event("prerenderingchange"));
    expect(names()).toEqual(["pageview"]);
  });

  it("counts a back/forward cache restore and an in-place navigation", () => {
    const { win, track, names } = fakeWindow();
    startAnalytics(win, config, track);
    win.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: false }));
    win.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
    win.dispatchEvent(new Event(SOFT_NAVIGATION));
    expect(names()).toEqual(["pageview", "pageview", "pageview"]);
  });

  it("reports on www.letsauth.eu as well", () => {
    const { win, track, names } = fakeWindow({ hostname: "www.letsauth.eu" });
    expect(startAnalytics(win, config, track)).toBe(true);
    expect(names()).toEqual(["pageview"]);
  });

  it("records a 404 with its path", () => {
    const { win, track, calls } = fakeWindow();
    startAnalytics(win, { ...config, notFound: true }, track);
    expect(calls[1]).toEqual(["404", { props: { path: "/mcp/" } }]);
  });

  it("never reports off the production host or under automation", () => {
    for (const opts of [{ hostname: "localhost" }, { webdriver: true }]) {
      const { win, track, names } = fakeWindow(opts);
      expect(startAnalytics(win, config, track)).toBe(false);
      expect(names()).toEqual([]);
    }
  });
});

describe("bunny edge rules", () => {
  it("serves the personal script and forwards events with the visitor's IP", () => {
    const [script, events] = edgeRules();
    expect(script?.ActionParameter1).toMatch(/^https:\/\/plausible\.io\/js\/pa-.+\.js$/);
    expect(script?.Triggers[0]?.PatternMatches).toEqual(["*/r/s.js"]);
    expect(events?.ActionParameter1).toBe("https://plausible.io/api/event");
    expect(events?.Triggers[0]?.PatternMatches).toEqual(["*/r/e.json"]);
    expect(events?.ExtraActions).toContainEqual(
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
      `created  ${MANAGED_PREFIX}Plausible script`,
      `updated  ${MANAGED_PREFIX}Plausible events`,
      `deleted  ${MANAGED_PREFIX}Old rule`,
    ]);
    expect(calls[2]).toEqual([
      "POST",
      "/pullzone/42/edgerules/addOrUpdate",
      expect.objectContaining({ Guid: "a" }),
    ]);
    expect(calls[3]?.slice(0, 2)).toEqual(["DELETE", "/pullzone/42/edgerules/b"]);
  });
});
