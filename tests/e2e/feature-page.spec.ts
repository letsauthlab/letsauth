import { expect, test } from "@playwright/test";
import {
  currentCell,
  currentRevision,
  featureInRevision,
  featureShare,
  matrixRows,
} from "../../src/lib/atlas";
import { getDataset } from "../../src/lib/data";
import { expectNoSeriousA11yViolations } from "./helpers";

const data = getDataset();
const revision = currentRevision(data);
const feature = data.features.find((f) => f.id === "mcp.as.dcr");
if (!feature) throw new Error("mcp.as.dcr missing from the seed data");
const entry = featureInRevision(feature, revision.id);
const share = featureShare(data, feature.id, revision.id);

test.describe("feature page (US3)", () => {
  test("cites the revision document and section (FR-005, SC-002)", async ({ page }) => {
    await page.goto(`/mcp/features/${feature.id}/`);
    const cite = page.locator('[aria-labelledby="definition"] cite a');
    await expect(cite).toHaveAttribute("href", revision.url);
    await expect(cite).toHaveText(entry?.section ?? "");
    await expect(page.locator('[aria-labelledby="definition"] .level')).toHaveText(
      entry?.level ?? "",
    );
  });

  test("share excludes unknown and not-applicable and shows both counts", async ({ page }) => {
    await page.goto(`/mcp/features/${feature.id}/`);
    const known = share.supported + share.partial + share.unsupported;
    const line = page.locator(".share-line");
    if (share.share === null) {
      await expect(line).toContainText("No server has been observed yet");
    } else {
      await expect(line).toContainText(`${Math.round(share.share * 100)}%`);
      await expect(line).toContainText(`of the ${known} server`);
    }
    await expect(line).toContainText(
      `${share.unknown} unknown and ${share.notApplicable} not applicable`,
    );
  });

  test("server lists per status match the matrix column", async ({ page }) => {
    await page.goto(`/mcp/features/${feature.id}/`);
    const expected = new Map<string, string[]>();
    for (const server of matrixRows(data)) {
      const status = currentCell(data, server, feature, revision.id).status;
      expected.set(status, [...(expected.get(status) ?? []), server.name]);
    }
    for (const [status, names] of expected) {
      const list = page.locator(`[aria-labelledby="list-${status}"] li`);
      await expect(list).toHaveCount(names.length);
      expect(await list.allTextContents()).toEqual(names);
    }
  });

  test("has no serious accessibility violations and looks right", async ({ page }) => {
    await page.goto(`/mcp/features/${feature.id}/`);
    await expectNoSeriousA11yViolations(page);
    await expect(page).toHaveScreenshot("feature.png");
  });
});
