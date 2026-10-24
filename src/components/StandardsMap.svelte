<script lang="ts">
/**
 * Progressive enhancement over the server-rendered standards map. The drawing, the rail of
 * toggles and the outline in the DOM are the source of truth, and the toggles filter through
 * stylesheet rules on their own. This island only: keeps the count, mirrors the toggles in the
 * URL so a view can be shared, lets a lane label in the drawing toggle its body, shows the card
 * of the node under the pointer or in focus beside it, highlights that node's neighbourhood,
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

  // the reading pane: the node's card floats beside the node while it is hovered or focused
  const figure = card?.parentElement;
  const cards = new Map(
    Array.from(document.querySelectorAll<HTMLElement>(".map-cards [data-card]")).map((c) => [
      c.dataset.card ?? "",
      c,
    ]),
  );
  let shown: string | null = null;
  function show(id: string | null) {
    if (!card || !figure) return;
    const node = id ? nodes.find((n) => n.dataset.spec === id) : undefined;
    const next = id ? cards.get(id) : undefined;
    if (!node || !next) {
      card.hidden = true;
      card.replaceChildren();
      return;
    }
    card.replaceChildren(next.cloneNode(true));
    card.hidden = false;
    // right of the node, or left of it where the frame ends; never below the frame
    const box = node.getBoundingClientRect();
    const fig = figure.getBoundingClientRect();
    const gap = 8;
    const right = box.right - fig.left + gap;
    const left =
      right + card.offsetWidth <= fig.width ? right : box.left - fig.left - gap - card.offsetWidth;
    const frameBottom = (frame?.getBoundingClientRect().bottom ?? fig.bottom) - fig.top;
    const top = Math.min(box.top - fig.top, frameBottom - card.offsetHeight);
    card.style.left = `${Math.max(0, left)}px`;
    card.style.top = `${Math.max(0, top)}px`;
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
    if (id === shown) return;
    shown = id;
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
  /*
   * The pointer crosses empty space between two nodes on its way from one to the next. Letting
   * go at once would flash the whole map back to full strength in every gap, so the highlight
   * stays through a short grace and only lifts when the pointer rests off the nodes or leaves.
   */
  const GRACE = 280;
  let release = 0;
  const hold = () => window.clearTimeout(release);
  const letGo = (delay: number) => {
    hold();
    release = window.setTimeout(() => highlight(null), delay);
  };
  const nodeAt = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<SVGElement>("a[data-spec]") : null;
  svg.addEventListener("pointerover", (event) => {
    if ((event as PointerEvent).pointerType === "touch") return;
    const node = nodeAt(event.target);
    if (!node) return;
    hold();
    highlight(node.dataset.spec ?? null);
  });
  svg.addEventListener("pointerout", (event) => {
    if ((event as PointerEvent).pointerType === "touch") return;
    if (nodeAt(event.target) && !nodeAt((event as PointerEvent).relatedTarget)) letGo(GRACE);
  });
  svg.addEventListener("pointerleave", () => letGo(0));
  for (const node of nodes) {
    const id = node.dataset.spec ?? null;
    node.addEventListener("focus", () => {
      hold();
      highlight(id);
    });
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
