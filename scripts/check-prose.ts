import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

// Mechanical rules from the voice checklist (specs/016-visual-redesign/plan.md section 8, rule 4).
// A gate since WP9 rewrote the copy: any hit fails `pnpm check`.
const FAIL = true;

const root = process.cwd();
const fail = FAIL || process.argv.includes("--fail");

const WORDS = [
  "seamless",
  "robust",
  "leverage",
  "empower",
  "unlock",
  "delve",
  "journey",
  "landscape",
  "cutting-edge",
  "next level",
  "game-changing",
  "game-changer",
  "holistic",
  "in the era of",
  "in the age of",
  "measured instead of asserted",
  "yours to download",
  "refuses to be",
  "nothing is inferred from silence",
  "first-class",
];

interface Rule {
  name: string;
  pattern: RegExp;
  /** Skips a hit when this returns true for the line and the match position. */
  allow?: (line: string, index: number) => boolean;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** True when position `index` sits inside a quotation on the line, or the line is a blockquote. */
function quoted(line: string, index: number): boolean {
  if (/^\s*>/.test(line)) return true;
  const before = line.slice(0, index);
  const straight = (before.match(/"/g) ?? []).length % 2 === 1;
  const curly = before.lastIndexOf("“") > before.lastIndexOf("”");
  return straight || curly;
}

const RULES: Rule[] = [
  ...WORDS.map((word) => ({
    name: word,
    // Word stems count too: leverages, empowering, unlocked, journeys.
    pattern: new RegExp(`\\b${escapeRegExp(word).replace(/ /g, "\\s+")}\\w*`, "gi"),
  })),
  { name: "ecosystem", pattern: /\becosystems?\b/gi, allow: quoted },
  { name: "sentence starting with Whether", pattern: /(?:^|[.!?>]\s+|^\s*)Whether\b/g },
  { name: "em dash", pattern: /—|&mdash;/g },
];

/** Removes code that is not copy, keeping line numbers intact. */
function proseOnly(path: string, source: string): string {
  const blank = (match: string) => match.replace(/[^\n]/g, " ");
  if (path.endsWith(".md")) return source.replace(/^```[\s\S]*?^```/gm, blank);
  return source
    .replace(/<(style|script)\b[\s\S]*?<\/\1>/gi, blank)
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:"'`])\/\/.*$/gm, (match, lead: string) => lead + blank(match.slice(1)));
}

function filesUnder(dir: string, ext: string, recursive: boolean): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return recursive ? filesUnder(path, ext, true) : [];
    return entry.name.endsWith(ext) ? [path] : [];
  });
}

const files = [
  ...filesUnder(join(root, "src/pages"), ".astro", true),
  ...filesUnder(join(root, "src/components"), ".astro", true),
  join(root, "README.md"),
  ...filesUnder(join(root, "docs"), ".md", false),
].filter(existsSync);

const hits: string[] = [];
const perFile = new Map<string, number>();
for (const file of files) {
  const name = relative(root, file);
  const lines = proseOnly(file, readFileSync(file, "utf8")).split("\n");
  const found: string[] = [];
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      for (const match of line.matchAll(rule.pattern)) {
        if (rule.allow?.(line, match.index)) continue;
        found.push(`${name}:${i + 1}: ${rule.name}: ${line.trim().slice(0, 100)}`);
      }
    }
  });
  const claims = lines.filter((line) => /\bEvery claim\b/.test(line)).length;
  if (claims > 1) found.push(`${name}: "Every claim" used ${claims} times (once per page at most)`);
  if (found.length) {
    perFile.set(name, found.length);
    hits.push(...found);
  }
}

const log = fail ? console.error : console.log;
if (hits.length) {
  log(hits.join("\n"));
  log(`\nProse hits: ${hits.length} in ${perFile.size} of ${files.length} files`);
  for (const [name, count] of [...perFile].sort((a, b) => b[1] - a[1]))
    log(`  ${String(count).padStart(4)}  ${name}`);
  if (fail) process.exitCode = 1;
  else console.log("(warn only)");
} else console.log(`Prose OK: ${files.length} files`);
