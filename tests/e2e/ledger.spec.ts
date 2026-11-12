import { expect, test } from "@playwright/test";
import { cellKey, currentRevision, matrixFor } from "../../src/lib/atlas";
import { changesByDay, statusChanges } from "../../src/lib/changes";
import { getDataset } from "../../src/lib/data";
import { expectNoSeriousA11yViolations } from "./helpers";

const data = getDataset();
const revision = currentRevision(data);
const matrix = matrixFor(data, revision.id);
const changes = statusChanges(data, revision.id).filter((c) =>
  matrix.cells.has(cellKey(c.server, c.feature)),
);
const days = changesByDay(changes);

test.describe("ledger page (019)", () => {
  test("lists every day with a change, newest first", async ({ page }) => {
    await page.goto("/ledger/");
    await expect(page.locator("h1")).toHaveText("The ledger");
    await expect(page.locator(".facts dd").first()).toHaveText(String(changes.length));
    const dates = page.locator(".ledger__date time");
    await expect(dates).toHaveCount(days.length);
    await expect(dates).toHaveText(days.map(([day]) => day));
  });

  test("puts the evidence and the earlier observations beside a line", async ({ page }) => {
    await page.goto("/ledger/");
    const line = page.locator("li.change").first();
    await expect(line.locator(".change__evidence")).toContainText("observed");
    const earlier = line.locator(".change__evidence details");
    await expect(earlier.locator("summary")).toContainText("earlier observation");
    await earlier.locator("summary").click();
    await expect(earlier.locator("li").first()).toBeVisible();
  });

  test("draws the matrix in small with the changed cells lit", async ({ page }) => {
    await page.goto("/ledger/");
    const thumb = page.locator(".page-head__aside svg.matrix-thumb");
    await expect(thumb).toHaveAttribute("aria-label", /the cells that have changed lit/);
    await expect(thumb.locator("g.faint")).toHaveCount(1);
    await expect(page.locator("a.page-head__aside")).toHaveAttribute("href", "/");
  });

  test("a server's page lights its row and carries its own ledger", async ({ page }) => {
    const server = changes[0]?.server ?? "";
    await page.goto(`/mcp/servers/${server}/`);
    await expect(page.locator(".page-head__aside svg.matrix-thumb")).toHaveAttribute(
      "aria-label",
      /the row of .+ lit/,
    );
    const mine = changes.filter((c) => c.server === server);
    const section = page.locator("section[aria-labelledby='ledger']");
    await expect(section.locator("h2")).toHaveText("This server's ledger");
    await expect(section.locator("li.change")).toHaveCount(mine.length);
    await expect(section.locator(".change__server")).toHaveCount(0);
  });

  test("a requirement's page lights its column and carries its own ledger", async ({ page }) => {
    const feature = changes[0]?.feature ?? "";
    await page.goto(`/mcp/features/${feature}/`);
    await expect(page.locator(".page-head__aside svg.matrix-thumb")).toHaveAttribute(
      "aria-label",
      /the column of .+ lit/,
    );
    const mine = changes.filter((c) => c.feature === feature);
    const section = page.locator("section[aria-labelledby='ledger']");
    await expect(section.locator("li.change")).toHaveCount(mine.length);
    await expect(section.locator(".change__server").first()).toBeVisible();
  });

  test("has no serious accessibility violations and looks right", async ({ page }) => {
    await page.goto("/ledger/");
    await expectNoSeriousA11yViolations(page);
    await expect(page).toHaveScreenshot("ledger.png", { fullPage: false });
  });
});
