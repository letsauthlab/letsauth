import { expect, test } from "@playwright/test";
import { currentRevision, matrixFor } from "../../src/lib/atlas";
import { missingMostOften, statusChanges } from "../../src/lib/changes";
import { getDataset } from "../../src/lib/data";
import { specNodes } from "../../src/lib/standards";
import { expectEndStateUnderReducedMotion, expectNoSeriousA11yViolations } from "./helpers";

const data = getDataset();
const revision = currentRevision(data);
const matrix = matrixFor(data, revision.id);
const cells = [...matrix.cells.values()];
const changes = statusChanges(data, revision.id).filter((c) =>
  matrix.cells.has(`${c.server}|${c.feature}`),
);
const missing = missingMostOften(data, revision.id);
// cells observed, not observations on record: the append-only history counts every entry
const facts = [
  matrix.rows.length,
  matrix.columns.length,
  cells.filter((c) => !c.derived).length,
  specNodes(data).length,
].map(String);

test.describe("home page (016 WP3)", () => {
  test("names the five products with their counts", async ({ page }) => {
    await page.goto("/");
    const products = page.locator(".products > li");
    await expect(products).toHaveCount(5);
    for (const href of ["/mcp/", "/standards/", "/explorer/", "/breaches/", "/mcp/scanner/"])
      await expect(products.locator(`a[href="${href}"]`)).toHaveCount(1);
    await expect(products.first().locator(".index__meta")).toHaveText(
      `${matrix.rows.length} servers`,
    );
    await expect(page.locator(".home-facts .facts__of")).toHaveText(`of ${cells.length}`);
  });

  test("leads with status changes, newest first, each with its evidence (019)", async ({
    page,
  }) => {
    await page.goto("/");
    const newest = changes[0];
    expect(newest).toBeTruthy();
    const lines = page.locator(".ledger__lines > li");
    expect(await lines.count()).toBeGreaterThan(0);
    expect(await lines.count()).toBeLessThanOrEqual(8);
    const dates = await page.locator(".ledger__date time").allTextContents();
    expect(dates).toEqual([...dates].sort().reverse());
    // the first line is the newest change, with the old and the new status
    const first = lines.first();
    await expect(first.locator(`a[href="/mcp/servers/${newest?.server}/"]`)).toHaveCount(1);
    await expect(first.locator(`.status-${newest?.from}`).first()).toBeVisible();
    await expect(first.locator(`.change__to .status-${newest?.to}`)).toHaveCount(1);
    await expect(first.locator("details.stack summary")).toBeVisible();
  });

  test("ranks requirements, never servers, by servers observed unsupported (019)", async ({
    page,
  }) => {
    await page.goto("/");
    const items = page.locator(".missing__list > li");
    await expect(items).toHaveCount(Math.min(6, missing.length));
    await expect(items.locator('a[href^="/mcp/servers/"]')).toHaveCount(0);
    await expect(
      items.first().locator(`a[href="/mcp/features/${missing[0]?.feature}/"]`),
    ).toHaveCount(1);
  });

  test("keeps one filled button and loads no script file or island", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main .button:not(.quiet)")).toHaveCount(1);
    await expect(page.locator("script[src]")).toHaveCount(0);
    await expect(page.locator("astro-island")).toHaveCount(0);
  });

  test("draws every matrix cell on the plate and names it for the morph to /mcp/ (M2)", async ({
    page,
  }) => {
    await page.goto("/");
    const thumb = page.locator(".home-plate svg.matrix-thumb");
    await expect(thumb.locator("rect:not(.ring), circle, path")).toHaveCount(
      matrix.rows.length * matrix.columns.length,
    );
    expect(await thumb.evaluate((el) => getComputedStyle(el).viewTransitionName)).toBe("matrix");
    await expect(page.locator(".home-plate a.home-plate__grid")).toHaveAttribute("href", "/mcp/");
  });

  test("shows the figures at once, with no count-up (M3 removed)", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 400 });
    await page.goto("/");
    // no wait and no scroll: the figures are the dataset's numbers from the first paint
    expect(await page.locator(".home-facts .facts__n").allTextContents()).toEqual(facts);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    expect(await page.locator(".home-facts .facts__n").allTextContents()).toEqual(facts);
    await expectEndStateUnderReducedMotion(page, ".home-plate");
  });

  test("the h1 fits in two lines at 1440px and four at 360px", async ({ page }) => {
    await page.goto("/");
    const h1 = page.locator("h1");
    for (const [width, lines] of [
      [1440, 2],
      [360, 4],
    ] as const) {
      await page.setViewportSize({ width, height: 900 });
      const count = await h1.evaluate((el) => {
        const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight);
        return Math.round(el.getBoundingClientRect().height / lineHeight);
      });
      expect(count, `h1 lines at ${width}px`).toBeLessThanOrEqual(lines);
    }
  });

  test("sets the changes and the ranking side by side on a wide screen", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const ledger = await page.locator("section:has(#changes)").boundingBox();
    const ranking = await page.locator("section:has(#missing)").boundingBox();
    expect(ledger && ranking).toBeTruthy();
    expect(Math.abs((ledger?.y ?? 0) - (ranking?.y ?? 0))).toBeLessThan(2);
    expect((ledger?.x ?? 0) + (ledger?.width ?? 0)).toBeLessThan(ranking?.x ?? 0);
  });

  test("sets h1 and h2 in the serif and h3 in Geist (019)", async ({ page }) => {
    await page.goto("/");
    const family = (sel: string) =>
      page
        .locator(sel)
        .first()
        .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(await family("h1")).toMatch(/^Newsreader/);
    expect(await family("h2")).toMatch(/^Newsreader/);
    expect(await family("h3")).toMatch(/Geist/);
  });

  test("does not scroll sideways at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/");
    const { scroll, inner } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      inner: window.innerWidth,
    }));
    expect(scroll).toBeLessThanOrEqual(inner);
  });

  test("has no serious accessibility violations and looks right", async ({ page }) => {
    // reduced motion so the facts are final when the screenshot is taken
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expectNoSeriousA11yViolations(page);
    await expect(page).toHaveScreenshot("home.png", { fullPage: false });
  });
});

test.describe("home page without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("has the figures in the HTML", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".home-facts .facts__n")).toHaveText(facts);
    await expect(page.locator(".home-plate svg.matrix-thumb")).toBeVisible();
  });
});
