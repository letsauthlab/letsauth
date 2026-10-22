<script lang="ts">
/**
 * The explorer as a scene (research R6, review follow-up 8). The step list in the DOM stays the
 * source of truth and the page is complete without JS. This island adds the control bar into
 * the chain's sticky head and plays the chain as one scene:
 *
 * - One Web Animations API timeline, the scene clock, holds the playhead. Play and Pause run
 *   and stop it; Previous, Next, the scrub bar, a click on a step or a log line and the arrow
 *   keys seek it. The current step is always the step under the playhead (M6).
 * - Auto-advance starts once, when the chain scrolls into view, and stops for good on hover,
 *   touch, focus, scroll or any key. Never under reduced motion, never with a step in the URL.
 * - Per step: the sender and receiver light up in the actor head, the message draws in, earlier
 *   steps dim, the changed claims of its token get their rail one after another (M5, M7), and
 *   the decision log under the chain gains a line (M18).
 * - A toggle link swaps the chain in place through a same-document view transition (M17); the
 *   toggle stays its own static page, which is what a reload or a link without JS shows.
 *
 * Durations come from the motion tokens, which are 0ms under reduced motion.
 */
import { onMount } from "svelte";
import { SOFT_NAVIGATION } from "@/lib/analytics";
import { durationToken, reducedMotion } from "@/lib/motion";

/** M6: how long the chain must sit in view, untouched, before the scene starts by itself. */
const SETTLE_MS = 1000;

onMount(() => {
  const chain = document.getElementById("chain");
  const slot = document.getElementById("chain-controls");
  if (!chain || !slot) return;
  const reduced = reducedMotion();
  const root = document.documentElement;
  const ease = getComputedStyle(root).getPropertyValue("--ease").trim() || "ease-out";
  const t = {
    morph: durationToken("--dur", 220),
    message: durationToken("--dur-message", 300),
    rail: durationToken("--dur-slow", 480),
    stagger: durationToken("--stagger", 40),
    // M6: the pace of the scene
    step: durationToken("--dur-step", 2500) || 2500,
  };

  let list = document.getElementById("chain-steps");
  let entries: HTMLElement[] = [];
  const actors = new Map(
    Array.from(chain.querySelectorAll<HTMLElement>(".actor[data-actor]")).map((a) => [
      a.dataset.actor ?? "",
      a,
    ]),
  );
  const actorName = (id: string | undefined) =>
    actors
      .get(id ?? "")
      ?.querySelector(".actor__name")
      ?.textContent?.trim() ??
    id ??
    "";

  // the control bar: status, Previous, Play, Next, and the scrub bar under them
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
  const scrub = document.createElement("div");
  scrub.className = "scrub";
  const fill = document.createElement("span");
  fill.className = "scrub__fill";
  fill.setAttribute("aria-hidden", "true");
  const range = document.createElement("input");
  range.type = "range";
  range.className = "scrub__input";
  range.min = "1";
  range.step = "1";
  range.setAttribute("aria-label", "Position in the chain");
  scrub.append(fill, range);
  bar.append(status, prev, ...(play ? [play] : []), next, scrub);
  slot.append(bar);

  // the decision log: one quiet line per step reached, under the chain
  const log = document.createElement("section");
  log.className = "chain-log";
  log.hidden = true;
  log.setAttribute("aria-labelledby", "chain-log-title");
  log.innerHTML =
    '<h2 id="chain-log-title" class="chain-log__title">So far</h2><ol class="chain-log__list" role="list"></ol>';
  const logList = log.querySelector("ol") as HTMLOListElement;
  chain.after(log);

  let current = 0;
  // steps dim only once the scene runs or the reader steps; the first paint shows them all
  let stepping = false;
  let playing: "auto" | "play" | undefined;
  let frame = 0;
  let running: Animation[] = [];
  // the scene clock: an effect with no target, so it only keeps time
  let clock = new Animation(new KeyframeEffect(null, null, { duration: 1, fill: "forwards" }));
  const total = () => Math.max(0, entries.length - 1) * t.step;
  const at = () => Number(clock.currentTime ?? 0);
  const paint = () => fill.style.setProperty("--at", String(total() ? at() / total() : 0));

  function bind() {
    list = document.getElementById("chain-steps");
    entries = Array.from(list?.querySelectorAll<HTMLElement>("li[data-step]") ?? []);
    clock.cancel();
    clock = new Animation(
      new KeyframeEffect(null, null, { duration: Math.max(1, total()), fill: "forwards" }),
    );
    clock.pause();
    clock.currentTime = 0;
    range.max = String(Math.max(1, entries.length));
    logList.replaceChildren();
    log.hidden = true;
  }

  // follow the current step only when it is not already in view below the sticky head
  function reveal(entry: HTMLElement) {
    const head = chain?.querySelector(".chain__head")?.getBoundingClientRect().bottom ?? 0;
    const r = entry.getBoundingClientRect();
    if (r.top >= head - 1 && r.top + Math.min(r.height, 160) <= innerHeight) return;
    entry.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }

  function animateStep(entry: HTMLElement) {
    for (const a of running) a.cancel();
    running = [];
    if (reduced) return;
    const go = (el: Element | null, kf: Keyframe[], o: KeyframeAnimationOptions) => {
      if (el) running.push(el.animate(kf, { easing: ease, fill: "backwards", ...o }));
    };
    // M5: the message draws in from its sender, the body rises 8px
    const arrow = entry.querySelector(".arrow");
    go(entry.querySelector(".arrow__line"), [{ transform: "scaleX(0)" }, { transform: "none" }], {
      duration: t.message,
    });
    go(arrow, [{ opacity: 0 }, { opacity: 1 }], {
      duration: t.message,
      pseudoElement: "::after",
    });
    if (arrow?.classList.contains("arrow-self")) {
      go(arrow, [{ opacity: 0 }, { opacity: 1 }], { duration: t.message });
    }
    for (const child of entry.querySelectorAll(".step__body > *")) {
      go(
        child,
        [
          { opacity: 0, transform: "translateY(8px)" },
          { opacity: 1, transform: "none" },
        ],
        {
          duration: t.morph,
        },
      );
    }
    // M7: the changed claims light up after the message lands, one after another
    entry.querySelectorAll("[data-token] [data-changed]").forEach((claim, k) => {
      go(claim, [{ borderLeftColor: "var(--signal)" }, { borderLeftColor: "var(--rule)" }], {
        duration: t.rail,
        delay: t.message + k * t.stagger,
      });
    });
  }

  function logLine(entry: HTMLElement, j: number) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `#${entry.id}`;
    a.dataset.to = String(j);
    const num = document.createElement("span");
    num.className = "chain-log__num";
    num.textContent = entry.dataset.index ?? String(j + 1);
    const who = document.createElement("span");
    who.className = "chain-log__who";
    const from = entry.dataset.from;
    const to = entry.dataset.to;
    who.textContent = `${actorName(from)} → ${from === to ? "itself" : actorName(to)}`;
    const msg = document.createElement(entry.dataset.removed !== undefined ? "s" : "span");
    msg.className = "chain-log__msg";
    msg.textContent = entry.querySelector(".step__message")?.textContent?.trim() ?? "";
    a.append(num, who, msg);
    li.append(a);
    return li;
  }

  function show(i: number, opts: { scroll?: boolean; url?: boolean; animate?: boolean } = {}) {
    if (entries.length === 0) return;
    current = Math.max(0, Math.min(entries.length - 1, i));
    if (stepping) list?.setAttribute("data-stepping", "");
    const entry = entries[current] as HTMLElement;
    entries.forEach((e, j) => {
      if (j === current) e.setAttribute("aria-current", "step");
      else e.removeAttribute("aria-current");
      e.classList.toggle("is-past", stepping && j < current);
      e.classList.toggle("is-future", stepping && j > current);
    });
    for (const [id, a] of actors) {
      a.classList.toggle("is-from", stepping && id === entry.dataset.from);
      a.classList.toggle("is-to", stepping && id === entry.dataset.to);
    }
    const n = entry.dataset.index ?? String(current + 1);
    status.textContent = `Step ${n} of ${entries.length}`;
    range.value = String(current + 1);
    range.setAttribute("aria-valuetext", `Step ${n} of ${entries.length}`);
    prev.disabled = current === 0;
    next.disabled = current === entries.length - 1;
    if (!playing) paint();

    // M18: the log holds one line per step up to the current one
    log.hidden = !stepping;
    if (stepping) {
      while (logList.children.length > current + 1) logList.lastElementChild?.remove();
      for (let j = logList.children.length; j <= current; j++) {
        const li = logList.appendChild(logLine(entries[j] as HTMLElement, j));
        if (!reduced && j === current) {
          li.animate([{ opacity: 0 }, { opacity: 1 }], { duration: t.morph, easing: ease });
        }
      }
      for (const [j, li] of Array.from(logList.children).entries()) {
        if (j === current) li.setAttribute("aria-current", "step");
        else li.removeAttribute("aria-current");
      }
      if (opts.animate !== false) animateStep(entry);
    }
    if (opts.scroll) reveal(entry);
    if (opts.url) history.replaceState(history.state, "", `#${entry.id}`);
  }

  // the playhead moves; whichever step it is over is the current one
  function tick() {
    if (!playing) return;
    paint();
    const i = Math.min(entries.length - 1, Math.floor(at() / t.step + 1e-6));
    if (i !== current) show(i, { scroll: true, url: playing === "play" });
    if (clock.playState === "finished") stop();
    else frame = requestAnimationFrame(tick);
  }
  function start(mode: "auto" | "play") {
    disarm();
    if (!play || entries.length < 2) return;
    stepping = true;
    if (current >= entries.length - 1) current = 0;
    clock.currentTime = current * t.step;
    show(current, { scroll: mode === "play", url: mode === "play" });
    playing = mode;
    play.textContent = "Pause";
    play.setAttribute("aria-pressed", "true");
    clock.play();
    frame = requestAnimationFrame(tick);
  }
  function stop() {
    if (!playing || !play) return;
    playing = undefined;
    cancelAnimationFrame(frame);
    clock.pause();
    clock.currentTime = current * t.step;
    paint();
    play.textContent = "Play";
    play.setAttribute("aria-pressed", "false");
  }
  function seek(to: number) {
    disarm();
    stop();
    stepping = true;
    clock.currentTime = Math.max(0, Math.min(entries.length - 1, to)) * t.step;
    show(to, { scroll: true, url: true });
  }

  play?.addEventListener("click", () => (playing ? stop() : start("play")));
  prev.addEventListener("click", () => seek(current - 1));
  next.addEventListener("click", () => seek(current + 1));
  range.addEventListener("input", () => seek(Number(range.value) - 1));
  log.addEventListener("click", (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>("a[data-to]");
    if (!a) return;
    e.preventDefault();
    seek(Number(a.dataset.to));
  });
  chain.addEventListener("click", (e) => {
    const lanes = (e.target as Element).closest(".step__lanes");
    const entry = lanes?.closest<HTMLElement>("li[data-step]");
    if (entry) seek(entries.indexOf(entry));
  });

  /*
   * Auto-advance (M6): armed once. It starts when the chain has been in view for a moment with
   * no input, so a reader scrolling past is not interrupted. Once it runs, a hover, touch,
   * focus, scroll or key stops it for good; stepping, Play or a toggle disarm it before then.
   */
  let armed = !reduced && !!play;
  let inView = false;
  let settle: ReturnType<typeof setTimeout> | undefined;
  const nudge = () => {
    clearTimeout(settle);
    if (armed && inView) settle = setTimeout(() => armed && start("auto"), SETTLE_MS);
  };
  const observer = new IntersectionObserver(
    (seen) => {
      inView = seen.some((s) => s.isIntersecting);
      nudge();
    },
    { rootMargin: "0px 0px -35% 0px" },
  );
  function disarm() {
    armed = false;
    clearTimeout(settle);
    observer.disconnect();
  }
  const onPlay = (e: Event) => !!play && e.target instanceof Node && play.contains(e.target);
  // a click, key, wheel or touch stops the scene; pressing Play itself toggles it instead
  const interrupt = (e: Event) => {
    if (!playing) return nudge();
    const presses = !(e instanceof KeyboardEvent) || e.key === "Enter" || e.key === " ";
    if (onPlay(e) && presses) return;
    stop();
  };
  for (const type of ["pointerdown", "keydown", "wheel", "touchmove"]) {
    document.addEventListener(type, interrupt, { capture: true, passive: true });
  }
  // the auto-advance also stops on hover and focus; a reader who pressed Play is already there
  document.addEventListener(
    "focusin",
    (e) => {
      if (playing === "auto" && !onPlay(e)) stop();
      else nudge();
    },
    { capture: true },
  );
  for (const area of [chain, log]) {
    area.addEventListener("pointermove", (e) => {
      // a scroll moves the page under a resting mouse and reports no movement
      if (e.pointerType !== "mouse" || (e.movementX === 0 && e.movementY === 0)) return;
      if (playing === "auto") stop();
      else nudge();
    });
  }

  document.addEventListener("keydown", (e) => {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable)
    )
      return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      seek(current + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      seek(current - 1);
    }
  });

  // M17: a toggle swaps the chain in place, morphing the steps it shares with the current one
  let shown = location.pathname;
  const swappable = ["nav.crumbs", 'nav[aria-label="Toggles"]', "#chain-steps"];
  function named(on: boolean) {
    for (const e of entries) {
      e.style.viewTransitionName = on && e.dataset.step ? `step-${e.dataset.step}` : "";
    }
    const notice = document.querySelector<HTMLElement>("[data-toggle-notice]");
    if (notice) notice.style.viewTransitionName = on ? "toggle-notice" : "";
  }
  async function morph(url: string, push: boolean) {
    stop();
    disarm();
    let next: Document;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      next = new DOMParser().parseFromString(await res.text(), "text/html");
      if (!next.getElementById("chain-steps")) throw new Error("no chain");
    } catch {
      location.assign(url);
      return;
    }
    const swap = () => {
      for (const sel of swappable) {
        const from = document.querySelector(sel);
        const to = next.querySelector(sel);
        if (from && to) from.replaceWith(document.adoptNode(to));
      }
      document.querySelector("[data-toggle-notice]")?.remove();
      const notice = next.querySelector("[data-toggle-notice]");
      if (notice)
        document.querySelector('nav[aria-label="Toggles"]')?.after(document.adoptNode(notice));
      const nextChain = next.getElementById("chain");
      if (nextChain && chain) chain.className = nextChain.className;
      document.title = next.title;
      for (const sel of [
        'meta[name="description"]',
        'meta[property="og:title"]',
        'meta[property="og:description"]',
        'meta[property="og:url"]',
      ]) {
        const content = next.querySelector(sel)?.getAttribute("content");
        if (content) document.querySelector(sel)?.setAttribute("content", content);
      }
      const canonical = next.querySelector('link[rel="canonical"]')?.getAttribute("href");
      if (canonical)
        document.querySelector('link[rel="canonical"]')?.setAttribute("href", canonical);
      if (push) history.pushState({ explorer: true }, "", url);
      shown = location.pathname;
      stepping = false;
      bind();
      show(0, { animate: false });
      named(true);
    };
    const focused = document.activeElement?.closest('nav[aria-label="Toggles"]');
    named(true);
    root.classList.add("toggle-morph");
    const transition = document.startViewTransition(swap);
    await transition.finished.catch(() => {});
    root.classList.remove("toggle-morph");
    named(false);
    status.textContent = `${document.querySelector("nav[aria-label='Toggles'] [aria-current]")?.textContent?.trim() ?? "Baseline"}: ${entries.length} steps`;
    if (focused) {
      document
        .querySelector<HTMLElement>('nav[aria-label="Toggles"] [aria-current]')
        ?.focus({ preventScroll: true });
    }
    dispatchEvent(new Event(SOFT_NAVIGATION));
  }
  if (!reduced && "startViewTransition" in document) {
    document.addEventListener("click", (e) => {
      const a = (e.target as Element).closest<HTMLAnchorElement>('nav[aria-label="Toggles"] a');
      if (!a || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const url = new URL(a.href);
      if (url.origin !== location.origin) return;
      e.preventDefault();
      if (url.pathname !== shown) void morph(url.href, true);
    });
    addEventListener("popstate", () => {
      if (location.pathname !== shown) void morph(location.href, false);
    });
  }

  bind();
  const fromHash = entries.findIndex((e) => `#${e.id}` === location.hash);
  // a step in the URL is where the reader wants to be: no auto-advance
  if (fromHash >= 0) disarm();
  stepping = fromHash > 0;
  clock.currentTime = Math.max(0, fromHash) * t.step;
  show(Math.max(0, fromHash), { scroll: fromHash >= 0, animate: false });
  if (armed) observer.observe(list ?? chain);
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

  /*
   * The scrub bar: a hairline track, the playhead's progress in the signal (driven by the scene
   * clock through --at), and a native range on top so pointer and keyboard can seek.
   */
  :global(.scrub) {
    position: relative;
    flex: 1 0 100%;
    height: 1.25rem;
    display: grid;
    align-items: center;
  }
  :global(.scrub::before),
  :global(.scrub__fill) {
    content: "";
    grid-area: 1 / 1;
    height: 2px;
    border-radius: var(--radius-pill);
  }
  :global(.scrub::before) {
    background: var(--rule);
  }
  :global(.scrub__fill) {
    background: var(--signal);
    transform: scaleX(var(--at, 0));
    transform-origin: left center;
  }
  :global(.scrub__input) {
    grid-area: 1 / 1;
    width: 100%;
    margin: 0;
    background: transparent;
    appearance: none;
    cursor: pointer;
  }
  :global(.scrub__input:focus-visible) {
    outline: 2px solid var(--signal);
    outline-offset: 2px;
    border-radius: var(--radius-focus);
  }
  :global(.scrub__input::-webkit-slider-runnable-track) {
    height: 1.25rem;
    background: transparent;
  }
  :global(.scrub__input::-moz-range-track) {
    background: transparent;
  }
  :global(.scrub__input::-webkit-slider-thumb) {
    appearance: none;
    width: 0.75rem;
    height: 0.75rem;
    margin-top: 0.25rem;
    border: 2px solid var(--signal);
    border-radius: 50%;
    background: var(--ground-2);
  }
  :global(.scrub__input::-moz-range-thumb) {
    width: 0.75rem;
    height: 0.75rem;
    box-sizing: border-box;
    border: 2px solid var(--signal);
    border-radius: 50%;
    background: var(--ground-2);
  }
</style>
