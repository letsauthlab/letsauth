// Colour maths for the contrast gate (specs/016-visual-redesign plan 3.2): OKLCH to sRGB, and
// the WCAG 2.2 contrast ratio. No dependency; the formulas are Björn Ottosson's OKLab matrices
// and the WCAG relative luminance definition.

export interface Oklch {
  /** Lightness, 0 to 1. */
  l: number;
  c: number;
  /** Hue in degrees. */
  h: number;
}

export interface ThemePair {
  light: Oklch;
  dark: Oklch;
}

/** Parses `oklch(46% 0.09 175)` (lightness as a percentage or a number). */
export function parseOklch(text: string): Oklch {
  const m = text.trim().match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  if (!m) throw new Error(`Not an opaque oklch() colour: ${text}`);
  const l = Number(m[1]) / (m[2] === "%" ? 100 : 1);
  return { l, c: Number(m[3]), h: Number(m[4]) };
}

/** Every `--name: light-dark(oklch(...), oklch(...));` declaration in a stylesheet. */
export function parseTokens(css: string): Map<string, ThemePair> {
  const tokens = new Map<string, ThemePair>();
  const re = /(--[a-z0-9-]+):\s*light-dark\(\s*(oklch\([^)]*\))\s*,\s*(oklch\([^)]*\))\s*\)/g;
  for (const m of css.matchAll(re)) {
    tokens.set(m[1] as string, {
      light: parseOklch(m[2] as string),
      dark: parseOklch(m[3] as string),
    });
  }
  return tokens;
}

/** Linear-light sRGB channels, clipped to the gamut. */
export function oklchToLinearSrgb({ l, c, h }: Oklch): [number, number, number] {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clip = (v: number) => Math.min(1, Math.max(0, v));
  return [
    clip(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    clip(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    clip(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ];
}

type Rgb = [number, number, number];

const encode = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const decode = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

/** Gamma-encoded sRGB channels, 0 to 1, as a browser paints them. */
export function toSrgb(colour: Oklch): Rgb {
  return oklchToLinearSrgb(colour).map(encode) as Rgb;
}

/** `#rrggbb` for a colour, for places that cannot take a token (meta tags, docs). */
export function toHex(colour: Oklch): string {
  return `#${toSrgb(colour)
    .map((v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/**
 * `color-mix(in oklch, fg <amount>, transparent)` painted over `bg`: the browser composites the
 * translucent colour in gamma-encoded sRGB.
 */
export function tint(fg: Oklch, amount: number, bg: Oklch): Rgb {
  const f = toSrgb(fg);
  return toSrgb(bg).map((v, i) => amount * (f[i] as number) + (1 - amount) * v) as Rgb;
}

/** WCAG relative luminance. */
export function luminance(colour: Oklch | Rgb): number {
  const [r, g, b] = (Array.isArray(colour) ? colour : toSrgb(colour)).map(decode) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: Oklch | Rgb, b: Oklch | Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
