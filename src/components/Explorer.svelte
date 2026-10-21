<script lang="ts">
/**
 * Progressive enhancement over the server-rendered chain (research R6). The step list in the
 * DOM is the source of truth: this island adds a control bar into the chain's sticky head,
 * marks one step as current, scrolls to it and keeps the URL fragment in sync. Without JS the
 * page is complete. Motion lives in ChainPage's CSS; the island only sets attributes and
 * classes, and the token diff (M7) is already in the markup as `data-changed`.
 */
import { onMount } from "svelte";
import { reducedMotion } from "@/lib/motion";

/** M6: the pace of Play. */
const PLAY_EVERY_MS = 2500;

onMount(() => {
  const list = document.getElementById("chain-steps");
  const slot = document.getElementById("chain-controls");
  if (!list || !slot) return;
  const entries = Array.from(list.querySelectorAll<HTMLElement>("li[data-step]"));
  if (entries.length === 0) return;
  const reduced = reducedMotion();

  const button = (label: string, kind: string) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `button small${kind}`;
    b.textContent = label;
    return b;
  };
  const bar = document.createElement("div");
  bar.className = "stepper explainer";
  bar.dataset.enhanced = "";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", "Step through the chain");
  const status = document.createElement("p");
  status.className = "stepper__status";
  status.setAttribute("aria-live", "polite");
  const prev = button("Previous", " quiet");
  const next = button("Next step", "");
  // M6: Play is never offered under reduced motion
  const play = reduced ? undefined : button("Play", " quiet");
  if (play) play.dataset.play = "";
  bar.append(status, prev, ...(play ? [play] : []), next);
  slot.append(bar);

  let current = -1;
  // later steps are dimmed only once the reader starts stepping; the first paint shows all
  let stepping = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  function show(i: number, scroll: boolean, push = true) {
    current = Math.max(0, Math.min(entries.length - 1, i));
    if (stepping) list?.setAttribute("data-stepping", "");
    entries.forEach((entry, j) => {
      if (j === current) entry.setAttribute("aria-current", "step");
      else entry.removeAttribute("aria-current");
      entry.classList.toggle("is-future", stepping && j > current);
      entry.classList.remove("is-fresh");
    });
    const entry = entries[current];
    if (stepping && entry) {
      // M7: restart the rail fade on the claims that changed at this hop
      void entry.offsetWidth;
      entry.classList.add("is-fresh");
    }
    const n = entry?.dataset.index ?? String(current + 1);
    status.textContent = `Step ${n} of ${entries.length}`;
    prev.disabled = current === 0;
    next.disabled = current === entries.length - 1;
    if (scroll && entry) {
      entry.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    }
    if (push && entry) history.replaceState(null, "", `#${entry.id}`);
  }
  const step = (to: number) => {
    stepping = true;
    show(to, true);
  };

  function pause() {
    if (timer === undefined || !play) return;
    clearInterval(timer);
    timer = undefined;
    play.textContent = "Play";
  }
  function start() {
    if (!play) return;
    if (current >= entries.length - 1) step(0);
    play.textContent = "Pause";
    timer = setInterval(() => {
      step(current + 1);
      if (current >= entries.length - 1) pause();
    }, PLAY_EVERY_MS);
  }
  play?.addEventListener("click", () => (timer === undefined ? start() : pause()));
  // any click, key or scroll by the reader pauses Play; pressing Play itself toggles it instead
  const interrupt = (e: Event) => {
    const onPlay = play && e.target instanceof Node && play.contains(e.target);
    const presses = !(e instanceof KeyboardEvent) || e.key === "Enter" || e.key === " ";
    if (onPlay && presses) return;
    pause();
  };
  for (const type of ["pointerdown", "keydown", "wheel", "touchmove"]) {
    document.addEventListener(type, interrupt, { capture: true, passive: true });
  }

  prev.addEventListener("click", () => step(current - 1));
  next.addEventListener("click", () => step(current + 1));
  document.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement | null;
    if (
      t &&
      (t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.tagName === "SELECT" ||
        t.isContentEditable)
    )
      return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      step(current + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      step(current - 1);
    }
  });
  for (const [j, entry] of entries.entries()) {
    entry.querySelector(".step__lanes")?.addEventListener("click", () => step(j));
  }

  const fromHash = entries.findIndex((e) => `#${e.id}` === location.hash);
  stepping = fromHash > 0;
  show(fromHash >= 0 ? fromHash : 0, fromHash >= 0, false);
});
</script>

<style>
  :global(.stepper) {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-2) var(--space-3);
  }
  :global(.stepper__status) {
    margin: 0 auto 0 0;
    font-size: var(--tiny);
    font-variant-numeric: tabular-nums;
    color: var(--ink-2);
    max-width: none;
  }
</style>
