import { expect, test } from "@playwright/test";
import { cellKey, currentRevision, matrixFor } from "../../src/lib/atlas";
import { changedSince, dayOf, statusChanges } from "../../src/lib/changes";
import { getDataset } from "../../src/lib/data";
import { expectNoSeriousA11yViolations } from "./helpers";

const data = getDataset();
const revision = currentRevision(data);
const matrix = matrixFor(data, revision.id);
const changes = statusChanges(data, revision.id).filter((c) =>
  matrix.cells.has(cellKey(c.server, c.feature)),
);
const newestDay = dayOf(changes[0]?.observation.observedAt ?? "");
const dotted = changedSince(changes, newestDay);

test.describe("home page: the matrix, then the ledger (019)", () => {
  test("is the matrix, under the site's own title", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveText("Agent authorization, on the record");
    await expect(page.locator("table.matrix tbody tr[data-server]")).toHaveCount(
      matrix.rows.length,
    );
    await expect(
      page.getByRole("navigation", { name: "Primary" }).locator('a[aria-current="page"]'),
    ).toHaveText("Matrix");
  });

  test("names the state of the record under the header", async ({ page }) => {
    await page.goto("/");
    const record = page.locator(".record__line");
    await expect(record).toContainText("Record of");
    await expect(record.locator("time")).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}T/);
    await expect(record.getByRole("link")).toHaveText(`MCP Authorization ${revision.id}`);
  });

  test("dots the cells of the newest day with a change", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("table.matrix td[data-changed]")).toHaveCount(dotted.size);
    const [first] = [...dotted];
    const [server, feature] = (first ?? "|").split("|");
    await expect(
      page.locator(`table.matrix td[data-server="${server}"][data-feature="${feature}"]`),
    ).toHaveAttribute("data-changed", "");
  });

  test("shows the ledger since the last run under the matrix, newest first", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("section[aria-labelledby='since']");
    await expect(section.locator("h2")).toHaveText("The ledger, since the last run");
    await expect(section.locator(".ledger__date time").first()).toHaveText(newestDay);
    const lines = section.locator("li.change");
    expect(await lines.count()).toBeGreaterThan(0);
    expect(await lines.count()).toBeLessThanOrEqual(6);
    await expect(lines.first().locator(".change__evidence")).toContainText("observed");
    await expect(section.getByRole("link", { name: /Open the ledger/ })).toHaveAttribute(
      "href",
      "/ledger/",
    );
  });

  test("forwards the old matrix address to the home page", async ({ page }) => {
    await page.goto("/mcp/");
    await page.waitForURL((url) => url.pathname === "/");
    await expect(page.locator("table.matrix")).toBeVisible();
  });

  test("sets h1 and h2 in the serif", async ({ page }) => {
    await page.goto("/");
    for (const selector of ["h1", "#since"]) {
      const family = await page.locator(selector).evaluate((el) => getComputedStyle(el).fontFamily);
      expect(family).toContain("Newsreader");
    }
  });

  test("does not scroll sideways on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/");
    const { scroll, inner } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      inner: window.innerWidth,
    }));
    expect(scroll).toBeLessThanOrEqual(inner);
  });

  test("has no serious accessibility violations", async ({ page }) => {
    await page.goto("/");
    await expectNoSeriousA11yViolations(page);
  });
});

test.describe("home page without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("has the matrix and the ledger in the HTML", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("table.matrix")).toBeVisible();
    await expect(page.locator("section[aria-labelledby='since'] li.change").first()).toBeVisible();
  });
});
