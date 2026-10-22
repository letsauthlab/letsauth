/**
 * True when the reader asked for reduced motion. Islands read it once and skip timers, smooth
 * scrolling and autoplay when it holds (specs/016-visual-redesign/plan.md section 3.5). Outside a
 * browser (the build, unit tests) there is no media query, and the answer is false.
 */
export const reducedMotion = (): boolean =>
  typeof globalThis.matchMedia === "function" &&
  globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A duration token from `src/styles/tokens.css` in milliseconds, so islands animate with the
 * same values as the stylesheet (constitution V: islands bring no tokens of their own). Under
 * reduced motion the tokens are 0ms. An unset or unreadable token gives `fallback`.
 */
export function durationToken(
  name: string,
  fallback = 0,
  root: Element | undefined = globalThis.document?.documentElement,
): number {
  if (!root || typeof globalThis.getComputedStyle !== "function") return fallback;
  return parseDuration(globalThis.getComputedStyle(root).getPropertyValue(name), fallback);
}

/** "220ms" → 220, "2.5s" → 2500; anything else → `fallback`. */
export function parseDuration(value: string, fallback = 0): number {
  const m = /^\s*(-?[\d.]+)(ms|s)\s*$/.exec(value);
  if (!m) return fallback;
  const n = Number(m[1]) * (m[2] === "s" ? 1000 : 1);
  return Number.isFinite(n) ? n : fallback;
}
