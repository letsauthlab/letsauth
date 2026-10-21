import { expect, test } from "@playwright/test";
import { breachList, missingControls } from "../../src/lib/breaches";
import { getDataset } from "../../src/lib/data";
import { expectEndStateUnderReducedMotion, expectNoSeriousA11yViolations } from "./helpers";

const data = getDataset();
const breaches = breachList(data);
const withReplay = breaches.find((b) => b.replay && b.features.length > 0) ?? breaches[0];
const withoutReplay = breaches.find((b) => !b.replay);
if (!withReplay) throw new Error("the seed data needs at least one vulnerability");

test.describe("breach index (US1)", () => {
  test("lists every entry newest first with its class, replay and requirements (FR-002)", async ({
    page,
  }) => {
    await page.goto("/breaches/");
    const items = page.locator("#breach-list li[data-breach]");
    await expect(items).toHaveCount(breaches.length);
    const ids = await items.evaluateAll((els) => els.map((e) => e.getAttribute("data-breach")));
    expect(ids).toEqual(breaches.map((b) => b.vulnerability.id));
    const card = page.locator(`#breach-list li[data-breach="${withReplay.vulnerability.id}"]`);
    await expect(card.locator("h2 a")).toHaveAttribute(
      "href",
      `/breaches/${withReplay.vulnerability.id}/`,
    );
    await expect(card.locator("time")).toHaveAttribute(
      "datetime",
      withReplay.vulnerability.disclosed,
    );
    if (withReplay.replay) {
      await expect(card.locator("a[data-replay]")).toHaveAttribute(
        "href",
        `/explorer/${withReplay.replay.scenario.id}/${withReplay.replay.toggle.id}/`,
      );
    }
  });

  test("is in the primary navigation and the footer (FR-007)", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('nav[aria-label="Primary"] a[href="/breaches/"]')).toHaveCount(1);
    await expect(page.locator('nav[aria-label="Footer"] a[href="/breaches/"]')).toHaveCount(1);
  });

  test("publishes the entries as JSON (FR-006)", async ({ request }) => {
    const res = await request.get("/breaches/data.json");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.version).toBe(1);
    expect(body.license).toBe("CC BY 4.0");
    expect(body.vulnerabilities.map((v: { id: string }) => v.id)).toEqual(
      breaches.map((b) => b.vulnerability.id),
    );
  });

  test("has no serious accessibility violations and looks right", async ({ page }) => {
    await page.goto("/breaches/");
    await expectNoSeriousA11yViolations(page);
    await expect(page).toHaveScreenshot("breaches.png", { fullPage: false });
  });
});

test.describe("breach page (US2)", () => {
  const v = withReplay.vulnerability;
  const controls = missingControls(data, v);

  test("shows the facts, every source, the missing controls with atlas counts and the replay (FR-003, FR-004)", async ({
    page,
  }) => {
    await page.goto(`/breaches/${v.id}/`);
    await expect(page.locator("h1")).toHaveText(v.title);
    await expect(page.locator("time")).toHaveAttribute("datetime", v.disclosed);
    for (const s of v.sources) {
      await expect(page.locator(`a[href="${s}"]`)).toHaveCount(1);
    }
    await expect(page.locator("#controls li[data-feature]")).toHaveCount(controls.length);
    for (const c of controls) {
      const item = page.locator(`#controls li[data-feature="${c.feature.id}"]`);
      await expect(item.locator("a").first()).toHaveAttribute(
        "href",
        `/mcp/features/${c.feature.id}/`,
      );
      await expect(item.locator("cite.citation a")).toHaveAttribute("href", /^https:\/\//);
      await expect(item.locator(".controls__counts")).toContainText(
        c.observed ? /supported/ : /client requirement|not defined by/,
      );
    }
    if (withReplay.replay) {
      await expect(page.locator("#replay a[data-replay]")).toHaveAttribute(
        "href",
        `/explorer/${withReplay.replay.scenario.id}/${withReplay.replay.toggle.id}/`,
      );
    }
  });

  test("the replay toggle page links the atlas requirements it defeats (FR-005)", async ({
    page,
  }) => {
    test.skip(!withReplay.replay, "no entry with a replay in the seed data");
    if (!withReplay.replay) return;
    await page.goto(`/explorer/${withReplay.replay.scenario.id}/${withReplay.replay.toggle.id}/`);
    await expect(page.locator("[data-toggle-notice]")).toHaveCount(1);
    await expect(page.locator("#chain-steps li[data-toggled]")).toHaveCount(
      Object.values(withReplay.replay.toggle.replaces).reduce((n, r) => n + r.length, 0),
    );
  });

  test("says plainly when no replay exists yet (FR-003)", async ({ page }) => {
    test.skip(!withoutReplay, "every entry has a replay");
    if (!withoutReplay) return;
    await page.goto(`/breaches/${withoutReplay.vulnerability.id}/`);
    await expect(page.locator("[data-no-replay]")).toHaveCount(1);
    await expect(page.locator("#replay a[data-replay]")).toHaveCount(0);
  });

  test("has no horizontal page scroll at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    for (const path of ["/breaches/", ...breaches.map((b) => `/breaches/${b.vulnerability.id}/`)]) {
      await page.goto(path);
      const [scroll, inner] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        window.innerWidth,
      ]);
      expect(scroll, path).toBeLessThanOrEqual(inner);
    }
  });

  test("the timeline is an ordered list of dated entries that skips its draw-in under reduced motion (M13)", async ({
    page,
  }) => {
    await page.goto(`/breaches/${v.id}/`);
    const timeline = page.locator("#timeline ol.timeline");
    await expect(timeline.locator("> li").first().locator("time")).toHaveAttribute(
      "datetime",
      v.disclosed,
    );
    await expectEndStateUnderReducedMotion(page, "#timeline ol.timeline");
  });

  test("has no serious accessibility violations and looks right", async ({ page }) => {
    await page.goto(`/breaches/${v.id}/`);
    // the timeline fades in (M13); axe measures contrast on the settled page
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
    await expectNoSeriousA11yViolations(page);
    await expect(page).toHaveScreenshot("breach.png", { fullPage: false });
  });
});
