import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** Fails on serious or critical axe violations (WCAG 2.2 AA tags). */
export async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    serious.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`),
  ).toEqual([]);
}

/**
 * Asserts that, with reduced motion requested, the element is visible and already in its end
 * state: no animation or transition on it or inside it is running (plan 016, section 3.5).
 * When a page is already open, it is reloaded so it loads under reduced motion from the start.
 */
export async function expectEndStateUnderReducedMotion(page: Page, selector: string) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  if (page.url() !== "about:blank") await page.reload();
  const element = page.locator(selector).first();
  await expect(element).toBeVisible();
  const running = await element.evaluate((el) =>
    el
      .getAnimations({ subtree: true })
      .filter((a) => a.playState === "running")
      .map((a) => {
        const name =
          a instanceof CSSAnimation
            ? a.animationName
            : a instanceof CSSTransition
              ? a.transitionProperty
              : a.id;
        return name || a.constructor.name;
      }),
  );
  expect(running, `running animations or transitions in ${selector}`).toEqual([]);
}
