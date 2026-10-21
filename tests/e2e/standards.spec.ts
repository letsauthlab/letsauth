import { expect, type Page, test } from "@playwright/test";
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

/** Edges are paths, and a straight one has no box, so visibility is read from style, not layout. */
async function shownEdges(page: Page, selector: string): Promise<number> {
  return page
    .locator(selector)
    .evaluateAll((els) => els.filter((el) => getComputedStyle(el).visibility !== "hidden").length);
}

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
    await expect(page.locator("#spec-list .family")).not.toHaveCount(0);
    await expect(page.locator("#spec-list li[data-spec]")).toHaveCount(nodes.length);
    // a spec that builds on another sits nested under it (follow-up 4)
    const dep = relations.find((r) => r.type === "builds-on");
    if (dep) {
      await expect(
        page.locator(`#spec-list li[data-spec="${dep.to}"] li[data-spec="${dep.from}"]`),
      ).toHaveCount(1);
    }
    const entry = page.locator(`#spec-list li[data-spec="${first.id}"]`);
    const row = entry.locator("> .row");
    await expect(row.locator("a").first()).toHaveAttribute("href", `/standards/${first.id}/`);
    await expect(row.locator("[data-maturity]")).toHaveAttribute("data-maturity", first.maturity);
    await expect(row.locator("time")).toHaveCount(1);
  });

  test("renders fully without JavaScript, filter note shown (FR-006)", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/standards/?type=competes-with");
    await expect(page.locator("#map a[data-spec]")).toHaveCount(nodes.length);
    await expect(page.locator("#map path[data-relation]")).toHaveCount(relations.length);
    await expect(page.locator("#map-frame[data-enhanced]")).toHaveCount(0);
    await expect(page.locator("[data-noscript-note]")).toBeVisible();
    await expect(page.locator("#spec-list li[data-spec]")).toHaveCount(nodes.length);
    await context.close();
  });

  test("the toggles filter the outline with JavaScript off, through the stylesheet alone", async ({
    browser,
  }) => {
    const body = bodies[bodies.length - 1]?.body ?? "eu";
    const own = nodes.filter((s) => s.body === body);
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/standards/");
    await page.locator(`#map-filters input[name='body'][value='${body}']`).uncheck();
    await expect(page.locator("#spec-list li[data-spec] > .row:visible")).toHaveCount(
      nodes.length - own.length,
    );
    await context.close();
  });

  test("the map opens with references hidden and the legend as the filter (follow-up 4)", async ({
    page,
  }) => {
    const refs = relations.filter((r) => r.type === "references");
    test.skip(refs.length === 0, "no references relation in the seed data");
    await page.goto("/standards/");
    const narrow = (page.viewportSize()?.width ?? 1280) < 640;
    await expect(page.locator("#map-filters input[value='references']")).not.toBeChecked();
    await expect(page.locator("#map-filters input[value='builds-on']")).toBeChecked();
    if (!narrow) {
      expect(await shownEdges(page, "#map path.edge-references")).toBe(0);
      expect(await shownEdges(page, "#map path.edge-builds-on")).toBeGreaterThan(0);
      await page.locator("#map-filters input[value='references']").check();
      expect(await shownEdges(page, "#map path.edge-references")).toBe(refs.length);
    } else {
      await expect(page.locator("#spec-list .xl[data-type='references']:visible")).toHaveCount(0);
      await page.locator("#map-filters input[value='references']").check();
      await expect(page.locator("#spec-list .xl[data-type='references']:visible")).not.toHaveCount(
        0,
      );
    }
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

  test("the drawing fills the frame at full height, with no inner vertical scroll (follow-up 4)", async ({
    page,
  }) => {
    await page.goto("/standards/");
    const narrow = (page.viewportSize()?.width ?? 1280) < 640;
    test.skip(narrow, "phones get the outline, not the drawing");
    expect((await page.locator("h1").textContent())?.trim().length).toBeLessThan(24);
    const [scrollHeight, clientHeight] = await page
      .locator("#map-frame")
      .evaluate((el) => [el.scrollHeight, el.clientHeight]);
    expect(scrollHeight).toBeLessThanOrEqual(clientHeight + 1);
  });

  test("phones get the outline and the toggles, not the drawing (follow-up 4)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/standards/");
    await expect(page.locator("#map")).toBeHidden();
    await expect(page.locator("#map-filters input[name='type']")).not.toHaveCount(0);
    await expect(page.locator("#spec-list li[data-spec]")).toHaveCount(nodes.length);
    await expect(page.locator("#spec-list")).toBeVisible();
    const [scroll, inner] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      window.innerWidth,
    ]);
    expect(scroll).toBeLessThanOrEqual(inner ?? 0);
  });

  test("recently revised is a view of the map: the dated nodes stay, the rest fades (follow-up 4)", async ({
    page,
  }) => {
    await page.goto("/standards/?view=recent");
    await expect(page.locator("#map-frame[data-enhanced]")).toBeAttached();
    await expect(page.locator("#map-filters input[value='recent']")).toBeChecked();
    await expect(page.locator("#map a[data-spec][data-recent]")).toHaveCount(5);
    await expect(page.locator("#spec-list li[data-spec][data-recent]")).toHaveCount(5);
    const narrow = (page.viewportSize()?.width ?? 1280) < 640;
    if (!narrow) {
      const faded = page.locator("#map a[data-spec]:not([data-recent])").first();
      expect(await faded.evaluate((el) => getComputedStyle(el).opacity)).toBe("0.2");
      const kept = page.locator("#map a[data-spec][data-recent]").first();
      expect(await kept.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    }
    await page.locator("#map-filters input[value='recent']").uncheck();
    await expect(page).not.toHaveURL(/view=/);
  });

  test("the builds-on spine draws in once, from the oldest document (M4)", async ({ page }) => {
    test.skip(spine.length === 0, "no builds-on chain in the seed data");
    await page.goto("/standards/");
    test.skip((page.viewportSize()?.width ?? 1280) < 640, "phones get the outline");
    const edges = page.locator("#map path.edge.spine");
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
    test.skip((page.viewportSize()?.width ?? 1280) < 640, "phones get the outline");
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
    const narrow = (page.viewportSize()?.width ?? 1280) < 640;
    if (!narrow) {
      expect(await shownEdges(page, "#map path[data-relation]")).toBe(competes.length);
      await expect(page.locator("#map a[data-spec]:visible")).toHaveCount(nodes.length);
    }
    await expect(page.locator("#map-count")).toHaveText(
      new RegExp(`${competes.length} of ${relations.length} relations`),
    );
    await expect(page.locator("#map-filters input[value='competes-with']")).toBeChecked();
    await expect(page.locator("#map-filters input[value='builds-on']")).not.toBeChecked();
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
    const narrow = (page.viewportSize()?.width ?? 1280) < 640;
    for (const other of bodies.filter((g) => g.body !== body)) {
      await page.locator(`#map-filters input[name='body'][value='${other.body}']`).uncheck();
    }
    if (!narrow) {
      await expect(page.locator("#map a[data-spec]:visible")).toHaveCount(own.length);
      expect(await shownEdges(page, "#map path[data-relation]")).toBe(
        ownEdges.filter((r) => r.type !== "references").length,
      );
    }
    await expect(page.locator("#spec-list li[data-spec] > .row:visible")).toHaveCount(own.length);
    await expect(page).toHaveURL(new RegExp(`body=${body}`));
    await page.locator("#map-filters button[type='reset']").click();
    await expect(page.locator("#spec-list li[data-spec] > .row:visible")).toHaveCount(nodes.length);
    await expect(page).not.toHaveURL(/body=/);
  });

  test("hovering a node highlights its neighbourhood", async ({ page }) => {
    const rel = relations[0];
    test.skip(!rel, "no relation in the seed data");
    await page.goto("/standards/");
    test.skip((page.viewportSize()?.width ?? 1280) < 640, "phones get the outline");
    await expect(page.locator("#map-frame[data-enhanced]")).toBeAttached();
    const map = page.locator("#map");
    const node = map.locator(`a[data-spec="${rel?.from}"]`);
    await node.scrollIntoViewIfNeeded();
    await node.hover();
    // the rail reads the node's relations in words (follow-up 4)
    const from = nodes.find((s) => s.id === rel?.from);
    await expect(page.locator("#map-card")).toContainText(from?.name ?? "");
    await expect(page.locator("#map-card dd").first()).toBeVisible();
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
    test.skip((page.viewportSize()?.width ?? 1280) < 640, "phones get the outline");
    await expect(page.locator("#map-frame[data-enhanced]")).toBeAttached();
    const map = page.locator("#map");
    await map.locator(`a[data-spec="${rel?.from}"]`).focus();
    await expect(map.locator(`a[data-spec="${rel?.to}"]`)).toHaveClass(/is-near/);
    await expect(
      map.locator(`path[data-relation="${rel?.from}|${rel?.type}|${rel?.to}"]`),
    ).toHaveClass(/is-near/);
    expect(await map.locator("a[data-spec].is-far").count()).toBeGreaterThan(0);
    await map.locator(`a[data-spec="${rel?.from}"]`).blur();
    await expect(page.locator("#map .is-far")).toHaveCount(0);
  });

  test("the rail is the legend: one line sample per relation type, one chip per maturity", async ({
    page,
  }) => {
    await page.goto("/standards/");
    const used = new Set(relations.map((r) => r.type));
    await expect(page.locator("#map-filters .toggle svg.sample")).toHaveCount(used.size);
    const maturities = new Set(nodes.map((s) => s.maturity));
    await expect(page.locator("#map-filters .maturities .chip")).toHaveCount(maturities.size);
  });

  // the title ends in "looks right" so the refresh-screenshots workflow regenerates its baseline
  test("the map reads in greyscale and looks right", async ({ page }) => {
    await page.goto("/standards/");
    await page.addStyleTag({ content: "html { filter: grayscale(1) }" });
    const narrow = (page.viewportSize()?.width ?? 1280) < 640;
    await expect(page.locator(narrow ? "#spec-list" : "#map-frame")).toHaveScreenshot(
      "standards-greyscale.png",
    );
  });

  test("has no serious accessibility violations and looks right", async ({ page }) => {
    await page.goto("/standards/");
    await expect(page.locator("#map-frame[data-enhanced]")).toBeAttached();
    await expectNoSeriousA11yViolations(page);
    await expect(page).toHaveScreenshot("standards.png", { fullPage: false });
  });
});
