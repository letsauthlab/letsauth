import { afterEach, describe, expect, it, vi } from "vitest";
import { reducedMotion } from "@/lib/motion";

describe("reducedMotion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is false outside a browser", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(reducedMotion()).toBe(false);
  });

  it("follows the prefers-reduced-motion query", () => {
    const queries: string[] = [];
    const stub = (matches: boolean) => (query: string) => {
      queries.push(query);
      return { matches } as MediaQueryList;
    };
    vi.stubGlobal("matchMedia", stub(true));
    expect(reducedMotion()).toBe(true);
    vi.stubGlobal("matchMedia", stub(false));
    expect(reducedMotion()).toBe(false);
    expect(queries).toEqual([
      "(prefers-reduced-motion: reduce)",
      "(prefers-reduced-motion: reduce)",
    ]);
  });
});
