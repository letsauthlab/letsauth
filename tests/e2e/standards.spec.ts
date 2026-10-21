import { expect, test } from "@playwright/test";
import { getDataset } from "../../src/lib/data";
import { BODY_LABEL, MATURITY_LABEL } from "../../src/lib/labels";
import { buildsOnSpine, mapRelations, specNodes, specsByBody } from "../../src/lib/standards";
import { expectEndStateUnderReducedMotion, expectNoSeriousA11yViolations } from "./helpers";

const data = getDataset();
const nodes = specNodes(data);
const relations = mapRelations(data);
const bodies = specsByBody(nodes);
const competes = relations.filter((r) => r.type === "competes-with");
const spine = buildsOnSpine(nodes, relations);
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

  for (const width of [320, 412]) {
    test(`has no horizontal page scroll at ${width}px (SC-004)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/standards/");
      const [scroll, inner] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        window.innerWidth,
      ]);
      expect(scroll).toBeLessThanOrEqual(inner ?? 0);
    });
  }

  test("the map comes right after the head, the filters fold behind one button (follow-up 4)", async ({
    page,
  }) => {
    await page.goto("/standards/");
    expect((await page.locator("h1").textContent())?.trim().length).toBeLessThan(24);
    await expect(page.locator("#map-filters")).toBeHidden();
    const head = await page.locator(".page-head").boundingBox();
    const frame = await page.locator("#map-frame").boundingBox();
    expect((frame?.y ?? 0) - ((head?.y ?? 0) + (head?.height ?? 0))).toBeLessThan(80);
    await page.locator("#map-filter-panel > summary").click();
    await expect(page.locator("#map-filters")).toBeVisible();
  });

  test("the frame shows the whole drawing with no inner vertical scroll (follow-up 4)", async ({
    page,
  }) => {
    await page.goto("/standards/");
    const [scrollHeight, clientHeight] = await page
      .locator("#map-frame")
      .evaluate((el) => [el.scrollHeight, el.clientHeight]);
    expect(scrollHeight).toBeLessThanOrEqual(clientHeight + 1);
  });

  test("phones get the stacked drawing at full width (follow-up 4)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/standards/");
    await expect(page.locator("#map")).toBeHidden();
    await expect(page.locator("#map-stacked")).toBeVisible();
    await expect(page.locator("#map-stacked a[data-spec]")).toHaveCount(nodes.length);
    await expect(page.locator("#map-stacked path[data-relation]")).toHaveCount(relations.length);
    const [scroll, inner] = await page
      .locator("#map-frame")
      .evaluate((el) => [el.scrollWidth, el.clientWidth]);
    expect(scroll).toBeLessThanOrEqual(inner ?? 0);
  });

  test("the builds-on spine draws in once, from the oldest document (M4)", async ({ page }) => {
    test.skip(spine.length === 0, "no builds-on chain in the seed data");
    await page.goto("/standards/");
    const edges = page.locator(".map-svg:visible path.edge.spine");
    await expect(edges).toHaveCount(spine.length);
    const runs = await edges.evaluateAll((els) =>
      els.flatMap((el) =>
        el.getAnimations().map((a) => ({
          name: (a as CSSAnimation).animationName,
          iterations: a.effect?.getTiming().iterations,
        })),
      ),
    );
    expect(runs.length).toBe(spine.length);
    for (const run of runs) expect(run).toEqual({ name: "map-draw", iterations: 1 });
    const first = spine[0];
    await expect(
      page.locator(`#map path[data-relation="${first?.from}|builds-on|${first?.to}"]`),
    ).toHaveClass(/spine/);
  });

  test("under reduced motion the spine is drawn complete with no halo (M4)", async ({ page }) => {
    await page.goto("/standards/");
    await expectEndStateUnderReducedMotion(page, "#map-frame");
    const offsets = await page
      .locator("#map path.edge.spine")
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).strokeDashoffset));
    for (const offset of offsets) expect(offset).toBe("0px");
    const halos = await page
      .locator("#map .spine-halo")
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity));
    for (const opacity of halos) expect(opacity).toBe("0");
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
    await page.locator("#map-filter-panel > summary").click();
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
    const map = page.locator(".map-svg:visible");
    const node = map.locator(`a[data-spec="${rel?.from}"]`);
    await node.scrollIntoViewIfNeeded();
    await node.hover();
    await expect(map.locator(`a[data-spec="${rel?.to}"]`)).toHaveClass(/is-near/);
    await expect(
      map.locator(`path[data-relation="${rel?.from}|${rel?.type}|${rel?.to}"]`),
    ).toHaveClass(/is-near/);
    expect(await map.locator("a[data-spec].is-far").count()).toBeGreaterThan(0);
  });

  test("keyboard focus on a node highlights its neighbourhood as hover does", async ({ page }) => {
    const rel = relations[0];
    test.skip(!rel, "no relation in the seed data");
    await page.goto("/standards/");
    await expect(page.locator("#map-frame[data-enhanced]")).toBeAttached();
    const map = page.locator(".map-svg:visible");
    await map.locator(`a[data-spec="${rel?.from}"]`).focus();
    await expect(map.locator(`a[data-spec="${rel?.to}"]`)).toHaveClass(/is-near/);
    await expect(
      map.locator(`path[data-relation="${rel?.from}|${rel?.type}|${rel?.to}"]`),
    ).toHaveClass(/is-near/);
    expect(await map.locator("a[data-spec].is-far").count()).toBeGreaterThan(0);
    await map.locator(`a[data-spec="${rel?.from}"]`).blur();
    await expect(page.locator(".map-svg .is-far")).toHaveCount(0);
  });

  test("the legend explains relations by line and maturity by chip", async ({ page }) => {
    await page.goto("/standards/");
    const used = new Set(relations.map((r) => r.type));
    await expect(page.locator("[data-legend='relations'] dt svg")).toHaveCount(used.size);
    const maturities = new Set(nodes.map((s) => s.maturity));
    await expect(page.locator("[data-legend='maturity'] dt .chip")).toHaveCount(maturities.size);
  });

  // the title ends in "looks right" so the refresh-screenshots workflow regenerates its baseline
  test("the map reads in greyscale and looks right", async ({ page }) => {
    await page.goto("/standards/");
    await page.addStyleTag({ content: "html { filter: grayscale(1) }" });
    await expect(page.locator("#map-frame")).toHaveScreenshot("standards-greyscale.png");
  });

  test("has no serious accessibility violations and looks right", async ({ page }) => {
    await page.goto("/standards/");
    await expect(page.locator("#map-frame[data-enhanced]")).toBeAttached();
    await expectNoSeriousA11yViolations(page);
    await expect(page).toHaveScreenshot("standards.png", { fullPage: false });
  });
});
