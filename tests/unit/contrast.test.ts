import { describe, expect, it } from "vitest";
import { contrast, parseOklch, parseTokens, toHex } from "../../scripts/lib/contrast";

describe("contrast", () => {
  it("gives 21:1 for white on black", () => {
    expect(contrast(parseOklch("oklch(100% 0 0)"), parseOklch("oklch(0% 0 0)"))).toBeCloseTo(21, 1);
  });

  it("converts OKLCH to sRGB hex", () => {
    expect(toHex(parseOklch("oklch(100% 0 0)"))).toBe("#ffffff");
    expect(toHex(parseOklch("oklch(62.796% 0.25768 29.234)"))).toBe("#ff0000");
  });

  it("reads light-dark pairs from a stylesheet", () => {
    const tokens = parseTokens("--ink: light-dark(oklch(24% 0.01 255), oklch(0.91 0.005 255));");
    expect(tokens.get("--ink")?.light.l).toBeCloseTo(0.24);
    expect(tokens.get("--ink")?.dark.l).toBeCloseTo(0.91);
  });
});
