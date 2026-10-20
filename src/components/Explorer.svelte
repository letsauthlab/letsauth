<script lang="ts">
/**
 * Progressive enhancement over the server-rendered chain (research R6). The step list in the
 * DOM is the source of truth: this island adds a control bar into the chain's sticky head,
 * marks one step as current, scrolls to it and keeps the URL fragment in sync. Without JS the
 * page is complete.
 */
import { onMount } from "svelte";

onMount(() => {
  const list = document.getElementById("chain-steps");
  const slot = document.getElementById("chain-controls");
  if (!list || !slot) return;
  const entries = Array.from(list.querySelectorAll<HTMLElement>("li[data-step]"));
  if (entries.length === 0) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const bar = document.createElement("div");
  bar.className = "stepper";
  bar.dataset.enhanced = "";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", "Step through the chain");
  const prev = document.createElement("button");
  prev.type = "button";
  prev.className = "button small quiet";
  prev.textContent = "Previous";
  const next = document.createElement("button");
  next.type = "button";
  next.className = "button small primary";
  next.textContent = "Next step";
  const status = document.createElement("p");
  status.className = "stepper__status";
  status.setAttribute("aria-live", "polite");
  bar.append(status, prev, next);
  slot.append(bar);

  let current = -1;
  // later steps are dimmed only once the reader starts stepping; the first paint shows all
  let stepping = false;

  function show(i: number, scroll: boolean, push = true) {
    current = Math.max(0, Math.min(entries.length - 1, i));
    entries.forEach((entry, j) => {
      if (j === current) entry.setAttribute("aria-current", "step");
      else entry.removeAttribute("aria-current");
      entry.classList.toggle("is-future", stepping && j > current);
    });
    const entry = entries[current];
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
  }
  :global(.stepper__status) {
    margin: 0 auto 0 0;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--ink-muted);
    max-width: none;
  }
  :global(#chain-steps .step__lanes) {
    cursor: pointer;
  }
</style>
