import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { LEGAL_LINKS, OPERATOR } from "../../src/lib/site";
import { expectEndStateUnderReducedMotion, expectNoSeriousA11yViolations } from "./helpers";

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
      const nav = header.getByRole("navigation", { name: "Primary" });
      const navBox = await nav.boundingBox();
      expect(navBox).not.toBeNull();
      const left = navBox?.x ?? 0;
      const right = left + (navBox?.width ?? 0);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(right).toBeLessThanOrEqual(width);
      // the brand, the GitHub link and the theme toggle sit inside the viewport
      for (const el of await header.locator(".brand, .site-github, .theme-toggle").all()) {
        const box = await el.boundingBox();
        expect(box).not.toBeNull();
        expect(box?.x).toBeGreaterThanOrEqual(0);
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
      }
      // a navigation row that does not fit scrolls sideways, with no visible scrollbar
      const style = await nav.evaluate((el: HTMLElement) => ({
        overflows: el.scrollWidth > el.clientWidth,
        overflowX: getComputedStyle(el).overflowX,
        scrollbar: getComputedStyle(el).scrollbarWidth,
        bar: el.offsetHeight - el.clientHeight,
      }));
      if (style.overflows) {
        expect(style.overflowX, `nav at ${width}px`).toBe("auto");
        expect(style.scrollbar).toBe("none");
      }
      expect(style.bar).toBe(0);
      // every destination can be scrolled fully into view inside the row, at 13px or more
      const links = await nav.evaluate((el) => {
        const row = el.getBoundingClientRect();
        const out = [...el.querySelectorAll("a")].map((a) => {
          a.scrollIntoView({ block: "nearest", inline: "nearest" });
          const box = a.getBoundingClientRect();
          return {
            label: a.textContent?.trim(),
            inside: box.left >= row.left - 0.5 && box.right <= row.right + 0.5,
            size: Number.parseFloat(getComputedStyle(a).fontSize),
          };
        });
        el.scrollLeft = 0;
        return out;
      });
      expect(links).toHaveLength(5);
      for (const link of links) {
        expect(link.inside, `${link.label} at ${width}px`).toBe(true);
        expect(link.size).toBeGreaterThanOrEqual(13);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    }
    await expect(page.getByRole("link", { name: "Source on GitHub" }).first()).toBeVisible();
  });

  test("the current section is marked and shown in the navigation", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/breaches/");
    const current = page
      .getByRole("navigation", { name: "Primary" })
      .locator('a[aria-current="page"]');
    await expect(current).toHaveText("Breaches");
    await expect(current).toBeInViewport({ ratio: 1 });
    expect(await current.evaluate((el) => getComputedStyle(el).borderBottomWidth)).toBe("2px");
  });

  test("the header is flat and scrolls away with the page", async ({ page }) => {
    await page.goto("/about/");
    const header = page.locator(".site-header");
    const style = await header.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { position: cs.position, shadow: cs.boxShadow, filter: cs.backdropFilter };
    });
    expect(style).toEqual({ position: "static", shadow: "none", filter: "none" });
    await expect(page.locator(".wip")).toContainText("Work in progress");
  });

  test("the reading progress bar shows where scroll-driven animation is supported", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/privacy/");
    const bar = page.locator(".reading-progress");
    const supported = await page.evaluate(() => CSS.supports("animation-timeline: scroll()"));
    if (!supported) {
      await expect(bar).toBeHidden();
      return;
    }
    // at the top of the page the bar is scaled to nothing, so test that it is rendered
    expect(await bar.evaluate((el) => getComputedStyle(el).display)).toBe("block");
    const scaleAt = () => bar.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
    expect(await scaleAt()).toBeLessThan(0.05);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(scaleAt).toBeGreaterThan(0.95);
  });

  test("under reduced motion there is no progress bar and nothing moves", async ({ page }) => {
    await page.goto("/privacy/");
    await expectEndStateUnderReducedMotion(page, "body");
    await expect(page.locator(".reading-progress")).toBeHidden();
    const running = await page.evaluate(() =>
      document.getAnimations().map((a) => (a as CSSAnimation).animationName ?? a.id),
    );
    expect(running).toEqual([]);
    const button = page.getByRole("button", { name: "Toggle colour theme" });
    expect(await button.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s, 0s");
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
