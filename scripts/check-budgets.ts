import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";

// Byte budgets over the built site (specs/016-visual-redesign/plan.md section 7). Sizes are gzip
// level 6, the figure Bunny serves; woff2 fonts are already compressed and count as stored.
// Only limits with `enforce: true` fail the run. The others are reported, so a later package can
// tighten a budget by flipping its flag once the site meets it.

const KB = 1024;

interface Limit {
  /** Bytes allowed, compressed. */
  max: number;
  /** Larger limits for routes matching a pattern, first match wins. */
  exceptions?: { route: RegExp; max: number; why: string }[];
  enforce: boolean;
  label: string;
}

const LIMITS = {
  // Constitution V: no page ships more than 150 kB of compressed JavaScript.
  jsPerPage: { max: 150 * KB, enforce: true, label: "JavaScript per page" },
  // Section 7 targets, reported only until the redesign packages meet them.
  cssPerPage: { max: 20 * KB, enforce: false, label: "CSS per page" },
  jsWithoutIsland: { max: 300, enforce: false, label: "JavaScript on a page without an island" },
  jsPerIsland: { max: 8 * KB, enforce: false, label: "JavaScript per island" },
  htmlPerPage: {
    max: 60 * KB,
    exceptions: [{ route: /^\/mcp\/(revisions\/[^/]+\/)?$/, max: 120 * KB, why: "matrix" }],
    enforce: false,
    label: "HTML per page",
  },
  svgPerPage: {
    max: 8 * KB,
    exceptions: [
      { route: /^\/standards\/$/, max: 40 * KB, why: "map" },
      { route: /^\/explorer\/[^/]+\//, max: 40 * KB, why: "chain" },
    ],
    enforce: false,
    label: "Inline SVG per page",
  },
  fontsPreloaded: { max: 60 * KB, enforce: false, label: "Preloaded fonts" },
} satisfies Record<string, Limit>;

const dist = resolve(process.argv[2] ?? "dist");
if (!existsSync(join(dist, "index.html"))) {
  console.error(`No build at ${dist}. Run pnpm build first.`);
  process.exit(1);
}

const gz = (text: string | Buffer) => (text.length ? gzipSync(text, { level: 6 }).length : 0);
const fileCache = new Map<string, Buffer>();
function readAsset(path: string): Buffer | undefined {
  if (!fileCache.has(path)) {
    if (!existsSync(path)) return undefined;
    fileCache.set(path, readFileSync(path));
  }
  return fileCache.get(path);
}
const gzCache = new Map<string, number>();
function gzFile(path: string): number {
  let size = gzCache.get(path);
  if (size === undefined) {
    size = gz(readAsset(path) ?? "");
    gzCache.set(path, size);
  }
  return size;
}

/** Maps a site URL (absolute path) or a path relative to `from` onto a file in dist. */
function toFile(url: string, from: string): string | undefined {
  if (/^[a-z]+:|^\/\//i.test(url)) return undefined; // external, not part of the build
  const clean = url.split(/[?#]/)[0] ?? "";
  return clean.startsWith("/") ? join(dist, clean) : resolve(dirname(from), clean);
}

/** A JavaScript file and everything it imports statically (dynamic imports load on demand). */
function jsGraph(entry: string, seen = new Set<string>()): Set<string> {
  if (seen.has(entry)) return seen;
  const source = readAsset(entry);
  if (!source) return seen;
  seen.add(entry);
  for (const match of source.toString("utf8").matchAll(/\b(?:import|from)\s*["']([^"']+)["']/g)) {
    const target = toFile(match[1] ?? "", entry);
    if (target) jsGraph(target, seen);
  }
  return seen;
}

const attr = (tag: string, name: string) =>
  new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag)?.[1];

/** Outer HTML of every top-level inline <svg>, nested ones included in their parent. */
function inlineSvgs(html: string): string[] {
  const svgs: string[] = [];
  const tags = /<(\/?)svg\b[^>]*>/gi;
  let depth = 0;
  let start = 0;
  for (const match of html.matchAll(tags)) {
    if (match[1]) {
      depth = Math.max(0, depth - 1);
      if (depth === 0) svgs.push(html.slice(start, match.index + match[0].length));
    } else if (!match[0].endsWith("/>")) {
      if (depth === 0) start = match.index;
      depth++;
    }
  }
  return svgs;
}

interface Page {
  route: string;
  css: number;
  js: number;
  html: number;
  svg: number;
  fonts: number;
  islands: string[];
}

const islandFiles = new Map<string, { own: number; withRuntime: number; pages: number }>();

function measure(file: string): Page {
  const html = readFileSync(file, "utf8");
  const route = `/${relative(dist, file).split(sep).join("/")}`.replace(/(^|\/)index\.html$/, "$1");

  let css = 0;
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/\srel\s*=\s*["']?stylesheet/i.test(tag)) continue;
    const target = toFile(attr(tag, "href") ?? "", file);
    if (target) css += gzFile(target);
  }
  const inlineCss = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
  css += gz(inlineCss.join("\n"));

  const jsFiles = new Set<string>();
  const inlineJs: string[] = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = match[1] ?? "";
    const type = attr(attrs, "type");
    if (type && !/^(module|text\/javascript)$/i.test(type)) continue; // JSON-LD and the like
    const src = attr(attrs, "src");
    const target = src ? toFile(src, file) : undefined;
    if (target) jsGraph(target, jsFiles);
    else if (!src) inlineJs.push(match[2] ?? "");
  }
  const islands: string[] = [];
  for (const match of html.matchAll(/<astro-island\b[^>]*>/gi)) {
    const component = toFile(attr(match[0], "component-url") ?? "", file);
    const renderer = toFile(attr(match[0], "renderer-url") ?? "", file);
    if (!component) continue;
    const graph = jsGraph(component);
    if (renderer) jsGraph(renderer, graph);
    for (const f of graph) jsFiles.add(f);
    const name = relative(dist, component).split(sep).join("/");
    islands.push(name);
    const known = islandFiles.get(name);
    if (known) known.pages++;
    else {
      const total = [...graph].reduce((sum, f) => sum + gzFile(f), 0);
      islandFiles.set(name, { own: gzFile(component), withRuntime: total, pages: 1 });
    }
  }
  const js = [...jsFiles].reduce((sum, f) => sum + gzFile(f), 0) + gz(inlineJs.join("\n"));

  let fonts = 0;
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/\srel\s*=\s*["']?preload/i.test(tag) || attr(tag, "as") !== "font") continue;
    const target = toFile(attr(tag, "href") ?? "", file);
    fonts += (target && readAsset(target)?.length) || 0;
  }

  return {
    route,
    css,
    js,
    html: gz(html),
    svg: gz(inlineSvgs(html).join("\n")),
    fonts,
    islands: [...new Set(islands)],
  };
}

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "pagefind" ? [] : htmlFiles(path);
    return entry.name.endsWith(".html") ? [path] : [];
  });
}

const limitFor = (limit: Limit, route: string) =>
  limit.exceptions?.find((e) => e.route.test(route))?.max ?? limit.max;

// Astro's redirect stubs (a meta refresh and a link) are not pages a reader stays on.
const isRedirect = (file: string) =>
  /<meta\s+http-equiv=["']refresh["']/i.test(readFileSync(file, "utf8").slice(0, 400));
const files = htmlFiles(dist);
const redirects = files.filter(isRedirect).length;
const pages = files
  .filter((file) => !isRedirect(file))
  .map(measure)
  .sort((a, b) => a.route.localeCompare(b.route));

const kb = (bytes: number) => (bytes / KB).toFixed(1);
const routeWidth = Math.max(...pages.map((p) => p.route.length), 5);
const cols = ["CSS", "JS", "HTML", "SVG", "Fonts"];
console.log(
  `${"Page".padEnd(routeWidth)}  ${cols.map((c) => c.padStart(7)).join("")}  Islands  (kB, gzip -6)`,
);
for (const p of pages) {
  const values = [p.css, p.js, p.html, p.svg, p.fonts].map((v) => kb(v).padStart(7)).join("");
  console.log(`${p.route.padEnd(routeWidth)}  ${values}  ${p.islands.join(", ")}`);
}

console.log("\nIslands (component chunk / with shared Svelte runtime, kB gzip -6)");
for (const [name, size] of [...islandFiles].sort()) {
  console.log(
    `  ${name.padEnd(40)} ${kb(size.own).padStart(6)} / ${kb(size.withRuntime).padStart(6)}  on ${size.pages} page(s)`,
  );
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};
const maxOf = (key: "css" | "js" | "html" | "svg" | "fonts", list = pages) =>
  list.reduce((best, p) => (p[key] > best[key] ? p : best), list[0] as Page);
console.log(`\nSummary over ${pages.length} pages (${redirects} redirect stubs skipped)`);
for (const key of ["css", "js", "html", "svg", "fonts"] as const) {
  const top = maxOf(key);
  console.log(
    `  ${key.toUpperCase().padEnd(5)} max ${kb(top[key]).padStart(6)} kB (${top.route}), median ${kb(median(pages.map((p) => p[key])))} kB`,
  );
}
const plain = pages.filter((p) => p.islands.length === 0);
if (plain.length) console.log(`  JS on pages without an island: max ${maxOf("js", plain).js} B`);

// Budget evaluation: enforced failures fail the run, the rest are listed as targets.
const failures: string[] = [];
const targets: string[] = [];
function check(limit: Limit, subject: string, route: string, bytes: number) {
  const max = limitFor(limit, route);
  if (bytes <= max) return;
  const line = `${limit.label}: ${subject} is ${kb(bytes)} kB, limit ${kb(max)} kB`;
  (limit.enforce ? failures : targets).push(line);
}
for (const p of pages) {
  check(LIMITS.jsPerPage, p.route, p.route, p.js);
  check(LIMITS.cssPerPage, p.route, p.route, p.css);
  check(LIMITS.htmlPerPage, p.route, p.route, p.html);
  check(LIMITS.svgPerPage, p.route, p.route, p.svg);
  check(LIMITS.fontsPreloaded, p.route, p.route, p.fonts);
  if (p.islands.length === 0) check(LIMITS.jsWithoutIsland, p.route, p.route, p.js);
}
for (const [name, size] of islandFiles) check(LIMITS.jsPerIsland, name, name, size.own);

if (targets.length) {
  const counts = new Map<string, number>();
  for (const line of targets) {
    const label = line.split(":")[0] ?? line;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  console.log("\nOver a section 7 target (reported, not enforced yet):");
  for (const [label, count] of counts) console.log(`  ${label}: ${count}`);
}
if (failures.length) {
  console.error(`\nBudget check failed (${failures.length}):\n  ${failures.join("\n  ")}`);
  process.exitCode = 1;
} else console.log("\nEnforced budgets OK");
