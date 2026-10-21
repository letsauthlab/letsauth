import { readFileSync } from "node:fs";
import { contrast, parseTokens, tint, toHex } from "./lib/contrast";

// The contrast gate of specs/016-visual-redesign plan 3.2, computed from src/styles/tokens.css in
// both themes. Fails when a pair is under its minimum. `--markdown` prints the table that
// docs/design.md carries.

interface Pair {
  fg: string;
  bg: string;
  min: number;
  use: string;
  /** The background is `bg` under a tint of the foreground at this share, as on a tag. */
  tint?: number;
}

const TEXT = 4.5;
const GLYPH = 3;

const textInks = ["--ink", "--ink-2", "--signal", "--threat", "--boundary", "--ok", "--caution"];
const PAIRS: Pair[] = [
  ...["--ground", "--ground-2"].flatMap((bg) =>
    textInks.map((fg) => ({ fg, bg, min: TEXT, use: "text" })),
  ),
  { fg: "--ink", bg: "--ground-3", min: TEXT, use: "inline code" },
  { fg: "--ink", bg: "--code-bg", min: TEXT, use: "code blocks, token views" },
  { fg: "--ink-2", bg: "--code-bg", min: TEXT, use: "labels in token views" },
  { fg: "--on-signal", bg: "--signal", min: TEXT, use: "button text on a signal fill" },
  { fg: "--on-signal", bg: "--ok", min: GLYPH, use: "glyph on a supported chip" },
  { fg: "--on-signal", bg: "--caution", min: GLYPH, use: "glyph on a partial chip" },
  { fg: "--on-signal", bg: "--threat", min: GLYPH, use: "glyph on an unsupported chip" },
  // Requirement level tags draw an 8% tint of their own colour behind 13px text.
  ...["--threat", "--caution", "--boundary", "--ink-2"].map((fg) => ({
    fg,
    bg: "--ground-2",
    min: TEXT,
    use: "level tag, 8% tint of itself",
    tint: 0.08,
  })),
  { fg: "--rule-strong", bg: "--ground", min: GLYPH, use: "control outlines, not-applicable dash" },
  { fg: "--rule-strong", bg: "--ground-2", min: GLYPH, use: "control outlines on a panel" },
];

const tokens = parseTokens(readFileSync("src/styles/tokens.css", "utf8"));
const markdown = process.argv.includes("--markdown");
const fmt = (n: number) => n.toFixed(2);

let failures = 0;
const rows: string[] = [];
for (const pair of PAIRS) {
  const fg = tokens.get(pair.fg);
  const bg = tokens.get(pair.bg);
  if (!fg || !bg) {
    console.error(`Missing light-dark(oklch) token: ${fg ? pair.bg : pair.fg}`);
    failures++;
    continue;
  }
  const under = (theme: "light" | "dark") =>
    pair.tint ? tint(fg[theme], pair.tint, bg[theme]) : bg[theme];
  const light = contrast(fg.light, under("light"));
  const dark = contrast(fg.dark, under("dark"));
  const ok = light >= pair.min && dark >= pair.min;
  if (!ok) failures++;
  rows.push(
    markdown
      ? `| \`${pair.fg}\` | \`${pair.bg}\` | ${pair.use} | ${pair.min}:1 | ${fmt(light)} | ${fmt(dark)} |`
      : `${ok ? "ok  " : "FAIL"} ${pair.fg.padEnd(14)} on ${pair.bg.padEnd(11)} light ${fmt(light).padStart(5)}  dark ${fmt(dark).padStart(5)}  (min ${pair.min}, ${pair.use})`,
  );
}

if (markdown) {
  console.log("| Foreground | Background | Use | Minimum | Light | Dark |");
  console.log("| --- | --- | --- | --- | --- | --- |");
}
console.log(rows.join("\n"));
if (process.argv.includes("--hex")) {
  for (const [name, pair] of tokens) {
    console.log(`${name.padEnd(14)} ${toHex(pair.light)}  ${toHex(pair.dark)}`);
  }
}
if (failures) {
  console.error(`\n${failures} pair(s) under the minimum. Adjust lightness in tokens.css.`);
  process.exit(1);
}
