import { expect, test } from "@playwright/test";
import { getDataset } from "../../src/lib/data";
import { BODY_LABEL, MATURITY_LABEL } from "../../src/lib/labels";
import { mapRelations, specNodes, specsByBody } from "../../src/lib/standards";
import { expectNoSeriousA11yViolations } from "./helpers";

const data = getDataset();
const nodes = specNodes(data);
const relations = mapRelations(data);
const bodies = specsByBody(nodes);
const competes = relations.filter((r) => r.type === "competes-with");
const first = nodes[0];
if (!first) throw new Error("the seed data needs at least one spec");

test.describe("standards map (US1)", () => {
  test("renders one node per spec and one edge per relation, every node a link (FR-001)", async ({
    page,
  }) => {
    await page.goto("/standards/");
    await expect(page.locator("#map a[data-spec]")).toHaveCount(nodes.length);
    await expect(page.locator("#map path[data-relation]")).toHaveCount(relations.length);
    const node = page.locator(`#map a[data-spec="${first.id}"]`);
    await expect(node).toHaveAttribute("href", `/standards/${first.id}/`);
    const label = (await node.getAttribute("aria-label")) ?? "";
    expect(label).toContain(first.name);
    expect(label).toContain(BODY_LABEL[first.body]);
    expect(label).toContain(MATURITY_LABEL[first.maturity]);
  });

  test("an edge names both specs and the relation in its title (FR-003)", async ({ page }) => {
    await page.goto("/standards/");
    const rel = relations.find((r) => r.note);
    test.skip(!rel, "no relation with a note in the seed data");
    const edge = page.locator(
      `#map path[data-relation="${rel?.from}|${rel?.type}|${rel?.to}"] title`,
    );
    const from = nodes.find((s) => s.id === rel?.from)?.name ?? "";
    const to = nodes.find((s) => s.id === rel?.to)?.name ?? "";
    await expect(edge).toContainText(from);
    await expect(edge).toContainText(to);
  });

  test("lists every spec grouped by body with maturity and current revision (FR-015)", async ({
    page,
  }) => {
    await page.goto("/standards/");
    await expect(page.locator("#spec-list [data-body-group]")).toHaveCount(bodies.length);
    await expect(page.locator("#spec-list li[data-spec]")).toHaveCount(nodes.length);
    const entry = page.locator(`#spec-list li[data-spec="${first.id}"]`);
    await expect(entry.locator("a").first()).toHaveAttribute("href", `/standards/${first.id}/`);
    await expect(entry.locator("[data-maturity]")).toHaveAttribute("data-maturity", first.maturity);
    await expect(entry.locator("time")).toHaveCount(1);
  });

  test("renders fully without JavaScript, filter note shown (FR-006)", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/standards/?type=competes-with");
    await expect(page.locator("#map a[data-spec]")).toHaveCount(nodes.length);
    await expect(page.locator("#map path[data-relation]")).toHaveCount(relations.length);
    await expect(page.locator("#map-frame[data-enhanced]")).toHaveCount(0);
    await expect(page.locator("[data-noscript-note]")).toBeVisible();
    await context.close();
  });

  test("has no horizontal page scroll at phone width (SC-004)", async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 900 });
    await page.goto("/standards/");
    const [scroll, inner] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      window.innerWidth,
    ]);
    expect(scroll).toBeLessThanOrEqual(inner ?? 0);
  });

  test("filter state in the URL restores the filtered view (FR-007)", async ({ page }) => {
    test.skip(competes.length === 0, "no competes-with relation in the seed data");
    await page.goto("/standards/?type=competes-with");
    await expect(page.locator("#map-frame[data-enhanced]")).toBeAttached();
    await expect(page.locator("#map path[data-relation]:not(.is-hidden)")).toHaveCount(
      competes.length,
    );
    await expect(page.locator("#map path[data-relation].is-hidden")).toHaveCount(
      relations.length - competes.length,
    );
    await expect(page.locator("#map a[data-spec]:not(.is-hidden)")).toHaveCount(nodes.length);
    await expect(page.locator("#map-count")).toHaveText(
      new RegExp(`${competes.length} of ${relations.length} relations`),
    );
    await expect(page.locator("#map-filters input[value='competes-with']")).toBeChecked();
  });

  test("filtering by body hides other bodies' nodes and their edges, and is written to the URL", async ({
    page,
  }) => {
    const body = bodies[bodies.length - 1]?.body ?? "eu";
    const own = nodes.filter((s) => s.body === body);
    const ownIds = new Set(own.map((s) => s.id));
    const ownEdges = relations.filter((r) => ownIds.has(r.from) && ownIds.has(r.to));
    await page.goto("/standards/");
    await expect(page.locator("#map-frame[data-enhanced]")).toBeAttached();
    await page.locator(`#map-filters input[name='body'][value='${body}']`).check();
    await expect(page.locator("#map a[data-spec]:not(.is-hidden)")).toHaveCount(own.length);
    await expect(page.locator("#map path[data-relation]:not(.is-hidden)")).toHaveCount(
      ownEdges.length,
    );
    await expect(page.locator("#spec-list li[data-spec]:not([hidden])")).toHaveCount(own.length);
    await expect(page).toHaveURL(new RegExp(`body=${body}`));
    await page.locator("#map-filters button[type='reset']").click();
    await expect(page.locator("#map a[data-spec]:not(.is-hidden)")).toHaveCount(nodes.length);
  });

  test("hovering a node highlights its neighbourhood", async ({ page }) => {
    const rel = relations[0];
    test.skip(!rel, "no relation in the seed data");
    await page.goto("/standards/");
    await expect(page.locator("#map-frame[data-enhanced]")).toBeAttached();
    const node = page.locator(`#map a[data-spec="${rel?.from}"]`);
    await node.scrollIntoViewIfNeeded();
    await node.hover();
    await expect(page.locator(`#map a[data-spec="${rel?.to}"]`)).toHaveClass(/is-near/);
    await expect(
      page.locator(`#map path[data-relation="${rel?.from}|${rel?.type}|${rel?.to}"]`),
    ).toHaveClass(/is-near/);
    expect(await page.locator("#map a[data-spec].is-far").count()).toBeGreaterThan(0);
  });

  test("has no serious accessibility violations and looks right", async ({ page }) => {
    await page.goto("/standards/");
    await expect(page.locator("#map-frame[data-enhanced]")).toBeAttached();
    await expectNoSeriousA11yViolations(page);
    await expect(page).toHaveScreenshot("standards.png", { fullPage: false });
  });
});
