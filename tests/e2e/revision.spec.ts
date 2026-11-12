import { expect, test } from "@playwright/test";
import {
  currentRevision,
  matrixColumns,
  revisionObserved,
  revisionPairs,
  revisionsNewestFirst,
} from "../../src/lib/atlas";
import { getDataset } from "../../src/lib/data";

const data = getDataset();
const current = currentRevision(data);
const pair = revisionPairs(data).at(-1);
if (!pair) throw new Error("the seed data needs two revisions");
const [older, newer] = pair;

test.describe("revisions (US5)", () => {
  test("a revision with no observations has no matrix page and nothing links one (FR-006)", async ({
    page,
  }) => {
    const unobserved = revisionsNewestFirst(data).filter(
      (r) => r.id !== current.id && !revisionObserved(data, r.id),
    );
    for (const r of unobserved) {
      const res = await page.goto(`/mcp/revisions/${r.id}/`);
      expect(res?.status()).toBe(404);
    }
    for (const path of [
      "/",
      `/mcp/changes/${older.id}/${newer.id}/`,
      "/mcp/features/mcp.as.dcr/",
    ]) {
      await page.goto(path);
      for (const r of unobserved) {
        await expect(page.locator(`a[href="/mcp/revisions/${r.id}/"]`)).toHaveCount(0);
      }
    }
  });

  test("an older revision with observations shows its own name and feature set (FR-006)", async ({
    page,
  }) => {
    test.skip(
      !revisionObserved(data, older.id),
      "no observation recorded against an older revision",
    );
    await page.goto(`/mcp/revisions/${older.id}/`);
    await expect(page.locator("[data-revision]")).toHaveText(older.id);
    await expect(page.locator("#matrix thead th[data-feature]")).toHaveCount(
      matrixColumns(data, older.id).length,
    );
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

  test("the current revision canonicalises to the home page", async ({ page }) => {
    await page.goto(`/mcp/revisions/${current.id}/`);
    await page.waitForURL((url) => url.pathname === "/");
    await expect(page.locator("[data-revision]")).toHaveText(current.id);
  });

  test("the matrix header links to the changes page for changed columns", async ({ page }) => {
    await page.goto("/");
    const badge = page.locator("th[data-feature='mcp.as.dcr'] a.changed");
    await expect(badge).toHaveAttribute("href", `/mcp/changes/${older.id}/${newer.id}/`);
  });
});
