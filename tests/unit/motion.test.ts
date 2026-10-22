import { afterEach, describe, expect, it, vi } from "vitest";
import { durationToken, parseDuration, reducedMotion } from "@/lib/motion";

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

describe("parseDuration", () => {
  it("reads the token units the stylesheet uses", () => {
    expect(parseDuration("220ms")).toBe(220);
    expect(parseDuration(" 2.5s ")).toBe(2500);
    expect(parseDuration("0ms", 300)).toBe(0);
  });

  it("falls back on anything it cannot read", () => {
    expect(parseDuration("", 300)).toBe(300);
    expect(parseDuration("var(--dur)", 120)).toBe(120);
  });
});

describe("durationToken", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is the fallback outside a browser", () => {
    vi.stubGlobal("getComputedStyle", undefined);
    expect(durationToken("--dur", 220)).toBe(220);
  });
});
