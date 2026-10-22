import { expect, test } from "@playwright/test";
import { expectEndStateUnderReducedMotion, expectNoSeriousA11yViolations } from "./helpers";

// The decorative plate (plan WP8): in the head of the explorer and breach indexes and every spec
// page, never on a page with a data view above the fold, hidden from assistive technology and on
// narrow screens.
const withPlate = ["/explorer/", "/breaches/", "/standards/rfc8693/"];
const withoutPlate = ["/", "/mcp/", "/standards/", "/explorer/mcp-authorization/"];

test.describe("decorative plate (WP8)", () => {
  for (const path of withPlate) {
    test(`sits in the head of ${path}, hidden and labelless`, async ({ page }) => {
      await page.goto(path);
      const plate = page.locator("header.page-head > .decor");
      await expect(plate).toHaveCount(1);
      await expect(plate.locator("svg")).toHaveAttribute("aria-hidden", "true");
      await expect(plate.locator("text")).toHaveCount(0);
      expect((await plate.innerHTML()).length).toBeLessThan(4096);
    });
  }

  for (const path of withoutPlate) {
    test(`stays off ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator(".decor")).toHaveCount(0);
    });
  }

  test("draws the same plate on every load", async ({ page }) => {
    await page.goto("/standards/rfc8693/");
    const first = await page.locator(".decor").innerHTML();
    await page.reload();
    expect(await page.locator(".decor").innerHTML()).toBe(first);
  });

  test("gives the section roots their own social card", async ({ page }) => {
    for (const id of ["explorer", "breaches"]) {
      await page.goto(`/${id}/`);
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        "content",
        new RegExp(`/og-${id}\\.png$`),
      );
      const card = await page.request.get(`/og-${id}.png`);
      expect(card.ok()).toBe(true);
    }
  });

  test("shows beside the title on wide screens only", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/standards/rfc8693/");
    const plate = page.locator(".decor");
    await expect(plate).toBeVisible();
    const box = await plate.boundingBox();
    const title = await page.locator(".page-head h1").boundingBox();
    expect(box && title && box.x > title.x + title.width / 2).toBe(true);
    await page.setViewportSize({ width: 390, height: 800 });
    await expect(plate).toBeHidden();
  });

  test("draws in once and passes axe", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/breaches/");
    const names = await page
      .locator(".decor .pp")
      .evaluate((el) => el.getAnimations().map((a) => (a as CSSAnimation).animationName));
    expect(names).toEqual(["plate-draw"]);
    await expectNoSeriousA11yViolations(page);
  });

  test("is drawn complete under reduced motion (M4)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/explorer/");
    await expectEndStateUnderReducedMotion(page, ".decor");
    await expect(page.locator(".decor .pp")).toHaveCSS("stroke-dasharray", "none");
  });
});
