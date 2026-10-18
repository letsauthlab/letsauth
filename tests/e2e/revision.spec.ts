import { expect, test } from "@playwright/test";
import { currentRevision, matrixColumns, revisionPairs } from "../../src/lib/atlas";
import { getDataset } from "../../src/lib/data";

const data = getDataset();
const current = currentRevision(data);
const pair = revisionPairs(data).at(-1);
if (!pair) throw new Error("the seed data needs two revisions");
const [older, newer] = pair;

test.describe("revisions (US5)", () => {
  test("an older revision shows its own name and feature set (FR-006)", async ({ page }) => {
    await page.goto(`/mcp/revisions/${older.id}/`);
    await expect(page.locator("[data-revision]")).toHaveText(older.id);
    await expect(page.locator("#matrix thead th[data-feature]")).toHaveCount(
      matrixColumns(data, older.id).length,
    );
    await expect(page.locator("#matrix thead th[data-feature='mcp.as.iss-param']")).toHaveCount(0);
  });

  test("the changes page lists level changes and additions (FR-007)", async ({ page }) => {
    await page.goto(`/mcp/changes/${older.id}/${newer.id}/`);
    const dcr = page.locator(
      "#changed ~ ul li[data-feature='mcp.as.dcr'], [aria-labelledby='changed'] li[data-feature='mcp.as.dcr']",
    );
    await expect(dcr).toHaveCount(1);
    await expect(dcr.locator(".level").nth(0)).toHaveText("SHOULD");
    await expect(dcr.locator(".level").nth(1)).toHaveText("MAY");
    await expect(
      page.locator("[aria-labelledby='added'] li[data-feature='mcp.as.iss-param']"),
    ).toHaveCount(1);
  });

  test("the current revision canonicalises to /mcp/", async ({ page }) => {
    await page.goto(`/mcp/revisions/${current.id}/`);
    await page.waitForURL("**/mcp/");
    await expect(page.locator("[data-revision]")).toHaveText(current.id);
  });

  test("the matrix header links to the changes page for changed columns", async ({ page }) => {
    await page.goto("/mcp/");
    const badge = page.locator("th[data-feature='mcp.as.dcr'] a.changed");
    await expect(badge).toHaveAttribute("href", `/mcp/changes/${older.id}/${newer.id}/`);
  });
});
