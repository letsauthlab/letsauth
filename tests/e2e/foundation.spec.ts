import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { LEGAL_LINKS, OPERATOR } from "../../src/lib/site";
import { expectNoSeriousA11yViolations } from "./helpers";

const pages = [
  { path: "/about/", heading: "Let's Auth Labs" },
  { path: "/imprint/", heading: "Imprint (Impressum)" },
  { path: "/privacy/", heading: "Privacy note" },
  { path: "/disclaimer/", heading: "Disclaimer" },
  { path: "/accessibility/", heading: "Accessibility statement" },
  { path: "/made-in-europe/", heading: "Made in Europe" },
];

test.describe("foundation pages", () => {
  test("wordmarks follow the system theme and preserve a visitor override", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    const logos = page.locator(".brand-logo");
    await expect(logos).toHaveCount(2);
    for (const logo of await logos.all()) {
      await expect(logo.locator('img[src="/brand/wordmark-dark.svg"]')).toBeVisible();
      await expect(logo.locator('img[src="/brand/wordmark.svg"]')).toBeHidden();
    }
    await page.getByRole("button", { name: "Toggle colour theme" }).click();
    await page.reload();
    for (const logo of await logos.all()) {
      await expect(logo.locator('img[src="/brand/wordmark.svg"]')).toBeVisible();
      await expect(logo.locator('img[src="/brand/wordmark-dark.svg"]')).toBeHidden();
    }
    await page.getByRole("button", { name: "Toggle colour theme" }).click();
    await page.emulateMedia({ colorScheme: "light" });
    for (const logo of await logos.all()) {
      await expect(logo.locator('img[src="/brand/wordmark-dark.svg"]')).toBeVisible();
    }
  });

  test("the wordmark and primary navigation fit from phone to desktop", async ({ page }) => {
    await page.goto("/");
    for (const width of [320, 390, 640, 641, 768, 896, 897, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const header = page.locator(".site-header");
      const bounds = await header.boundingBox();
      expect(bounds).not.toBeNull();
      for (const el of await header.locator("a:visible, button:visible").all()) {
        const box = await el.boundingBox();
        expect(box).not.toBeNull();
        expect(box?.x).toBeGreaterThanOrEqual(0);
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
      }
      const nav = header.getByRole("navigation", { name: "Primary" });
      expect(await nav.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    }
  });

  for (const { path, heading } of pages) {
    test(`${path} renders and is accessible`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("h1")).toContainText(heading);
      await expect(page.locator(".doc__updated time")).toHaveAttribute(
        "datetime",
        /^\d{4}-\d{2}-\d{2}$/,
      );
      await expectNoSeriousA11yViolations(page);
    });
  }

  test("every page links the legal pages from the footer", async ({ page }) => {
    await page.goto("/mcp/");
    const legal = page.getByRole("navigation", { name: "Legal" });
    for (const link of LEGAL_LINKS) {
      await expect(legal.getByRole("link", { name: link.label })).toHaveAttribute(
        "href",
        link.href,
      );
    }
    const footer = page.locator(".site-footer");
    await expect(footer.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about/");
    await expect(footer.getByRole("link", { name: /Made in Europe/ })).toHaveAttribute(
      "href",
      "/made-in-europe/",
    );
  });

  test("imprint and privacy name the same operator and contact", async ({ page }) => {
    for (const path of ["/imprint/", "/privacy/"]) {
      await page.goto(path);
      const address = page.locator("address");
      await expect(address).toContainText(OPERATOR.name);
      await expect(address).toContainText(OPERATOR.street);
      await expect(page.locator(`a[href="mailto:${OPERATOR.email}"]`).first()).toBeVisible();
    }
  });

  test("the not-found page is built, unindexed and accessible", async ({ page }) => {
    await page.goto("/404.html");
    await expect(page.locator("h1")).toHaveText("No page at this address");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
    await expectNoSeriousA11yViolations(page);
  });

  test("security.txt names a contact and a future expiry (RFC 9116)", async ({ request }) => {
    const res = await request.get("/.well-known/security.txt");
    expect(res.ok()).toBe(true);
    const body = await res.text();
    expect(body).toContain(`Contact: mailto:${OPERATOR.email}`);
    const expires = body.match(/^Expires: (.+)$/m)?.[1];
    expect(expires && Date.parse(expires) > Date.now()).toBe(true);
  });

  test("the share image the pages point to exists", async ({ page, request }) => {
    await page.goto("/");
    const og = await page.locator('meta[property="og:image"]').getAttribute("content");
    const res = await request.get(new URL(og ?? "", "http://x").pathname);
    expect(res.ok()).toBe(true);
    expect(res.headers()["content-type"]).toContain("image/png");
    expect(readFileSync("public/og.png").length).toBeGreaterThan(0);
  });
});
