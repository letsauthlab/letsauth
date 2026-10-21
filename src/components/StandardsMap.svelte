<script lang="ts">
/**
 * Progressive enhancement over the server-rendered standards map. The drawing, the rail of
 * toggles and the outline in the DOM are the source of truth, and the toggles filter through
 * stylesheet rules on their own. This island only: keeps the count, mirrors the toggles in the
 * URL so a view can be shared, lets a lane label in the drawing toggle its body, shows the card
 * of the node under the pointer or in focus in the rail, highlights that node's neighbourhood,
 * and hands the followed node or outline entry to the cross-document view transition so it
 * grows into the spec page's title (plan 016, M2). Without JS the page is complete.
 */
import { onMount } from "svelte";

onMount(() => {
  const svg = document.getElementById("map");
  const frame = document.getElementById("map-frame");
  const form = document.getElementById("map-filters") as HTMLFormElement | null;
  const count = document.getElementById("map-count");
  const card = document.getElementById("map-card");
  if (!svg || !form) return;

  const typeBoxes = Array.from(form.querySelectorAll<HTMLInputElement>("input[name='type']"));
  const bodyBoxes = Array.from(form.querySelectorAll<HTMLInputElement>("input[name='body']"));
  const viewBoxes = Array.from(form.querySelectorAll<HTMLInputElement>("input[name='view']"));
  const nodes = Array.from(svg.querySelectorAll<SVGElement>("a[data-spec]"));
  const edges = Array.from(svg.querySelectorAll<SVGElement>("path[data-relation]"));
  const defaults = new Map(
    [...typeBoxes, ...bodyBoxes, ...viewBoxes].map((b) => [b, b.defaultChecked]),
  );

  const checked = (boxes: HTMLInputElement[]) =>
    new Set(boxes.filter((b) => b.checked).map((b) => b.value));

  function apply(pushUrl = true) {
    const types = checked(typeBoxes);
    const bodies = checked(bodyBoxes);
    let shownNodes = 0;
    let shownEdges = 0;
    for (const node of nodes) if (bodies.has(node.dataset.body ?? "")) shownNodes += 1;
    for (const edge of edges) {
      if (
        types.has(edge.dataset.type ?? "") &&
        bodies.has(edge.dataset.fromBody ?? "") &&
        bodies.has(edge.dataset.toBody ?? "")
      )
        shownEdges += 1;
    }
    if (count) {
      count.textContent = `${shownNodes} of ${nodes.length} specifications, ${shownEdges} of ${edges.length} relations`;
    }
    if (pushUrl) {
      const params = new URLSearchParams();
      const asDefault = (boxes: HTMLInputElement[]) =>
        boxes.every((b) => b.checked === defaults.get(b));
      if (!asDefault(typeBoxes)) for (const t of types) params.append("type", t);
      if (!asDefault(bodyBoxes)) for (const b of bodies) params.append("body", b);
      for (const v of checked(viewBoxes)) params.append("view", v);
      const qs = params.toString();
      history.replaceState(null, "", `${location.pathname}${qs ? `?${qs}` : ""}${location.hash}`);
    }
  }

  // restore a shared view from the URL: a listed name means "exactly these"
  const params = new URLSearchParams(location.search);
  const urlTypes = new Set(params.getAll("type"));
  const urlBodies = new Set(params.getAll("body"));
  if (urlTypes.size > 0) for (const b of typeBoxes) b.checked = urlTypes.has(b.value);
  if (urlBodies.size > 0) for (const b of bodyBoxes) b.checked = urlBodies.has(b.value);
  const urlViews = new Set(params.getAll("view"));
  for (const b of viewBoxes) b.checked = urlViews.has(b.value);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    apply();
  });
  form.addEventListener("change", () => apply());
  form.addEventListener("reset", () => {
    requestAnimationFrame(() => apply());
  });
  form.querySelector("[data-noscript-note]")?.remove();

  // a band label in the drawing is the same toggle as its body in the rail
  for (const label of svg.querySelectorAll<SVGElement>(".band-label[data-body]")) {
    label.addEventListener("click", () => {
      const box = bodyBoxes.find((b) => b.value === label.dataset.body);
      if (!box) return;
      box.checked = !box.checked;
      apply();
    });
  }

  // the reading pane: the node's card moves into the rail while it is hovered or focused
  const hint = card?.innerHTML ?? "";
  const cards = new Map(
    Array.from(document.querySelectorAll<HTMLElement>(".map-cards [data-card]")).map((c) => [
      c.dataset.card ?? "",
      c,
    ]),
  );
  function show(id: string | null) {
    if (!card) return;
    const next = id ? cards.get(id) : undefined;
    card.replaceChildren(...(next ? [next.cloneNode(true)] : []));
    if (!next) card.innerHTML = hint;
  }

  // neighbourhood highlight
  const neighbours = new Map<string, Set<string>>();
  for (const edge of edges) {
    const a = edge.dataset.from ?? "";
    const b = edge.dataset.to ?? "";
    (neighbours.get(a) ?? neighbours.set(a, new Set()).get(a))?.add(b);
    (neighbours.get(b) ?? neighbours.set(b, new Set()).get(b))?.add(a);
  }
  function highlight(id: string | null) {
    show(id);
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
