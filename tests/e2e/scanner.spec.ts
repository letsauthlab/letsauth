import { expect, type Page, test } from "@playwright/test";
import { getDataset } from "../../src/lib/data";
import { passiveChecks, scannerIndex } from "../../src/lib/scanner";
import { GRADE_RULE } from "../../src/scanner/grade";
import { expectNoSeriousA11yViolations } from "./helpers";

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

  test("has no horizontal page scroll at phone width (SC-007)", async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 900 });
    await page.goto("/mcp/scanner/");
    const [scroll, inner] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      window.innerWidth,
    ]);
    expect(scroll).toBeLessThanOrEqual(inner ?? 0);
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
    const rows = page.locator("[data-report] tr[data-check]");
    await expect(rows).toHaveCount(checks.length);
    await expect(page.locator("[data-report] [data-grade-label]")).toHaveCount(1);
    const row = rows.first();
    await expect(row.locator(".level")).toHaveCount(1);
    await expect(row.locator(".status")).toHaveCount(1);
    await expect(row.locator("td.evidence")).toHaveCount(1);
    await expect(page.locator("#not-scanned")).toHaveCount(0);
  });

  test("a server without a scanner observation reads as not scanned, never as unsupported (FR-011)", async ({
    page,
  }) => {
    test.skip(!unscanned, "every server has a scanner observation");
    await page.goto(`/mcp/servers/${unscanned?.server.id}/scan/`);
    await expect(page.locator("#not-scanned")).toBeVisible();
    await expect(page.locator("[data-grade-letter]")).toHaveCount(0);
    const rows = page.locator("[data-report] tr[data-check]");
    await expect(rows).toHaveCount(checks.length);
    await expect(
      page.locator("[data-report] tr[data-check][data-status='unsupported']"),
    ).toHaveCount(0);
    await expect(page.locator("[data-report] tr[data-check][data-status='unknown']")).toHaveCount(
      checks.length,
    );
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
    await expectNoSeriousA11yViolations(page);
    await hideNightlyData(page);
    await expect(page).toHaveScreenshot("report.png", {
      fullPage: false,
      mask: [page.locator("[data-report]")],
    });
  });
});
