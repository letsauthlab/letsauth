import { expect, test } from "@playwright/test";
import { cellHistory, currentCell, currentRevision, matrixColumns } from "../../src/lib/atlas";
import { getDataset } from "../../src/lib/data";
import { expectNoSeriousA11yViolations } from "./helpers";

const data = getDataset();
const revision = currentRevision(data);
const columns = matrixColumns(data, revision.id);

// a (server, feature) with at least two observations under the current revision
let withHistory:
  | { server: (typeof data.servers)[number]; feature: (typeof columns)[number] }
  | undefined;
for (const server of data.servers) {
  if (server.withdrawn) continue;
  for (const feature of columns) {
    if (cellHistory(data, server.id, feature.id, revision.id).length > 0) {
      withHistory = { server, feature };
      break;
    }
  }
  if (withHistory) break;
}
const withdrawn = data.servers.find((s) => s.withdrawn);
const listed = data.servers.find((s) => !s.withdrawn && s.source);
const classified = data.servers.find((s) => !s.withdrawn && s.access && s.auth);
const unclassified = data.servers.find((s) => !s.withdrawn && !s.auth);

test.describe("server page (US2)", () => {
  test("shows the newest observation as current and older ones under history (FR-004)", async ({
    page,
  }) => {
    test.skip(!withHistory, "no server has two observations on one feature in the seed data");
    if (!withHistory) return;
    const { server, feature } = withHistory;
    const current = currentCell(data, server, feature, revision.id);
    const older = cellHistory(data, server.id, feature.id, revision.id);
    await page.goto(`/mcp/servers/${server.id}/`);
    const row = page.locator(`tr[data-feature="${feature.id}"]`);
    await expect(row).toHaveAttribute("data-status", current.status);
    const history = row.locator("details.history");
    await history.locator("summary").click();
    await expect(history.locator("li")).toHaveCount(older.length);
    await expect(history.locator("li").first()).toContainText(
      older[0]?.observedAt.slice(0, 10) ?? "",
    );
  });

  test("shows the listing reason and source link", async ({ page }) => {
    test.skip(!listed, "no listed server with a source");
    await page.goto(`/mcp/servers/${listed?.id}/`);
    await expect(page.locator("h1")).toHaveText(listed?.name ?? "");
    await expect(page.getByText("Why it is listed")).toBeVisible();
    await expect(page.locator(`a[href="${listed?.source}"]`).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Contribute a correction" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Withdraw this server" })).toBeVisible();
  });

  test("states access and auth with method, date and evidence (009 FR-004)", async ({ page }) => {
    test.skip(!classified, "no classified server in the data");
    if (!classified?.access || !classified.auth) return;
    await page.goto(`/mcp/servers/${classified.id}/`);
    const access = page.locator("dd[data-class='access']");
    await expect(access).toHaveAttribute("data-value", classified.access.class);
    await expect(access).toHaveAttribute("data-derived", "false");
    await expect(access).toContainText(classified.access.observedAt.slice(0, 10));
    await expect(access).toContainText(classified.access.observedBy);
    const url = classified.access.evidence.match(/^(https:\/\/\S+)/)?.[1];
    if (url) await expect(access.locator(`a[href="${url}"]`)).toBeVisible();
    const auth = page.locator("dd[data-class='auth']");
    await expect(auth).toHaveAttribute("data-value", classified.auth.class);
  });

  test("a server nobody classified reads as a derived unknown (009 FR-002)", async ({ page }) => {
    test.skip(!unclassified, "every server carries a class statement");
    await page.goto(`/mcp/servers/${unclassified?.id}/`);
    const auth = page.locator("dd[data-class='auth']");
    await expect(auth).toHaveAttribute("data-value", "unknown");
    await expect(auth).toHaveAttribute("data-derived", "true");
    await expect(auth).toContainText("nobody has stated this yet");
  });

  test("a withdrawn server shows the notice and has no matrix row", async ({ page }) => {
    test.skip(!withdrawn, "no withdrawn server in the seed data");
    await page.goto(`/mcp/servers/${withdrawn?.id}/`);
    await expect(page.getByText("Withdrawn from the atlas")).toBeVisible();
    await expect(page.locator("table.features")).toHaveCount(0);
    await page.goto("/mcp/");
    await expect(page.locator(`#matrix tbody tr[data-server="${withdrawn?.id}"]`)).toHaveCount(0);
  });

  test("has no serious accessibility violations and looks right", async ({ page }) => {
    await page.goto(`/mcp/servers/${listed?.id}/`);
    await expectNoSeriousA11yViolations(page);
    await expect(page).toHaveScreenshot("server.png");
  });
});
