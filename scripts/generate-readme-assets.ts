import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { cellKey, currentRevision, matrixFor } from "../src/lib/atlas";
import { getDataset } from "../src/lib/data";
import { mapRelations, specNodes } from "../src/lib/standards";

// Run with `pnpm generate:readme` after changing the brand, the tokens or the data. Writes the
// README pictures under docs/assets/readme, one light and one dark SVG each. GitHub renders a
// README image without the site's CSS, so every token is resolved to a plain colour here, by the
// browser, for each colour scheme; the mark and the lettering are the outlined paths from
// public/brand. No network request is made.

const TOKENS = [
  "ground",
  "ground-2",
  "ink",
  "ink-2",
  "rule",
  "rule-strong",
  "signal",
  "status-supported",
  "status-partial",
  "status-unsupported",
  "status-unknown",
] as const;
type Token = (typeof TOKENS)[number];
type Palette = Record<Token, string>;

const tokens = readFileSync("src/styles/tokens.css", "utf8");
const wordmark = readFileSync("public/brand/wordmark.svg", "utf8");
const wordmarkDark = readFileSync("public/brand/wordmark-dark.svg", "utf8");

/** The paths of a brand SVG with their fills, as they are in the file. */
function paths(svg: string): string {
  const body = svg.replace(/^.*?<title>.*?<\/title>/s, "").replace(/<\/svg>\s*$/, "");
  return body;
}

/** One canvas pixel (r, g, b, a in 0..255) to a plain colour. */
function toHex(px: number[]): string {
  const [r = 0, g = 0, b = 0, a = 255] = px;
  if (a < 255) return `rgba(${r},${g},${b},${(a / 255).toFixed(2)})`;
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

async function resolvePalettes(): Promise<Record<"light" | "dark", Palette>> {
  const browser = await chromium.launch();
  try {
    const out = {} as Record<"light" | "dark", Palette>;
    for (const scheme of ["light", "dark"] as const) {
      const page = await browser.newPage({ colorScheme: scheme });
      await page.setContent(
        `<style>${tokens}</style>${TOKENS.map((t) => `<i id="${t}" style="color:var(--${t})"></i>`).join("")}`,
      );
      // Chromium reports an oklch colour unconverted, so each token is painted on a canvas and
      // the pixel read back. tsx injects a `__name` helper into named functions, which the page
      // cannot see, so the page side stays a bare expression.
      const raw = await page.evaluate(
        (names: readonly string[]) =>
          names.map((n) => {
            const ctx = document
              .createElement("canvas")
              .getContext("2d") as CanvasRenderingContext2D;
            ctx.fillStyle = getComputedStyle(document.getElementById(n) as Element).color;
            ctx.fillRect(0, 0, 1, 1);
            return [n, Array.from(ctx.getImageData(0, 0, 1, 1).data)] as const;
          }),
        TOKENS,
      );
      out[scheme] = Object.fromEntries(raw.map(([n, px]) => [n, toHex(px)])) as Palette;
      await page.close();
    }
    return out;
  } finally {
    await browser.close();
  }
}

const data = getDataset();
const revision = currentRevision(data);
const matrix = matrixFor(data, revision.id);
const rows = matrix.columns.map((f) =>
  matrix.rows.map((s) => {
    const cell = matrix.cells.get(cellKey(s.id, f.id));
    const status = cell?.status ?? "unknown";
    if (status === "supported") return "S";
    if (status === "partial") return "P";
    if (status === "unsupported") return "U";
    if (status === "not-applicable") return "-";
    return (cell?.derived ?? true) ? "." : "u";
  }),
);
const counts = {
  servers: matrix.rows.length,
  features: matrix.columns.length,
  observations: data.observations.length,
  specs: specNodes(data).length,
  relations: mapRelations(data).length,
};
const HEADLINE = "Agent authorization, on the record";

const SANS = `Geist, Inter, 'SF Pro Text', 'Segoe UI', Helvetica, Arial, sans-serif`;
const MONO = `'Geist Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace`;

/*
 * The home hero as a picture, on the site's surfaces: a flat ground, the wordmark, eyebrow,
 * headline and lede at the left, and the matrix on a plate at the right with the marks of
 * MatrixThumb (an observed status filled, a recorded unknown a dashed ring, a derived unknown
 * a faint dot, not applicable a dash). No glow, shadow or texture.
 */
function hero(t: Palette, mark: string): string {
  const W = 1200;
  const H = 420;
  const CELL = 8.5;
  const GAP = 2.5;
  const STEP = CELL + GAP;
  const cols = matrix.rows.length;
  const gridW = cols * STEP - GAP;
  const gridH = rows.length * STEP - GAP;
  const plateW = 476;
  const plateX = W - 48 - plateW;
  const headH = 40;
  const footH = 40;
  const plateH = headH + 16 + gridH + 16 + footH;
  const plateY = (H - plateH) / 2;
  const gx = plateX + (plateW - gridW) / 2;
  const gy = plateY + headH + 16;
  let cells = "";
  rows.forEach((r, y) => {
    r.forEach((ch, x) => {
      const cx = gx + x * STEP;
      const cy = gy + y * STEP;
      const at = (dx: number, dy: number) =>
        `x="${(cx + dx).toFixed(1)}" y="${(cy + dy).toFixed(1)}"`;
      if (ch === ".") {
        cells += `<circle cx="${(cx + CELL / 2).toFixed(1)}" cy="${(cy + CELL / 2).toFixed(1)}" r="1.2" fill="${t["status-unknown"]}" fill-opacity="0.45"/>`;
      } else if (ch === "u") {
        cells += `<rect ${at(0.75, 0.75)} width="${CELL - 1.5}" height="${CELL - 1.5}" rx="2" fill="none" stroke="${t["status-unknown"]}" stroke-width="1" stroke-dasharray="2 1.6"/>`;
      } else if (ch === "-") {
        cells += `<rect ${at(2, CELL / 2 - 0.75)} width="${CELL - 4}" height="1.5" fill="${t["rule-strong"]}"/>`;
      } else {
        const fill =
          ch === "S"
            ? t["status-supported"]
            : ch === "P"
              ? t["status-partial"]
              : t["status-unsupported"];
        cells += `<rect ${at(0, 0)} width="${CELL}" height="${CELL}" rx="2" fill="${fill}"/>`;
      }
    });
  });
  const footY = plateY + plateH - footH;
  const legend = (
    [
      ["supported", `<rect width="9" height="9" rx="2" fill="${t["status-supported"]}"/>`],
      ["partial", `<rect width="9" height="9" rx="2" fill="${t["status-partial"]}"/>`],
      ["unsupported", `<rect width="9" height="9" rx="2" fill="${t["status-unsupported"]}"/>`],
      [
        "unknown",
        `<rect x="0.5" y="0.5" width="8" height="8" rx="2" fill="none" stroke="${t["status-unknown"]}" stroke-dasharray="2 1.6"/>`,
      ],
      [
        "no observation",
        `<circle cx="4.5" cy="4.5" r="1.4" fill="${t["status-unknown"]}" fill-opacity="0.45"/>`,
      ],
    ] as const
  ).reduce(
    (acc, [label, glyph]) => {
      acc.out += `<g transform="translate(${acc.x} 0)">${glyph}<text x="14" y="9">${label}</text></g>`;
      acc.x += 22 + label.length * 6.4;
      return acc;
    },
    { x: 0, out: "" },
  ).out;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d">
  <title id="t">letsauth: ${HEADLINE.toLowerCase()}</title>
  <desc id="d">The letsauth wordmark and the headline beside a thumbnail of the MCP server matrix: ${counts.servers} public MCP servers across, ${counts.features} requirements of the MCP Authorization specification down, each observed cell marked by status.</desc>
  <rect width="${W}" height="${H}" rx="14" fill="${t.ground}" stroke="${t.rule}"/>

  <g transform="translate(48 48) scale(0.55)">${mark}</g>

  <text x="48" y="146" font-family="${SANS}" font-size="15" fill="${t["ink-2"]}">An independent lab for agent authorization</text>
  <g font-family="${SANS}" font-weight="600" font-size="46" letter-spacing="-1.4" fill="${t.ink}">
    <text x="46" y="200">Agent authorization,</text>
    <text x="46" y="250">on the record</text>
  </g>
  <g font-family="${SANS}" font-size="16" fill="${t["ink-2"]}">
    <text x="48" y="298">One open dataset of what the agent protocols require</text>
    <text x="48" y="322">and what public servers do. Each requirement cites a</text>
    <text x="48" y="346">specification revision, each status a dated observation.</text>
  </g>
  <text x="48" y="384" font-family="${MONO}" font-size="12" fill="${t["ink-2"]}">Data CC BY 4.0 · Code MIT · Hosted in the EU</text>

  <rect x="${plateX + 0.5}" y="${plateY + 0.5}" width="${plateW - 1}" height="${plateH - 1}" rx="14" fill="${t["ground-2"]}"/>
  <rect x="${plateX + 1}" y="${plateY + headH}" width="${plateW - 2}" height="${footY - plateY - headH}" fill="${t.ground}" stroke="${t.rule}"/>
  <rect x="${plateX + 0.5}" y="${plateY + 0.5}" width="${plateW - 1}" height="${plateH - 1}" rx="14" fill="none" stroke="${t.rule}"/>
  <text x="${plateX + 16}" y="${plateY + 25}" font-family="${SANS}" font-size="13" fill="${t.ink}">MCP servers <tspan dx="8" font-family="${MONO}" font-size="12" fill="${t["ink-2"]}">${revision.id} · ${counts.servers} × ${counts.features}</tspan></text>
  ${cells}
  <g font-family="${SANS}" font-size="11" fill="${t["ink-2"]}" transform="translate(${plateX + 16} ${footY + 15})">${legend}</g>
</svg>
`;
}

/* How the lab works: sources, the one model, the views, as hairline boxes on the ground. */
function flow(t: Palette): string {
  const W = 1200;
  const H = 300;
  const box = (
    x: number,
    y: number,
    w: number,
    h: number,
    title: string,
    lines: string[],
    accent = false,
  ) => `
    <rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="10" fill="${accent ? t["ground-2"] : t.ground}" stroke="${accent ? t.signal : t.rule}" stroke-width="${accent ? 1.5 : 1}"/>
    <text x="${x + 18}" y="${y + 30}" font-family="${SANS}" font-weight="600" font-size="17" letter-spacing="-0.3" fill="${t.ink}">${title}</text>
    ${lines.map((l, i) => `<text x="${x + 18}" y="${y + 56 + i * 20}" font-family="${SANS}" font-size="13" fill="${t["ink-2"]}">${l}</text>`).join("")}`;
  const arrow = (x1: number, y1: number, x2: number, y2: number) =>
    `<path d="M${x1} ${y1} C ${x1 + 40} ${y1}, ${x2 - 40} ${y2}, ${x2} ${y2}" fill="none" stroke="${t["rule-strong"]}" stroke-width="1.5" marker-end="url(#arr)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t2 d2">
  <title id="t2">How the lab works</title>
  <desc id="d2">Specifications and dated observations from vendor documentation and the passive scanner flow as pull requests into one YAML dataset, which the static build renders as the server matrix, the standards map, the scanner reports and the JSON exports.</desc>
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${t["rule-strong"]}"/></marker>
  </defs>
  <rect width="${W}" height="${H}" rx="14" fill="${t.ground}" stroke="${t.rule}"/>

  <g font-family="${SANS}" font-size="13" fill="${t["ink-2"]}">
    <text x="48" y="44">Sources</text>
    <text x="492" y="44">One model</text>
    <text x="846" y="44">Many views</text>
  </g>

  ${box(48, 60, 370, 92, "Specifications", ["MCP Authorization, OAuth, OIDC, WIMSE, A2A, EU acts.", "Every feature cites a revision and a section."])}
  ${box(48, 168, 370, 92, "Observations", ["Vendor docs read by hand, public metadata read by", "the nightly scanner. Dated, with evidence, append-only."])}

  ${box(492, 86, 290, 128, "data/ · YAML", ["Validated by a Zod schema at build.", "Changed only through reviewed", "pull requests. CC BY 4.0."], true)}

  ${box(846, 50, 306, 64, "MCP servers", ["Servers against requirements."])}
  ${box(846, 126, 306, 64, "Standards map", ["The specifications as one graph."])}
  ${box(846, 202, 306, 64, "Scanner reports · JSON exports", ["Per server, and the whole dataset."])}

  ${arrow(418, 106, 492, 150)}
  ${arrow(418, 214, 492, 150)}
  ${arrow(782, 150, 846, 82)}
  ${arrow(782, 150, 846, 158)}
  ${arrow(782, 150, 846, 234)}

  <text x="637" y="246" text-anchor="middle" font-family="${MONO}" font-size="10.5" fill="${t["ink-2"]}">static build · no server contacted</text>
</svg>
`;
}

const palettes = await resolvePalettes();
const marks = { light: paths(wordmark), dark: paths(wordmarkDark) };
for (const scheme of ["light", "dark"] as const) {
  writeFileSync(`docs/assets/readme/hero-${scheme}.svg`, hero(palettes[scheme], marks[scheme]));
  writeFileSync(`docs/assets/readme/how-it-works-${scheme}.svg`, flow(palettes[scheme]));
}
console.log(
  `wrote docs/assets/readme for ${revision.id}: ${counts.servers} servers, ${counts.features} features, ${counts.observations} observations, ${counts.specs} specs, ${counts.relations} relations`,
);
