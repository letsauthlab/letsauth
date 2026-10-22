import { expect, test } from "@playwright/test";
import { currentCell, currentRevision, matrixFor } from "../../src/lib/atlas";
import { ACCESS_ORDER, AUTH_ORDER, accessOf, authOf, countBy } from "../../src/lib/classes";
import { getDataset } from "../../src/lib/data";
import { latestScan } from "../../src/lib/scanner";
import { expectEndStateUnderReducedMotion, expectNoSeriousA11yViolations } from "./helpers";

const data = getDataset();
const revision = currentRevision(data);
const matrix = matrixFor(data, revision.id);
const STATUSES = ["supported", "partial", "unsupported", "unknown", "not-applicable"];

// a server whose newest observation on mcp.as.dcr is "unsupported" with evidence
const withUnsupported = matrix.rows.find(
  (s) => matrix.cells.get(`${s.id}|mcp.as.dcr`)?.status === "unsupported",
);
// on a phone the cells open from their group's view, so the cell tests open that group; on a
// wide screen the anchor changes nothing
const dcrGroup = `#mx-${matrix.columns.find((f) => f.id === "mcp.as.dcr")?.category}`;
// the most common access and auth classes, for the filter tests (009)
const topAccess = [...countBy(matrix.rows, ACCESS_ORDER, accessOf)].sort(
  (a, b) => b.count - a.count,
)[0];
const topAuth = [...countBy(matrix.rows, AUTH_ORDER, authOf)].sort((a, b) => b.count - a.count)[0];
const bothCount = matrix.rows.filter(
  (s) => accessOf(s).value === topAccess?.value && authOf(s).value === topAuth?.value,
).length;
// a server with nothing but unknown cells
const allUnknown = matrix.rows.find((s) =>
  matrix.columns.every((f) => currentCell(data, s, f, revision.id).status === "unknown"),
);

test.describe("matrix page (US1)", () => {
  test("names the revision and renders every server, feature and cell (FR-001)", async ({
    page,
  }) => {
    await page.goto("/mcp/");
    await expect(page.locator("[data-revision]")).toHaveText(revision.id);
    await expect(page.locator("#matrix tbody tr[data-server]")).toHaveCount(matrix.rows.length);
    await expect(page.locator("#matrix thead th[data-feature]")).toHaveCount(matrix.columns.length);
    const cells = page.locator("#matrix tbody td[data-feature]");
    await expect(cells).toHaveCount(matrix.rows.length * matrix.columns.length);
    const statuses = await cells.evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).dataset.status),
    );
    expect(statuses.every((s) => s && STATUSES.includes(s))).toBe(true);
  });

  test("cell detail shows the observation and returns focus on close (FR-002)", async ({
    page,
  }) => {
    test.skip(!withUnsupported, "no server with an unsupported observation in the seed data");
    await page.goto(`/mcp/${dcrGroup}`);
    await expect(page.locator("#matrix[data-enhanced]")).toBeAttached();
    const summary = page.locator(
      `td[data-server="${withUnsupported?.id}"][data-feature="mcp.as.dcr"] summary`,
    );
    await summary.click();
    const dialog = page.locator("dialog.cell-dialog");
    await expect(dialog).toBeVisible();
    // focus lands on the dialog's heading (016 WP4) and goes back to the cell on close
    await expect(dialog.locator("#cell-dialog-title")).toBeFocused();
    await expect(dialog).toContainText("Unsupported");
    const winning = matrix.cells.get(`${withUnsupported?.id}|mcp.as.dcr`)?.observation;
    await expect(dialog).toContainText(winning?.method ?? "vendor-claim");
    await expect(dialog).toContainText(winning?.observedAt.slice(0, 10) ?? "");
    await expect(dialog).toContainText(winning?.observedBy ?? "");
    await expect(dialog.locator("dd a[href^='https://']")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(summary).toBeFocused();
  });

  test("a server without observations reads unknown everywhere, never unsupported (SC-006)", async ({
    page,
  }) => {
    test.skip(!allUnknown, "no all-unknown server in the seed data");
    await page.goto("/mcp/");
    const row = page.locator(`#matrix tbody tr[data-server="${allUnknown?.id}"]`);
    await expect(row.locator("td[data-status='unknown']")).toHaveCount(matrix.columns.length);
    await expect(row.locator("td[data-status='unsupported']")).toHaveCount(0);
    await expect(row.locator("td").first().locator("summary .status-unknown")).toBeVisible();
  });

  test("filter state in the URL restores the filtered view (FR-008)", async ({ page }) => {
    await page.goto("/mcp/?level=MUST&q=stripe");
    await expect(page.locator("#matrix[data-enhanced]")).toBeAttached();
    await expect(page.locator("#matrix-count")).toHaveText(/^1 of \d+ servers/);
    await expect(page.locator("#matrix tbody tr[data-server]:not([hidden])")).toHaveCount(1);
    await expect(page.locator("#matrix tbody tr[data-server]:not([hidden])")).toContainText(
      "Stripe",
    );
    const visibleLevels = await page
      .locator("#matrix thead th[data-feature]:not([hidden])")
      .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.level));
    expect(visibleLevels.length).toBeGreaterThan(0);
    expect(new Set(visibleLevels)).toEqual(new Set(["MUST"]));
    await expect(page.locator("#f-level")).toHaveValue("MUST");
    await expect(page.locator("#f-q")).toHaveValue("stripe");
  });

  test("every row carries its access and auth class as pills (009 FR-002)", async ({ page }) => {
    await page.goto("/mcp/");
    for (const server of matrix.rows.slice(0, 5)) {
      const row = page.locator(`#matrix tbody tr[data-server="${server.id}"]`);
      const access = accessOf(server);
      const auth = authOf(server);
      await expect(row).toHaveAttribute("data-access", access.value);
      await expect(row).toHaveAttribute("data-auth", auth.value);
      const pills = row.locator(".classes .class");
      await expect(pills).toHaveCount(2);
      if (access.derived) await expect(pills.first()).toHaveClass(/derived/);
      else await expect(pills.first()).not.toHaveClass(/derived/);
    }
  });

  test("filters rows by access and auth class from the URL (009 FR-003)", async ({ page }) => {
    await page.goto(`/mcp/?access=${topAccess?.value}&auth=${topAuth?.value}`);
    await expect(page.locator("#matrix[data-enhanced]")).toBeAttached();
    const visible = page.locator("#matrix tbody tr[data-server]:not([hidden])");
    await expect(visible).toHaveCount(bothCount);
    await expect(page.locator("#matrix-count")).toHaveText(
      new RegExp(`^${bothCount} of ${matrix.rows.length} servers`),
    );
    const classes = await visible.evaluateAll((els) =>
      els.map((e) => `${(e as HTMLElement).dataset.access}|${(e as HTMLElement).dataset.auth}`),
    );
    expect(new Set(classes)).toEqual(new Set([`${topAccess?.value}|${topAuth?.value}`]));
    await expect(page.locator("#f-access")).toHaveValue(topAccess?.value ?? "");
    await expect(page.locator("#f-auth")).toHaveValue(topAuth?.value ?? "");
  });

  test("groups rows by a class with a header per group, alphabetical within (009 FR-003)", async ({
    page,
  }) => {
    await page.goto("/mcp/?group=auth");
    await expect(page.locator("#matrix[data-enhanced]")).toBeAttached();
    const present = countBy(matrix.rows, AUTH_ORDER, authOf).filter((c) => c.count > 0);
    const heads = page.locator("#matrix tbody tr.group");
    await expect(heads).toHaveCount(present.length);
    const groups = await heads.evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).dataset.group),
    );
    expect(groups).toEqual(present.map((c) => c.value));
    // rows between two headers share the header's class and stay alphabetical
    const order = await page.locator("#matrix tbody tr:not([hidden])").evaluateAll((els) =>
      els.map((e) => {
        const el = e as HTMLElement;
        return el.classList.contains("group")
          ? `#${el.dataset.group}`
          : `${el.dataset.auth}|${el.dataset.name}`;
      }),
    );
    let current = "";
    let lastName = "";
    for (const entry of order) {
      if (entry.startsWith("#")) {
        current = entry.slice(1);
        lastName = "";
        continue;
      }
      const [cls, name] = entry.split("|");
      expect(cls).toBe(current);
      expect((name ?? "").localeCompare(lastName)).toBeGreaterThanOrEqual(0);
      lastName = name ?? "";
    }
    await page.selectOption("#f-group", "");
    await expect(heads).toHaveCount(0);
    const names = await page
      .locator("#matrix tbody th[scope='row'] a.server-link")
      .allTextContents();
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  test("rows are alphabetical and nothing sorts or scores servers (FR-014)", async ({ page }) => {
    await page.goto("/mcp/");
    const names = await page
      .locator("#matrix tbody th[scope='row'] a.server-link")
      .allTextContents();
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    await expect(page.locator("#matrix [aria-sort]")).toHaveCount(0);
    await expect(page.locator("#matrix thead button")).toHaveCount(0);
    await expect(page.locator("#matrix")).not.toContainText(/score|rank/i);
  });

  test("each server carries its latest scan grade, linked to the report (004 FR-010)", async ({
    page,
  }) => {
    await page.goto("/mcp/");
    const links = page.locator("#matrix tbody th[scope='row'] a.grade-link");
    await expect(links).toHaveCount(matrix.rows.length);
    for (const server of matrix.rows.slice(0, 5)) {
      const scan = latestScan(data, server, revision.id);
      const link = page.locator(`#matrix tbody tr[data-server="${server.id}"] a.grade-link`);
      await expect(link).toHaveAttribute("href", `/mcp/servers/${server.id}/scan/`);
      await expect(link).toHaveAttribute("data-grade", scan.grade.letter ?? scan.grade.label);
      // the badge's word, not its decorative letter, carries the grade for every reader
      await expect(link.locator(".word")).toHaveText(scan.grade.letter ?? scan.grade.label);
    }
  });

  test("keyboard-only walkthrough opens and closes a cell", async ({ page }) => {
    test.skip(!withUnsupported, "no server with an unsupported observation in the seed data");
    await page.goto(`/mcp/${dcrGroup}`);
    await expect(page.locator("#matrix[data-enhanced]")).toBeAttached();
    const summary = page.locator(
      `td[data-server="${withUnsupported?.id}"][data-feature="mcp.as.dcr"] summary`,
    );
    await summary.focus();
    await page.keyboard.press("Enter");
    const dialog = page.locator("dialog.cell-dialog");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(summary).toBeFocused();
  });

  test("has no horizontal page scroll at phone width (constitution V)", async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 900 });
    await page.goto("/mcp/?group=access");
    await expect(page.locator("#matrix[data-enhanced]")).toBeAttached();
    const [scroll, inner] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      window.innerWidth,
    ]);
    expect(scroll).toBeLessThanOrEqual(inner ?? 0);
  });

  test("a group scrolls inside its region at 320px with the server column sticky (016 WP4)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/mcp/#mx-discovery");
    await expect(page.locator("#matrix[data-enhanced]")).toBeAttached();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      320,
    );
    const region = page.locator(".matrix-scroll");
    const first = page.locator("#matrix tbody th.server-cell").first();
    const before = await first.boundingBox();
    await region.evaluate((el) => {
      el.scrollLeft = 400;
    });
    expect(await region.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    const after = await first.boundingBox();
    expect(after?.x).toBe(before?.x);
  });

  test("on a phone, All fits every requirement without sideways scroll (follow-up 5)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/mcp/");
    await expect(page.locator("#matrix[data-enhanced]")).toBeAttached();
    await expect(page.locator("#mx-all")).toHaveAttribute("aria-current", "true");
    const region = page.locator(".matrix-scroll");
    expect(await region.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    const row = page.locator("#matrix tbody tr[data-server]").first();
    for (const td of await row.locator("td[data-feature]").all()) await expect(td).toBeVisible();
  });

  test("on a phone, a group shows only its columns with labels written across (follow-up 5)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/mcp/");
    await expect(page.locator("#matrix[data-enhanced]")).toBeAttached();
    const category = matrix.columns[0]?.category ?? "";
    const inGroup = matrix.columns.filter((f) => f.category === category);
    await page.locator(`#mx-${category}`).click();
    await expect(page.locator(`#mx-${category}`)).toHaveAttribute("aria-current", "true");
    await expect(page).toHaveURL(new RegExp(`#mx-${category}$`));
    const row = page.locator("#matrix tbody tr[data-server]").first();
    await expect(row.locator("td[data-feature]:visible")).toHaveCount(inGroup.length);
    const head = page.locator(`#matrix thead th[data-feature="${inGroup[0]?.id}"] .feature-link`);
    expect(await head.evaluate((el) => getComputedStyle(el).writingMode)).toBe("horizontal-tb");
    await page.locator("#mx-all").click();
    await expect(row.locator("td[data-feature]:visible")).toHaveCount(matrix.columns.length);
  });

  test("looks right in greyscale: the five status forms differ in shape (016 WP4)", async ({
    page,
  }) => {
    await page.goto("/mcp/");
    const legend = page.locator(".legend__statuses");
    await legend.evaluate((el) => {
      (el as HTMLElement).style.filter = "grayscale(1)";
    });
    await expect(legend).toHaveScreenshot("status-shapes.png");
  });

  test("cell detail opens without motion under reduced motion (M10)", async ({ page }) => {
    test.skip(!withUnsupported, "no server with an unsupported observation in the seed data");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/mcp/${dcrGroup}`);
    await expect(page.locator("#matrix[data-enhanced]")).toBeAttached();
    await page
      .locator(`td[data-server="${withUnsupported?.id}"][data-feature="mcp.as.dcr"] summary`)
      .click();
    const dialog = page.locator("dialog.cell-dialog");
    await expect(dialog).toBeVisible();
    const running = await dialog.evaluate(
      (el) => el.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length,
    );
    expect(running).toBe(0);
    expect(await dialog.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  });

  test("the crosshair shows at once under reduced motion (M9)", async ({ page }) => {
    await page.goto("/mcp/");
    await expectEndStateUnderReducedMotion(page, "#matrix tbody tr[data-server]");
    const row = page.locator("#matrix tbody tr[data-server]").nth(1);
    const cell = row.locator("td[data-feature]").nth(3);
    await cell.hover();
    const running = await row.evaluate(
      (el) => el.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length,
    );
    expect(running).toBe(0);
    expect(await cell.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
      "rgba(0, 0, 0, 0)",
    );
  });

  test("has no serious accessibility violations", async ({ page }) => {
    // axe walks every cell and its observation, which takes most of the default 30 s on a busy runner
    test.slow();
    await page.goto("/mcp/");
    await expectNoSeriousA11yViolations(page);
  });

  test("looks right", async ({ page }) => {
    await page.goto("/mcp/");
    await expect(page.locator("#matrix[data-enhanced]")).toBeAttached();
    await expect(page).toHaveScreenshot("matrix.png", {
      mask: [page.locator("#matrix a.grade-link")],
    });
  });
});

test.describe("matrix page without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("renders the full matrix and native cell details", async ({ page }) => {
    test.skip(!withUnsupported, "no server with an unsupported observation in the seed data");
    await page.goto(`/mcp/?level=MUST${dcrGroup}`);
    await expect(page.locator("#matrix tbody tr[data-server]")).toHaveCount(matrix.rows.length);
    await expect(page.locator("#matrix tbody tr[data-server]:not([hidden])")).toHaveCount(
      matrix.rows.length,
    );
    const details = page.locator(
      `td[data-server="${withUnsupported?.id}"][data-feature="mcp.as.dcr"] details`,
    );
    await details.locator("summary").click();
    await expect(details).toHaveAttribute("open", "");
    const winning = matrix.cells.get(`${withUnsupported?.id}|mcp.as.dcr`)?.observation;
    await expect(details.locator("[data-detail]")).toContainText(winning?.method ?? "vendor-claim");
  });

  test("on a phone, the group picker works through plain anchors (follow-up 5)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/mcp/");
    const category = matrix.columns[0]?.category ?? "";
    const inGroup = matrix.columns.filter((f) => f.category === category);
    const row = page.locator("#matrix tbody tr[data-server]").first();
    await expect(row.locator("td[data-feature]:visible")).toHaveCount(matrix.columns.length);
    await page.locator(`#mx-${category}`).click();
    await expect(row.locator("td[data-feature]:visible")).toHaveCount(inGroup.length);
    // every group is still in the HTML
    await expect(row.locator("td[data-feature]")).toHaveCount(matrix.columns.length);
  });

  test("highlights the row and column under the pointer without the island (M9)", async ({
    page,
  }) => {
    await page.goto("/mcp/");
    const row = page.locator("#matrix tbody tr[data-server]").nth(2);
    const cell = row.locator("td[data-feature]").nth(4);
    const plain = page.locator("#matrix tbody tr[data-server]").nth(8).locator("td").nth(4);
    await cell.hover();
    const tint = (el: Element, pseudo?: string) => getComputedStyle(el, pseudo).backgroundColor;
    await expect
      .poll(() => cell.evaluate((el) => getComputedStyle(el).backgroundColor))
      .not.toBe("rgba(0, 0, 0, 0)");
    expect(await cell.evaluate(tint, "::after")).not.toBe("rgba(0, 0, 0, 0)");
    // the column band reaches the other rows: it covers a cell of the same column further down
    const band = await cell.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const after = getComputedStyle(el, "::after");
      return { top: parseFloat(after.top), height: r.height };
    });
    expect(band.top).toBeLessThan(-band.height);
    expect(await plain.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      "rgba(0, 0, 0, 0)",
    );
  });

  test("renders every row alphabetically with its class pills and no group rows (009 FR-003)", async ({
    page,
  }) => {
    await page.goto("/mcp/?group=auth&access=public");
    await expect(page.locator("#matrix tbody tr.group")).toHaveCount(0);
    await expect(page.locator("#matrix tbody tr[data-server] .classes .class")).toHaveCount(
      matrix.rows.length * 2,
    );
    const names = await page
      .locator("#matrix tbody th[scope='row'] a.server-link")
      .allTextContents();
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});
