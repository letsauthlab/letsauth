<script lang="ts">
/**
 * Progressive enhancement over the server-rendered standards map. The two drawings (wide and
 * stacked, one shown by width) and the spec list in the DOM are the source of truth: this island only hides edges, nodes and list entries that
 * fall outside the filter, syncs the query string, and highlights a node's neighbourhood on
 * hover and focus. Without JS the page is complete. It also hands the followed node or list entry
 * to the cross-document view transition, so it grows into the spec page's title (plan 016, M2).
 */
import { onMount } from "svelte";

onMount(() => {
  const svg = document.getElementById("map");
  const frame = document.getElementById("map-frame");
  const form = document.getElementById("map-filters") as HTMLFormElement | null;
  const count = document.getElementById("map-count");
  if (!svg || !form) return;

  const typeBoxes = Array.from(form.querySelectorAll<HTMLInputElement>("input[name='type']"));
  const bodyBoxes = Array.from(form.querySelectorAll<HTMLInputElement>("input[name='body']"));
  const nodes = Array.from(document.querySelectorAll<SVGElement>(".map-svg a[data-spec]"));
  const edges = Array.from(document.querySelectorAll<SVGElement>(".map-svg path[data-relation]"));
  const entries = Array.from(document.querySelectorAll<HTMLElement>("#spec-list [data-spec]"));
  const groups = Array.from(document.querySelectorAll<HTMLElement>("#spec-list [data-body-group]"));
  // both drawings hold every node and edge, so the totals come from the wide one
  const totalSpecs = svg.querySelectorAll("a[data-spec]").length;
  const totalRelations = svg.querySelectorAll("path[data-relation]").length;

  const checked = (boxes: HTMLInputElement[]) =>
    new Set(boxes.filter((b) => b.checked).map((b) => b.value));

  function apply(pushUrl = true) {
    const types = checked(typeBoxes);
    const bodies = checked(bodyBoxes);
    const allTypes = types.size === 0 || types.size === typeBoxes.length;
    const allBodies = bodies.size === 0 || bodies.size === bodyBoxes.length;

    const shownNodes = new Set<string>();
    for (const node of nodes) {
      const show = allBodies || bodies.has(node.dataset.body ?? "");
      node.classList.toggle("is-hidden", !show);
      if (show) shownNodes.add(node.dataset.spec ?? "");
    }
    let shownEdges = 0;
    for (const edge of edges) {
      const show =
        (allTypes || types.has(edge.dataset.type ?? "")) &&
        shownNodes.has(edge.dataset.from ?? "") &&
        shownNodes.has(edge.dataset.to ?? "");
      edge.classList.toggle("is-hidden", !show);
      if (show && svg.contains(edge)) shownEdges += 1;
    }
    for (const entry of entries) entry.hidden = !shownNodes.has(entry.dataset.spec ?? "");
    for (const group of groups) {
      group.hidden = !(allBodies || bodies.has(group.dataset.bodyGroup ?? ""));
    }
    if (count) {
      count.textContent = `${shownNodes.size} of ${totalSpecs} specifications, ${shownEdges} of ${totalRelations} relations`;
    }
    if (pushUrl) {
      const params = new URLSearchParams();
      if (!allTypes) for (const t of types) params.append("type", t);
      if (!allBodies) for (const b of bodies) params.append("body", b);
      const qs = params.toString();
      history.replaceState(null, "", `${location.pathname}${qs ? `?${qs}` : ""}${location.hash}`);
    }
  }

  // restore state from the URL
  const params = new URLSearchParams(location.search);
  const urlTypes = new Set(params.getAll("type"));
  const urlBodies = new Set(params.getAll("body"));
  for (const b of typeBoxes) b.checked = urlTypes.has(b.value);
  for (const b of bodyBoxes) b.checked = urlBodies.has(b.value);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    apply();
  });
  form.addEventListener("change", () => apply());
  form.addEventListener("reset", () => {
    requestAnimationFrame(() => apply());
  });
  form.querySelector("[data-noscript-note]")?.remove();

  // neighbourhood highlight
  const neighbours = new Map<string, Set<string>>();
  for (const edge of edges) {
    const a = edge.dataset.from ?? "";
    const b = edge.dataset.to ?? "";
    (neighbours.get(a) ?? neighbours.set(a, new Set()).get(a))?.add(b);
    (neighbours.get(b) ?? neighbours.set(b, new Set()).get(b))?.add(a);
  }
  function highlight(id: string | null) {
    if (!id) {
      for (const el of [...nodes, ...edges]) el.classList.remove("is-near", "is-far");
      return;
    }
    const near = neighbours.get(id) ?? new Set<string>();
    for (const node of nodes) {
      const nid = node.dataset.spec ?? "";
      const isNear = nid === id || near.has(nid);
      node.classList.toggle("is-near", isNear);
      node.classList.toggle("is-far", !isNear);
    }
    for (const edge of edges) {
      const isNear = edge.dataset.from === id || edge.dataset.to === id;
      edge.classList.toggle("is-near", isNear);
      edge.classList.toggle("is-far", !isNear);
    }
  }
  for (const node of nodes) {
    const id = node.dataset.spec ?? null;
    node.addEventListener("mouseenter", () => highlight(id));
    node.addEventListener("mouseleave", () => highlight(null));
    node.addEventListener("focus", () => highlight(id));
    node.addEventListener("blur", () => highlight(null));
  }

  // M2: name the followed link for the view transition. A map node is SVG, which a view
  // transition cannot capture, so an empty box over it carries the name instead.
  let followed: Element | null = null;
  const links = [...nodes, ...document.querySelectorAll("#spec-list a[href^='/standards/']")];
  for (const link of links) link.addEventListener("click", () => (followed = link));
  let ghost: HTMLElement | null = null;
  type Swap = Event & { viewTransition?: unknown; activation?: { entry?: { url?: string } } };
  window.addEventListener("pageswap", (event) => {
    const { viewTransition, activation } = event as Swap;
    const to = activation?.entry?.url;
    const href = followed?.getAttribute("href");
    if (!viewTransition || !to || !href || new URL(to).pathname !== href) return;
    let named = followed as HTMLElement | SVGElement;
    if (followed instanceof SVGElement) {
      const box = followed.getBoundingClientRect();
      ghost ??= document.body.appendChild(document.createElement("div"));
      Object.assign(ghost.style, {
        position: "fixed",
        left: `${box.left}px`,
        top: `${box.top}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
        pointerEvents: "none",
      });
      named = ghost;
    }
    named.style.viewTransitionName = "spec-title";
  });
  // coming back from the history cache: the old name must not linger
  window.addEventListener("pageshow", () => {
    for (const el of [ghost, followed])
      (el as HTMLElement | null)?.style.removeProperty("view-transition-name");
    followed = null;
  });

  frame?.setAttribute("data-enhanced", "");
  apply(false);
});
</script>
