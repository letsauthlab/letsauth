import { expect, type Page, test } from "@playwright/test";
import { getDataset } from "../../src/lib/data";
import { passiveChecks, requestLadder, scannerIndex } from "../../src/lib/scanner";
import { GRADE_RULE } from "../../src/scanner/grade";
import { expectEndStateUnderReducedMotion, expectNoSeriousA11yViolations } from "./helpers";

const data = getDataset();
const views = scannerIndex(data);
const checks = passiveChecks(data);
const scanned = views.find((v) => v.scanned);
const unscanned = views.find((v) => !v.scanned);
const first = views[0];
if (!first) throw new Error("the seed data needs at least one listed server");

/**
 * Screenshots guard the design, not the nightly data: blank what each scanner pull request
 * changes (counts, dates, grades, statuses) so those pull requests do not need new baselines.
 */
async function hideNightlyData(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>("[data-nightly]")) {
      el.textContent = "0";
      el.classList.remove("muted");
    }
  });
}

test.describe("scanner index (US2)", () => {
  test("has no list of its own and points at the atlas where the grades show (FR-010)", async ({
    page,
  }) => {
    await page.goto("/mcp/scanner/");
    await expect(page.locator("#scanner-index")).toHaveCount(0);
    await expect(page.locator("table tr[data-server]")).toHaveCount(0);
    const where = page.locator("[aria-labelledby='where-title']");
    for (const name of ["MCP auth atlas", "server page"]) {
      const link = where.getByRole("link", { name, exact: true });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", "/mcp/");
    }
    await expect(page.locator("[data-nightly]")).toHaveCount(2);
  });

  test("publishes the grade rule next to the grades (FR-008)", async ({ page }) => {
    await page.goto("/mcp/scanner/");
    const rule = page.locator("#grade-rule li");
    await expect(rule).toHaveCount(GRADE_RULE.length);
    await expect(rule.first()).toContainText("MUST");
  });

  test("reads fully without JavaScript (FR-013)", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/mcp/scanner/");
    await expect(page.locator("[data-enhanced]")).toHaveCount(0);
    await expect(page.locator("a[href='/mcp/']").first()).toBeVisible();
    await expect(page.locator("#grade-rule li")).toHaveCount(GRADE_RULE.length);
    await context.close();
  });

  test("has no horizontal page scroll down to 320px (SC-007)", async ({ page }) => {
    for (const path of ["/mcp/scanner/", `/mcp/servers/${(scanned ?? first).server.id}/scan/`]) {
      for (const width of [320, 412]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        const [scroll, inner] = await page.evaluate(() => [
          document.documentElement.scrollWidth,
          window.innerWidth,
        ]);
        expect(scroll, `${path} at ${width}px`).toBeLessThanOrEqual(inner ?? 0);
      }
    }
  });

  test("offers no way to start a scan from the site (no on-demand scanning)", async ({ page }) => {
    for (const path of ["/mcp/scanner/", `/mcp/servers/${first.server.id}/scan/`]) {
      await page.goto(path);
      await expect(page.locator("main form, main input, main button")).toHaveCount(0);
      await expect(page.getByRole("button", { name: /scan/i })).toHaveCount(0);
    }
  });

  test("shows the request ladder of one scan, in order", async ({ page }) => {
    await page.goto("/mcp/scanner/");
    const lines = page.locator(".how .transcript > li");
    await expect(lines.first()).toContainText("/.well-known/oauth-protected-resource/mcp");
    await expect(lines.filter({ hasText: "POST" })).toHaveCount(1);
  });

  test("has no serious accessibility violations and looks right", async ({ page }) => {
    await page.goto("/mcp/scanner/");
    await expectNoSeriousA11yViolations(page);
    await hideNightlyData(page);
    await expect(page).toHaveScreenshot("scanner.png", { fullPage: false });
  });
});

test.describe("scan report page (US2)", () => {
  test("shows one row per passive check with level, status and evidence (FR-009)", async ({
    page,
  }) => {
    test.skip(!scanned, "no server with a scanner observation in the dataset yet");
    await page.goto(`/mcp/servers/${scanned?.server.id}/scan/`);
    const rows = page.locator("[data-report] [data-check]");
    await expect(rows).toHaveCount(checks.length);
    await expect(page.locator("[data-report] [data-grade-label]")).toHaveCount(1);
    const row = rows.first();
    await expect(row.locator(".level")).toHaveCount(1);
    await expect(row.locator(".status")).toHaveCount(1);
    await expect(row.locator(".evidence")).toHaveCount(1);
    await expect(page.locator("#not-scanned")).toHaveCount(0);
  });

  test("a server without a scanner observation reads as not scanned, never as unsupported (FR-011)", async ({
    page,
  }) => {
    test.skip(!unscanned, "every server has a scanner observation");
    await page.goto(`/mcp/servers/${unscanned?.server.id}/scan/`);
    await expect(page.locator("#not-scanned")).toBeVisible();
    await expect(page.locator("[data-grade-letter]")).toHaveCount(0);
    const rows = page.locator("[data-report] [data-check]");
    await expect(rows).toHaveCount(checks.length);
    await expect(page.locator("[data-report] [data-check][data-status='unsupported']")).toHaveCount(
      0,
    );
    await expect(page.locator("[data-report] [data-check][data-status='unknown']")).toHaveCount(
      checks.length,
    );
    await expect(page.locator("[data-transcript]")).toHaveCount(0);
  });

  test("links the atlas, the server page, the JSON and the grade rule", async ({ page }) => {
    await page.goto(`/mcp/servers/${first.server.id}/scan/`);
    await expect(page.locator(".crumbs a[href='/mcp/']")).toBeVisible();
    await expect(page.locator(`.crumbs a[href='/mcp/servers/${first.server.id}/']`)).toBeVisible();
    await expect(page.locator(`a[href="/mcp/servers/${first.server.id}/"]`).first()).toBeVisible();
    await expect(
      page.locator(`a[href="/mcp/servers/${first.server.id}/scan.json"]`).first(),
    ).toBeVisible();
    await expect(page.locator("#rule-title")).toBeVisible();
    const response = await page.request.get(`/mcp/servers/${first.server.id}/scan.json`);
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.version).toBe(1);
    expect(body.recorded).toBe(true);
    expect(body.checks).toHaveLength(checks.length);
  });

  test("has no serious accessibility violations and looks right", async ({ page }) => {
    await page.goto(`/mcp/servers/${first.server.id}/scan/`);
    // contrast is judged on the end state, not on a ladder line still fading in (M12)
    await page.waitForFunction(() =>
      document.getAnimations().every((a) => a.playState !== "running"),
    );
    await expectNoSeriousA11yViolations(page);
    await hideNightlyData(page);
    await expect(page).toHaveScreenshot("report.png", {
      fullPage: false,
      mask: [page.locator("[data-report]")],
    });
  });

  test("transcript lists every recorded request with method, URL, status and what was read (M12)", async ({
    browser,
  }) => {
    test.skip(!scanned, "no server with a scanner observation in the dataset yet");
    if (!scanned) return;
    const ladder = requestLadder(scanned);
    // static HTML: the lines are there without JavaScript
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`/mcp/servers/${scanned.server.id}/scan/`);
    const lines = page.locator("[data-transcript] [data-request]");
    await expect(lines).toHaveCount(ladder.length);
    for (const [i, line] of ladder.entries()) {
      const row = lines.nth(i);
      await expect(row).toBeVisible();
      await expect(row.locator(".transcript__method")).toHaveText(line.method);
      await expect(row.locator(".transcript__url")).toHaveText(line.url);
      await expect(row.locator(".transcript__status")).toHaveText(line.answer);
      await expect(row.locator(".transcript__note")).toContainText(line.read[0] ?? "");
    }
    await expect(page.locator("[data-transcript] > li").last()).toHaveAttribute("data-verdict", "");
    await expect(page.locator("[data-transcript] [data-verdict]")).toContainText(
      scanned.grade.letter ? `Grade ${scanned.grade.letter}` : scanned.grade.label,
    );
    await context.close();
  });

  test("the ladder prints once when it scrolls into view, the grade last (M12)", async ({
    page,
  }) => {
    test.skip(!scanned, "no server with a scanner observation in the dataset yet");
    await page.goto(`/mcp/servers/${scanned?.server.id}/scan/`);
    const ladder = page.locator("[data-ladder]");
    await ladder.scrollIntoViewIfNeeded();
    await expect(ladder).toHaveAttribute("data-play", "");
    const verdictDelay = await page
      .locator("[data-verdict]")
      .evaluate((el) => getComputedStyle(el).animationDelay);
    const firstDelay = await page
      .locator("[data-request]")
      .first()
      .evaluate((el) => getComputedStyle(el).animationDelay);
    expect(Number.parseFloat(verdictDelay)).toBeGreaterThan(Number.parseFloat(firstDelay));
    await expect(page.locator("[data-verdict]")).toHaveCSS("opacity", "1");
    // once: scrolling away and back starts nothing new
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await ladder.scrollIntoViewIfNeeded();
    const running = await ladder.evaluate(
      (el) => el.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length,
    );
    expect(running).toBe(0);
  });

  test("under reduced motion the ladder shows in full at once (M12)", async ({ page }) => {
    test.skip(!scanned, "no server with a scanner observation in the dataset yet");
    await page.goto(`/mcp/servers/${scanned?.server.id}/scan/`);
    await expectEndStateUnderReducedMotion(page, "[data-ladder]");
    await expect(page.locator("[data-ladder]")).not.toHaveAttribute("data-armed", "");
    await expect(page.locator("[data-verdict]")).toHaveCSS("opacity", "1");
  });
});
