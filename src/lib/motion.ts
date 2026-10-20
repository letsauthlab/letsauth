/**
 * True when the reader asked for reduced motion. Islands read it once and skip timers, smooth
 * scrolling and autoplay when it holds (specs/016-visual-redesign/plan.md section 3.5). Outside a
 * browser (the build, unit tests) there is no media query, and the answer is false.
 */
export const reducedMotion = (): boolean =>
  typeof globalThis.matchMedia === "function" &&
  globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
