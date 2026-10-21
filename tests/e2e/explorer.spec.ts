import { expect, test } from "@playwright/test";
import { getDataset } from "../../src/lib/data";
import { resolveChain, scenarioList } from "../../src/lib/explorer";
import { expectEndStateUnderReducedMotion, expectNoSeriousA11yViolations } from "./helpers";

const data = getDataset();
const scenarios = scenarioList(data);
const first = scenarios.find((s) => s.scenario.id === "mcp-authorization") ?? scenarios[0];
if (!first) throw new Error("the seed data needs at least one scenario");
const scenario = first.scenario;
const passthrough =
  scenario.toggles.find((t) => t.id === "token-passthrough") ?? scenario.toggles[0];
if (!passthrough) throw new Error("the first scenario needs a toggle");
const removing = scenarios
  .flatMap((s) => s.toggles.map((t) => ({ scenario: s.scenario, toggle: t })))
  .find(({ toggle }) => Object.values(toggle.replaces).some((r) => r.length === 0));

test.describe("explorer index (US3)", () => {
  test("lists every scenario with a link and its toggles (FR-008)", async ({ page }) => {
    await page.goto("/explorer/");
    await expect(page.locator("#scenario-list li[data-scenario]")).toHaveCount(scenarios.length);
    const card = page.locator(`#scenario-list li[data-scenario="${scenario.id}"]`);
    await expect(card.locator("h2 a")).toHaveAttribute("href", `/explorer/${scenario.id}/`);
    await expect(card.locator("a[data-toggle]")).toHaveCount(scenario.toggles.length);
    await expect(card.locator(`a[data-toggle="${passthrough.id}"]`)).toHaveAttribute(
      "href",
      `/explorer/${scenario.id}/${passthrough.id}/`,
    );
  });

  test("is in the primary navigation and the footer (FR-010)", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('nav[aria-label="Primary"] a[href="/explorer/"]')).toHaveCount(1);
    await expect(page.locator('nav[aria-label="Footer"] a[href="/explorer/"]')).toHaveCount(1);
  });

  test("publishes the scenarios as JSON (FR-009)", async ({ request }) => {
    const res = await request.get("/explorer/data.json");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.version).toBe(1);
    expect(body.license).toBe("CC BY 4.0");
    expect(body.scenarios.map((s: { id: string }) => s.id)).toEqual(
      scenarios.map((s) => s.scenario.id),
    );
  });

  test("has no serious accessibility violations and looks right", async ({ page }) => {
    await page.goto("/explorer/");
    await expectNoSeriousA11yViolations(page);
    await expect(page).toHaveScreenshot("explorer.png", { fullPage: false });
  });
});

test.describe("scenario page (US1)", () => {
  const chain = resolveChain(scenario);

  test("draws one lifeline per actor and one row per step, matching the list (FR-003, SC-002)", async ({
    page,
  }) => {
    await page.goto(`/explorer/${scenario.id}/`);
    await expect(page.locator("#chain .actor[data-actor]")).toHaveCount(scenario.actors.length);
    await expect(page.locator("#chain-steps")).toHaveAttribute(
      "data-steps",
      String(chain.steps.length),
    );
    const listIds = await page
      .locator("#chain-steps li[data-step]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-step")));
    expect(listIds).toEqual(chain.steps.map((s) => s.id));
    await expect(page.locator("#chain-steps li[data-step] .step__lanes .lane")).toHaveCount(
      chain.steps.length * scenario.actors.length,
    );
    await expect(page.locator("#chain-steps li[data-step] .arrow")).toHaveCount(chain.steps.length);
    await expect(
      page.locator("#chain-steps li[data-toggled], #chain-steps li[data-removed]"),
    ).toHaveCount(0);
  });

  test("every step cites a resolved revision document (FR-003)", async ({ page }) => {
    await page.goto(`/explorer/${scenario.id}/`);
    const links = page.locator("#chain-steps li[data-step] cite.citation a");
    await expect(links).toHaveCount(chain.steps.length);
    const hrefs = await links.evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
    for (const href of hrefs) expect(href).toMatch(/^https:\/\//);
  });

  test("shows the decoded token with derived change marks (FR-004)", async ({ page }) => {
    await page.goto(`/explorer/${scenario.id}/`);
    const withTokens = chain.steps.filter((s) => s.token);
    await expect(page.locator("#chain-steps [data-token]")).toHaveCount(withTokens.length);
    const upstream = chain.steps.find((s) => s.id === "upstream-call");
    test.skip(!upstream?.token, "the seed scenario has no upstream-call token");
    const token = page.locator('#chain-steps li[data-step="upstream-call"] [data-token]');
    await expect(token.locator('[data-claim="aud"]')).toHaveAttribute("data-change", "changed");
    await expect(token.locator('[data-claim="act"]')).toHaveAttribute("data-change", "added");
    await expect(token.locator('[data-claim="iss"]')).toHaveAttribute("data-change", "same");
    const firstToken = page.locator("#chain-steps [data-token]").first();
    await expect(firstToken.locator('[data-change="added"], [data-change="changed"]')).toHaveCount(
      0,
    );
  });

  test("renders fully without JavaScript (FR-007)", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`/explorer/${scenario.id}/`);
    await expect(page.locator("#chain-steps li[data-step]")).toHaveCount(chain.steps.length);
    await expect(page.locator("#chain-steps li[data-step] .arrow")).toHaveCount(chain.steps.length);
    await expect(page.locator("[data-enhanced]")).toHaveCount(0);
    await expect(page.locator('nav[aria-label="Toggles"] a')).toHaveCount(
      scenario.toggles.length + 1,
    );
    await context.close();
  });

  test("steps through the chain with JavaScript and reflects it in the URL (FR-007)", async ({
    page,
  }) => {
    await page.goto(`/explorer/${scenario.id}/`);
    const bar = page.locator("[data-enhanced]");
    await expect(bar).toHaveCount(1);
    const firstId = chain.steps[0]?.id ?? "";
    const secondId = chain.steps[1]?.id ?? "";
    await expect(page.locator(`#chain-steps li[data-step="${firstId}"]`)).toHaveAttribute(
      "aria-current",
      "step",
    );
    await bar.getByRole("button", { name: "Next step" }).click();
    await expect(page.locator(`#chain-steps li[data-step="${secondId}"]`)).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(new URL(page.url()).hash).toBe(`#step-${secondId}`);
    await page.keyboard.press("ArrowRight");
    const thirdId = chain.steps[2]?.id ?? "";
    await expect(page.locator(`#chain-steps li[data-step="${thirdId}"]`)).toHaveAttribute(
      "aria-current",
      "step",
    );
    // reloading at a fragment opens at that step
    await page.goto(`/explorer/${scenario.id}/#step-${thirdId}`);
    await expect(page.locator(`#chain-steps li[data-step="${thirdId}"]`)).toHaveAttribute(
      "aria-current",
      "step",
    );
  });

  test("has no horizontal page scroll at 320px (FR-011)", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    for (const path of ["/explorer/", ...scenarios.map((s) => `/explorer/${s.scenario.id}/`)]) {
      await page.goto(path);
      const [scroll, inner] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        window.innerWidth,
      ]);
      expect(scroll, path).toBeLessThanOrEqual(inner);
    }
  });

  test("Play never starts by itself, advances when pressed and pauses on any key (M6)", async ({
    page,
  }) => {
    await page.goto(`/explorer/${scenario.id}/`);
    const bar = page.locator("[data-enhanced]");
    const first = page.locator("#chain-steps li[data-step]").first();
    await page.waitForTimeout(3000);
    await expect(first).toHaveAttribute("aria-current", "step");
    const play = bar.locator("button[data-play]");
    await expect(play).toHaveText("Play");
    await play.click();
    await expect(play).toHaveText("Pause");
    await expect(page.locator("#chain-steps li[data-step]").nth(1)).toHaveAttribute(
      "aria-current",
      "step",
      { timeout: 4000 },
    );
    await page.keyboard.press("Shift");
    await expect(play).toHaveText("Play");
  });

  test("the token diff is in the markup before any script runs (M7)", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`/explorer/${scenario.id}/`);
    const changed = chain.steps.reduce(
      (n, s) =>
        n +
        (s.token
          ? s.token.diff.added.length + s.token.diff.changed.length + s.token.diff.removed.length
          : 0),
      0,
    );
    await expect(page.locator("#chain-steps [data-token] [data-changed]")).toHaveCount(changed);
    await context.close();
  });

  test("under reduced motion, Play is hidden and stepping shows its end state (M5, M6, M7)", async ({
    page,
  }) => {
    const third = chain.steps[2]?.id ?? "";
    await page.goto(`/explorer/${scenario.id}/#step-${third}`);
    await expectEndStateUnderReducedMotion(page, "#chain-steps");
    await expect(page.locator("[data-enhanced]")).toHaveCount(1);
    await expect(page.locator("button[data-play]")).toHaveCount(0);
    await page.getByRole("button", { name: "Next step" }).click();
    await expectEndStateUnderReducedMotion(page, "#chain-steps li[aria-current='step'] .arrow");
    await expectEndStateUnderReducedMotion(page, "#chain-steps [data-token]");
  });

  test("has no serious accessibility violations and looks right", async ({ page }) => {
    await page.goto(`/explorer/${scenario.id}/`);
    await expectNoSeriousA11yViolations(page);
    await expect(page).toHaveScreenshot("scenario.png", { fullPage: false });
  });
});

test.describe("toggle page (US2)", () => {
  const chain = resolveChain(scenario, passthrough.id);

  test("marks replaced steps, names what they replace, and keeps the rest (FR-005)", async ({
    page,
  }) => {
    await page.goto(`/explorer/${scenario.id}/${passthrough.id}/`);
    await expect(page.locator("#chain-steps")).toHaveAttribute(
      "data-steps",
      String(chain.steps.length),
    );
    const listIds = await page
      .locator("#chain-steps li[data-step]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-step")));
    expect(listIds).toEqual(chain.steps.map((s) => s.id));
    const toggled = chain.steps.filter((s) => s.toggled && !s.removed);
    await expect(page.locator("#chain-steps li[data-toggled]")).toHaveCount(toggled.length);
    const firstReplacement = toggled.find((s) => s.replaces);
    test.skip(!firstReplacement, "the toggle replaces nothing");
    await expect(
      page.locator(`#chain-steps li[data-step="${firstReplacement?.id}"]`),
    ).toHaveAttribute("data-replaces", firstReplacement?.replaces ?? "");
    await expect(
      page.locator(`nav[aria-label="Toggles"] a[data-toggle="${passthrough.id}"]`),
    ).toHaveAttribute("aria-current", "page");
  });

  test("shows the notice with kind, citation and the atlas requirements it defeats (FR-006)", async ({
    page,
  }) => {
    await page.goto(`/explorer/${scenario.id}/${passthrough.id}/`);
    const notice = page.locator("[data-toggle-notice]");
    await expect(notice).toHaveCount(1);
    await expect(notice.locator("cite.citation a")).toHaveCount(1);
    const violates = passthrough.violates ?? [];
    await expect(notice.locator("li[data-violates]")).toHaveCount(violates.length);
    for (const id of violates) {
      const item = notice.locator(`li[data-violates="${id}"]`);
      await expect(item.locator("a").first()).toHaveAttribute("href", `/mcp/features/${id}/`);
      await expect(item).toContainText(/unknown|does not observe clients|not defined by/);
    }
  });

  test("strikes out a removed step in the list and the diagram (FR-005)", async ({ page }) => {
    test.skip(!removing, "no toggle in the seed data removes a step");
    if (!removing) return;
    await page.goto(`/explorer/${removing.scenario.id}/${removing.toggle.id}/`);
    const removed = resolveChain(removing.scenario, removing.toggle.id).steps.filter(
      (s) => s.removed,
    );
    await expect(page.locator("#chain-steps li[data-removed]")).toHaveCount(removed.length);
    await expect(page.locator("#chain-steps li.is-removed")).toHaveCount(removed.length);
    await expect(page.locator(`#chain-steps li[data-step="${removed[0]?.id}"] s`)).toHaveCount(1);
  });

  test("lights the rails of touched steps on load, and not under reduced motion (M8)", async ({
    page,
  }) => {
    await page.goto(`/explorer/${scenario.id}/${passthrough.id}/`);
    await expectEndStateUnderReducedMotion(page, "#chain-steps li[data-toggled]");
    const rail = await page
      .locator("#chain-steps li[data-toggled]")
      .first()
      .evaluate((el) => getComputedStyle(el).borderLeftColor);
    expect(rail).not.toBe("rgba(0, 0, 0, 0)");
  });

  test("is accessible in this theme", async ({ page }) => {
    await page.goto(`/explorer/${scenario.id}/${passthrough.id}/`);
    await expectNoSeriousA11yViolations(page);
  });
});
