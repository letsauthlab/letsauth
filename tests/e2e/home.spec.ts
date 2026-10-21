import { expect, test } from "@playwright/test";
import { currentRevision, matrixFor } from "../../src/lib/atlas";
import { getDataset } from "../../src/lib/data";
import { specNodes } from "../../src/lib/standards";
import { expectEndStateUnderReducedMotion, expectNoSeriousA11yViolations } from "./helpers";

const data = getDataset();
const revision = currentRevision(data);
const matrix = matrixFor(data, revision.id);
const facts = [
  matrix.rows.length,
  matrix.columns.length,
  data.observations.length,
  specNodes(data).length,
].map(String);

test.describe("home page (016 WP3)", () => {
  test("names the five products with their counts and the newest observations", async ({
    page,
  }) => {
    await page.goto("/");
    const products = page.locator("#products + .rows > li");
    await expect(products).toHaveCount(5);
    for (const href of ["/mcp/", "/standards/", "/explorer/", "/breaches/", "/mcp/scanner/"])
      await expect(products.locator(`a[href="${href}"]`)).toHaveCount(1);
    await expect(products.first().locator(".rows__meta")).toHaveText(
      `${matrix.rows.length} servers`,
    );
    await expect(page.locator(".latest > li")).toHaveCount(6);
    await expect(page.locator(".latest > li .status")).toHaveCount(6);
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
    await expect(thumb.locator("rect, circle")).toHaveCount(
      matrix.rows.length * matrix.columns.length,
    );
    expect(await thumb.evaluate((el) => getComputedStyle(el).viewTransitionName)).toBe("matrix");
    await expect(page.locator(".home-plate a.plate")).toHaveAttribute("href", "/mcp/");
  });

  test("counts the facts up to the dataset's numbers once in view (M3)", async ({ page }) => {
    // a short viewport keeps the row out of view, so it waits at 0 until scrolled to
    await page.setViewportSize({ width: 1024, height: 400 });
    await page.goto("/");
    const figures = page.locator(".home-facts dd [data-count]");
    await expect(figures.first()).toHaveText("0");
    await figures.first().scrollIntoViewIfNeeded();
    await expect(figures).toHaveText(facts);
  });

  test("shows the final figures at once under reduced motion (M3)", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    // no wait: the figures must already be final, not on their way up from 0
    expect(await page.locator(".home-facts dd [data-count]").allTextContents()).toEqual(facts);
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

  test("has the figures in the HTML (M3)", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".home-facts dd [data-count]")).toHaveText(facts);
    await expect(page.locator(".home-plate svg.matrix-thumb")).toBeVisible();
  });
});
