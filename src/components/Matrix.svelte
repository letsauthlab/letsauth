<script lang="ts">
/**
 * Progressive enhancement over the server-rendered matrix table. The table in the DOM is the
 * source of truth: this island only hides rows and columns, syncs the query string and shows a
 * cell's <details> content in a dialog with focus return. Without JS, the page is complete.
 */
import { onMount } from "svelte";

let dialog: HTMLDialogElement;
let heading: HTMLHeadingElement;
let detailHost: HTMLDivElement;
let opener: HTMLElement | null = null;

const PARAMS = ["level", "category", "party", "q", "access", "auth", "group"] as const;
type Param = (typeof PARAMS)[number];
// the width in rem below which a group's label counts as wider than its columns (MatrixTable)
const NARROW_COLUMN_REM = 2.75;

onMount(() => {
  const table = document.getElementById("matrix");
  const count = document.getElementById("matrix-count");
  const form = document.getElementById("matrix-filters") as HTMLFormElement | null;
  if (!table || !form) return;

  const controls: Record<Param, HTMLInputElement | HTMLSelectElement | null> = {
    level: form.querySelector("#f-level"),
    category: form.querySelector("#f-category"),
    party: form.querySelector("#f-party"),
    q: form.querySelector("#f-q"),
    access: form.querySelector("#f-access"),
    auth: form.querySelector("#f-auth"),
    group: form.querySelector("#f-group"),
  };
  const heads = Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th[data-feature]"));
  const groupHeads = Array.from(
    table.querySelectorAll<HTMLTableCellElement>("thead tr.groups th[data-category]"),
  );
  const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr[data-server]"));
  const total = rows.length;
  const tbody = table.querySelector("tbody");
  const featureCol = table.querySelector<HTMLTableColElement>(".matrix__feature-col");
  // the server-rendered order is alphabetical; grouping keeps it inside each group
  const alphabetical = [...rows];
  // group labels and order, read from the filter options so the island carries no copy of them
  const groupMeta = (key: "access" | "auth") =>
    Array.from(controls[key]?.querySelectorAll("option") ?? [])
      .filter((o) => o.value)
      .map((o) => ({
        value: o.value,
        label: o.textContent?.replace(/\s*\(\d+\)$/, "") ?? o.value,
      }));

  const state = (): Record<Param, string> => ({
    level: controls.level?.value ?? "",
    category: controls.category?.value ?? "",
    party: controls.party?.value ?? "",
    q: (controls.q?.value ?? "").trim().toLowerCase(),
    access: controls.access?.value ?? "",
    auth: controls.auth?.value ?? "",
    group: controls.group?.value ?? "",
  });

  // whether the rows are out of their server-rendered order, so A to Z has something to undo
  let grouped = false;

  /** Re-orders the rows by a class and inserts one header row per non-empty group (009). */
  function regroup(by: string, columns: number) {
    if (!tbody) return;
    if (by !== "access" && by !== "auth") {
      if (!grouped) return;
      for (const tr of tbody.querySelectorAll("tr.group")) tr.remove();
      for (const tr of alphabetical) tbody.appendChild(tr);
      grouped = false;
      return;
    }
    grouped = true;
    for (const tr of tbody.querySelectorAll("tr.group")) tr.remove();
    for (const g of groupMeta(by)) {
      const members = alphabetical.filter((tr) => tr.dataset[by] === g.value && !tr.hidden);
      if (members.length === 0) continue;
      const head = document.createElement("tr");
      head.className = "group";
      head.dataset.group = g.value;
      const th = document.createElement("th");
      th.scope = "colgroup";
      th.textContent = `${by === "access" ? "Access" : "Auth"}: ${g.label}`;
      const n = document.createElement("span");
      n.className = "n";
      n.textContent = String(members.length);
      th.appendChild(n);
      head.appendChild(th);
      const td = document.createElement("td");
      td.colSpan = Math.max(columns, 1);
      head.appendChild(td);
      tbody.appendChild(head);
      for (const tr of members) tbody.appendChild(tr);
    }
    // hidden rows keep their place at the end so a later filter change finds them
    for (const tr of alphabetical) if (tr.hidden) tbody.appendChild(tr);
  }

  // the feature columns shown last time, so a change of rows alone leaves the cells untouched
  let shownFeatures = heads.map((th) => th.dataset.feature ?? "").join(" ");

  function apply(pushUrl = true) {
    const s = state();
    const visibleFeatures = new Set<string>();
    const perCategory = new Map<string, number>();
    for (const th of heads) {
      const show =
        (!s.level || th.dataset.level === s.level) &&
        (!s.category || th.dataset.category === s.category) &&
        (!s.party || th.dataset.party === s.party);
      th.hidden = !show;
      const id = th.dataset.feature ?? "";
      if (show) {
        visibleFeatures.add(id);
        const c = th.dataset.category ?? "";
        perCategory.set(c, (perCategory.get(c) ?? 0) + 1);
      }
    }
    // on wide screens a group whose label outgrows its columns takes the label's width
    let narrowRem = 0;
    let wideCols = 0;
    for (const gh of groupHeads) {
      const n = perCategory.get(gh.dataset.category ?? "") ?? 0;
      gh.hidden = n === 0;
      if (n === 0) continue;
      gh.colSpan = n;
      gh.style.setProperty("--n", String(n));
      const label = Number(gh.dataset.labelRem ?? 0);
      const narrow = label > n * NARROW_COLUMN_REM;
      gh.toggleAttribute("data-narrow", narrow);
      if (narrow) narrowRem += label;
      else wideCols += n;
    }
    const featureKey = [...visibleFeatures].join(" ");
    const columnsChanged = featureKey !== shownFeatures;
    shownFeatures = featureKey;
    let shown = 0;
    for (const tr of rows) {
      const match =
        (!s.q || (tr.dataset.name ?? "").includes(s.q)) &&
        (!s.access || tr.dataset.access === s.access) &&
        (!s.auth || tr.dataset.auth === s.auth);
      if (tr.hidden === match) tr.hidden = !match;
      if (match) shown += 1;
      if (!columnsChanged) continue;
      for (const td of tr.querySelectorAll<HTMLTableCellElement>("td[data-feature]")) {
        td.hidden = !visibleFeatures.has(td.dataset.feature ?? "");
      }
    }
    if (columnsChanged) {
      // the table's layout is fixed: its width and the feature column follow the columns shown
      table.style.setProperty("--cols", String(visibleFeatures.size));
      table.style.setProperty("--wide-cols", String(wideCols));
      table.style.setProperty("--narrow-w", `${narrowRem}rem`);
      if (featureCol) featureCol.span = Math.max(visibleFeatures.size, 1);
    }
    regroup(s.group, visibleFeatures.size);
    if (count) {
      count.textContent = `${shown} of ${total} servers, ${visibleFeatures.size} of ${heads.length} features`;
    }
    if (pushUrl) {
      const params = new URLSearchParams();
      for (const key of PARAMS)
        if (s[key]) params.set(key, key === "q" ? (controls.q?.value ?? "").trim() : s[key]);
      const qs = params.toString();
      history.replaceState(null, "", `${qs ? `?${qs}` : location.pathname}${location.hash}`);
    }
  }

  // restore from the URL; with nothing to restore, the server-rendered table is already right
  const initial = new URLSearchParams(location.search);
  let restored = false;
  for (const key of PARAMS) {
    const v = initial.get(key);
    const el = controls[key];
    if (v && el) {
      el.value = v;
      restored = true;
    }
  }
  if (restored) {
    apply(false);
    // a filtered view opens the folded filters, so the reader sees what is applied
    const panel = form.closest("details");
    if (panel) panel.open = true;
  }
  table.dataset.enhanced = "true";

  // the phone view's group picker: the anchors work through :target without the island; with it
  // the choice is a data attribute, so switching keeps the scroll position and the history
  const view = document.querySelector<HTMLElement>("[data-matrix-view]");
  const tabs = Array.from(view?.querySelectorAll<HTMLAnchorElement>(".matrix-tabs a") ?? []);
  const region = view?.querySelector<HTMLElement>(".matrix-scroll");
  function showView(id: string) {
    if (!view) return;
    view.dataset.view = id;
    for (const a of tabs) {
      if (a.id === `mx-${id}`) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    }
  }
  const viewFromHash = () => {
    const id = location.hash.startsWith("#mx-") ? location.hash.slice(4) : "";
    showView(tabs.some((a) => a.id === `mx-${id}`) ? id : "all");
  };
  viewFromHash();
  // a link from elsewhere on the page, or the back button, still picks a group
  window.addEventListener("hashchange", viewFromHash);
  for (const a of tabs) {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const id = a.id.slice(3);
      showView(id);
      if (region) region.scrollLeft = 0;
      const hash = id === "all" ? "" : `#${a.id}`;
      history.replaceState(null, "", `${location.pathname}${location.search}${hash}`);
    });
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  controls.q?.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => apply(), 150);
  });
  for (const key of ["level", "category", "party", "access", "auth", "group"] as const) {
    controls[key]?.addEventListener("change", () => apply());
  }
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    apply();
  });
  form.addEventListener("reset", () => {
    // let the browser clear the fields first
    setTimeout(() => apply(), 0);
  });

  // cell detail in a dialog, with focus return
  table.addEventListener("click", (e) => {
    const summary = (e.target as HTMLElement).closest<HTMLElement>("details.cell > summary");
    if (!summary) return;
    e.preventDefault();
    const details = summary.parentElement as HTMLDetailsElement;
    const content = details.querySelector("[data-detail]");
    if (!content) return;
    opener = summary;
    detailHost.replaceChildren(content.cloneNode(true));
    dialog.showModal();
    heading.focus();
  });
  dialog.addEventListener("close", () => {
    opener?.focus();
    opener = null;
  });
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
});
</script>

<dialog bind:this={dialog} class="cell-dialog" aria-labelledby="cell-dialog-title">
  <div class="cell-dialog__inner">
    <div class="cell-dialog__bar">
      <h2 id="cell-dialog-title" tabindex="-1" bind:this={heading}>Observation</h2>
      <form method="dialog">
        <button type="submit" class="button small quiet" aria-label="Close">Close</button>
      </form>
    </div>
    <div bind:this={detailHost}></div>
  </div>
</dialog>

<style>
  /*
   * M10: the backdrop fades in and the panel rises 8px over --dur, from @starting-style. Flat:
   * the backdrop veils the page in its own ground instead of a shadow lifting the panel.
   */
  .cell-dialog {
    border: 1px solid var(--rule-strong);
    border-radius: var(--radius);
    background: var(--ground-2);
    color: var(--ink);
    padding: 0;
    width: min(34rem, calc(100vw - 2rem));
    opacity: 1;
    translate: 0 0;
    transition:
      opacity var(--dur) var(--ease),
      translate var(--dur) var(--ease),
      overlay var(--dur) allow-discrete,
      display var(--dur) allow-discrete;
  }
  .cell-dialog:not([open]) {
    opacity: 0;
    translate: 0 8px;
  }
  .cell-dialog::backdrop {
    background: color-mix(in oklch, var(--ground) 78%, transparent);
    opacity: 1;
    transition:
      opacity var(--dur) var(--ease),
      overlay var(--dur) allow-discrete,
      display var(--dur) allow-discrete;
  }
  .cell-dialog:not([open])::backdrop {
    opacity: 0;
  }
  @starting-style {
    .cell-dialog[open] {
      opacity: 0;
      translate: 0 8px;
    }
    .cell-dialog[open]::backdrop {
      opacity: 0;
    }
  }
  .cell-dialog__inner {
    padding: var(--space-4) var(--space-5) var(--space-5);
  }
  .cell-dialog__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }
  .cell-dialog__bar h2 {
    font-size: var(--small);
    font-weight: 500;
    color: var(--ink-2);
    margin: 0;
  }
  .cell-dialog__bar h2:focus {
    outline: none;
  }
  .cell-dialog__bar h2:focus-visible {
    outline: 2px solid var(--signal);
    outline-offset: 3px;
  }
  .cell-dialog__bar form {
    margin: 0;
  }
</style>
