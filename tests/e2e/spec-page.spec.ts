import { expect, test } from "@playwright/test";
import { getDataset } from "../../src/lib/data";
import { featuresDefinedBy, relationsOf, specRevisionsNewestFirst } from "../../src/lib/standards";
import { expectNoSeriousA11yViolations } from "./helpers";

const data = getDataset();
const mcp = data.specs.find((s) => s.id === "mcp-authorization");
if (!mcp) throw new Error("the seed data needs mcp-authorization");
const mcpRevisions = specRevisionsNewestFirst(mcp);
const mcpDefined = featuresDefinedBy(data, mcp.id);
// a spec with both incoming and outgoing directed relations
const twoWay = data.specs.find((s) => {
  const g = relationsOf(data, s.id);
  return g.outgoing.size > 0 && g.incoming.size > 0;
});
const gone = data.specs.find((s) => s.maturity === "withdrawn" || s.maturity === "expired");

test.describe("spec page (US2)", () => {
  test("lists revisions newest first with the current one marked and its change note (FR-008)", async ({
    page,
  }) => {
    await page.goto(`/standards/${mcp.id}/`);
    const items = page.locator("[data-revisions] li");
    await expect(items).toHaveCount(mcpRevisions.length);
    const ids = await items.evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).dataset.revision),
    );
    expect(ids).toEqual(mcpRevisions.map((r) => r.id));
    const current = page.locator("[data-revisions] li[data-status='current']");
    await expect(current).toHaveCount(1);
    await expect(current).toContainText("2026-07-28");
    await expect(current.locator(".changes")).toContainText("Client ID Metadata Documents");
    await expect(current.locator("a.diff")).toHaveAttribute(
      "href",
      "/mcp/changes/2025-11-25/2026-07-28/",
    );
  });

  test("lists the features the current revision defines with their level (FR-008)", async ({
    page,
  }) => {
    await page.goto(`/standards/${mcp.id}/`);
    await expect(page.locator("[data-defines] li")).toHaveCount(mcpDefined.length);
    const cimd = page.locator("[data-defines] li[data-feature='mcp.as.cimd']");
    await expect(cimd.locator("a").first()).toHaveAttribute("href", "/mcp/features/mcp.as.cimd/");
    await expect(cimd.locator(".level")).toHaveText("SHOULD");
  });

  test("shows outgoing and incoming relations with the other spec linked and the note (FR-008)", async ({
    page,
  }) => {
    test.skip(!twoWay, "no spec with relations in both directions in the seed data");
    const groups = relationsOf(data, twoWay?.id ?? "");
    await page.goto(`/standards/${twoWay?.id}/`);
    await expect(page.locator("[data-relation-group^='out-']")).toHaveCount(groups.outgoing.size);
    await expect(page.locator("[data-relation-group^='in-']")).toHaveCount(groups.incoming.size);
    const [type, entries] = [...groups.outgoing.entries()][0] ?? [];
    const first = entries?.[0];
    test.skip(!first || !type, "no outgoing relation");
    const li = page.locator(
      `[data-relation-group='out-${type}'] li[data-other='${first?.other.id}']`,
    );
    await expect(li.locator("a").first()).toHaveAttribute("href", `/standards/${first?.other.id}/`);
    if (first?.relation.note)
      await expect(li.locator(".why")).toContainText(first.relation.note.slice(0, 30));
  });

  test("a withdrawn or expired spec shows the notice and keeps its page (FR-014)", async ({
    page,
  }) => {
    test.skip(!gone, "no withdrawn or expired spec in the seed data");
    await page.goto(`/standards/${gone?.id}/`);
    await expect(page.locator("#gone")).toBeVisible();
    await expect(page.locator("h1")).toHaveText(gone?.name ?? "");
    if (gone?.maturity === "withdrawn") {
      await page.goto("/standards/");
      await expect(page.locator(`#map a[data-spec="${gone.id}"]`)).toHaveCount(0);
      await expect(page.locator(`[data-withdrawn="${gone.id}"]`)).toHaveCount(1);
    }
  });

  test("the title carries the view transition name the map hands over (M2)", async ({ page }) => {
    await page.goto(`/standards/${mcp.id}/`);
    const name = await page
      .locator(".page-head h1")
      .evaluate((el) => getComputedStyle(el).viewTransitionName);
    expect(name).toBe("spec-title");
  });

  test("has no serious accessibility violations and looks right", async ({ page }) => {
    await page.goto("/standards/rfc8693/");
    await expectNoSeriousA11yViolations(page);
    await expect(page).toHaveScreenshot("spec.png");
  });
});
