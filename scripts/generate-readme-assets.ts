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
  "bg",
  "bg-elevated",
  "bg-sunken",
  "ink",
  "ink-muted",
  "ink-faint",
  "line",
  "line-strong",
  "accent",
  "accent-strong",
  "accent-2",
  "status-supported",
  "status-partial",
  "status-unsupported",
  "status-unknown",
  "status-unknown-soft",
] as const;
type Token = (typeof TOKENS)[number];
type Palette = Record<Token, string> & { glow: string; shadow: string };

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
      const values = Object.fromEntries(raw.map(([n, px]) => [n, toHex(px)]));
      out[scheme] = {
        ...(values as Record<Token, string>),
        glow: scheme === "light" ? "rgba(70,170,160,0.28)" : "rgba(90,200,180,0.16)",
        shadow: scheme === "light" ? "rgba(30,30,50,0.12)" : "rgba(0,0,0,0.5)",
      };
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
    return cell?.observation ? "u" : ".";
  }),
);
const counts = {
  servers: matrix.rows.length,
  features: matrix.columns.length,
  observations: data.observations.length,
  specs: specNodes(data).length,
  relations: mapRelations(data).length,
};

const DISPLAY = `Geist, Inter, 'SF Pro Text', 'Segoe UI', Helvetica, Arial, sans-serif`;
const BODY = `Geist, Inter, 'SF Pro Text', 'Segoe UI', Helvetica, Arial, sans-serif`;
const MONO = `'Geist Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace`;

const dots = (id: string, t: Palette) =>
  `<pattern id="${id}" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1.2" cy="1.2" r="1.2" fill="${t.line}"/></pattern>`;

function hero(t: Palette, mark: string): string {
  const W = 1200;
  const H = 420;
  const CELL = 8.5;
  const GAP = 2.5;
  const STEP = CELL + GAP;
  const cols = matrix.rows.length;
  const gridW = cols * STEP - GAP;
  const winX = 690;
  const winY = 54;
  const winW = 462;
  const winH = 334;
  const gx = winX + (winW - gridW) / 2;
  const gy = winY + 44;
  let cells = "";
  rows.forEach((r, y) => {
    r.forEach((ch, x) => {
      if (ch === "-") return;
      const fill =
        ch === "S"
          ? t["status-supported"]
          : ch === "P"
            ? t["status-partial"]
            : ch === "U"
              ? t["status-unsupported"]
              : ch === "u"
                ? "none"
                : t["status-unknown-soft"];
      const stroke =
        ch === "u"
          ? ` stroke="${t["status-unknown"]}" stroke-width="1" stroke-dasharray="2 1.6"`
          : "";
      cells += `<rect x="${(gx + x * STEP).toFixed(1)}" y="${(gy + y * STEP).toFixed(1)}" width="${CELL}" height="${CELL}" rx="2" fill="${fill}"${stroke}/>`;
    });
  });
  const caption = `${counts.servers} servers × ${counts.features} requirements`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d">
  <title id="t">letsauth: authentication for agents, measured instead of asserted</title>
  <desc id="d">The letsauth wordmark beside a thumbnail of the MCP auth atlas: ${counts.servers} public MCP servers across, ${counts.features} requirements of the MCP Authorization specification down, each observed cell coloured by status.</desc>
  <defs>
    <linearGradient id="accentText" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.accent}"/><stop offset="1" stop-color="${t["accent-strong"]}"/></linearGradient>
    ${dots("dots", t)}
    <radialGradient id="glow" cx="0.5" cy="0" r="0.8"><stop offset="0" stop-color="${t.glow}"/><stop offset="1" stop-color="${t.glow}" stop-opacity="0"/></radialGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="${t.shadow}"/></filter>
    <clipPath id="win"><rect x="${winX}" y="${winY}" width="${winW}" height="${winH}" rx="18"/></clipPath>
  </defs>
  <rect width="${W}" height="${H}" rx="24" fill="${t.bg}"/>
  <rect width="${W}" height="${H}" rx="24" fill="url(#dots)"/>
  <rect x="560" y="-120" width="640" height="360" fill="url(#glow)"/>

  <g transform="translate(56 50) scale(0.6875)">${mark}</g>

  <g font-family="${MONO}" font-size="11.5" letter-spacing="2.2" fill="${t.accent}">
    <line x1="56" y1="140" x2="76" y2="140" stroke="${t.accent}" stroke-width="1.2"/>
    <text x="86" y="144">AN INDEPENDENT LAB FOR AGENT AUTH</text>
  </g>
  <g font-family="${DISPLAY}" font-weight="700" font-size="46" letter-spacing="-1.6" fill="${t.ink}">
    <text x="54" y="196">Authentication for agents,</text>
    <text x="54" y="246"><tspan fill="url(#accentText)">measured</tspan> instead of asserted.</text>
  </g>
  <g font-family="${BODY}" font-size="16" fill="${t["ink-muted"]}">
    <text x="56" y="292">One open dataset of what the agent protocols require</text>
    <text x="56" y="316">and what real servers do. Every claim cites a revision,</text>
    <text x="56" y="340">every status cites an observation. The data is yours.</text>
  </g>
  <g font-family="${MONO}" font-size="11.5" fill="${t["ink-muted"]}">
    <circle cx="61" cy="370" r="3" fill="${t.accent}"/><text x="72" y="374">Data CC BY 4.0</text>
    <circle cx="196" cy="370" r="3" fill="${t.accent}"/><text x="207" y="374">Code MIT</text>
    <circle cx="289" cy="370" r="3" fill="${t.accent}"/><text x="300" y="374">Hosted in the EU</text>
    <circle cx="432" cy="370" r="3" fill="${t.accent}"/><text x="443" y="374">No server contacted at build</text>
  </g>

  <g filter="url(#shadow)">
    <rect x="${winX}" y="${winY}" width="${winW}" height="${winH}" rx="18" fill="${t["bg-elevated"]}" stroke="${t.line}"/>
  </g>
  <g clip-path="url(#win)">
    <rect x="${winX}" y="${winY}" width="${winW}" height="34" fill="${t["bg-sunken"]}"/>
    <line x1="${winX}" y1="${winY + 34.5}" x2="${winX + winW}" y2="${winY + 34.5}" stroke="${t.line}"/>
  </g>
  <g fill="${t["line-strong"]}"><circle cx="${winX + 18}" cy="${winY + 17}" r="4"/><circle cx="${winX + 32}" cy="${winY + 17}" r="4"/><circle cx="${winX + 46}" cy="${winY + 17}" r="4"/></g>
  <text x="${winX + 64}" y="${winY + 21}" font-family="${MONO}" font-size="11" fill="${t["ink-muted"]}">atlas/mcp · ${revision.id} · ${caption}</text>
  ${cells}
  <g font-family="${MONO}" font-size="10.5" fill="${t["ink-muted"]}">
    <g transform="translate(${winX + 22} ${winY + winH - 24})">
      <rect width="9" height="9" rx="2" fill="${t["status-supported"]}"/><text x="14" y="9">supported</text>
      <rect x="96" width="9" height="9" rx="2" fill="${t["status-partial"]}"/><text x="110" y="9">partial</text>
      <rect x="174" width="9" height="9" rx="2" fill="${t["status-unsupported"]}"/><text x="188" y="9">unsupported</text>
      <rect x="282" width="9" height="9" rx="2" fill="none" stroke="${t["status-unknown"]}" stroke-dasharray="2 1.6"/><text x="296" y="9">unknown</text>
    </g>
  </g>
</svg>
`;
}

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
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${t["bg-elevated"]}" stroke="${accent ? t.accent : t.line}" stroke-width="${accent ? 1.5 : 1}"/>
    <text x="${x + 18}" y="${y + 30}" font-family="${DISPLAY}" font-weight="700" font-size="17" letter-spacing="-0.3" fill="${t.ink}">${title}</text>
    ${lines.map((l, i) => `<text x="${x + 18}" y="${y + 56 + i * 20}" font-family="${BODY}" font-size="13.5" fill="${t["ink-muted"]}">${l}</text>`).join("")}`;
  const arrow = (x1: number, y1: number, x2: number, y2: number) =>
    `<path d="M${x1} ${y1} C ${x1 + 40} ${y1}, ${x2 - 40} ${y2}, ${x2} ${y2}" fill="none" stroke="${t["line-strong"]}" stroke-width="1.6" marker-end="url(#arr)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t2 d2">
  <title id="t2">How the lab works</title>
  <desc id="d2">Specifications and dated observations from vendor documentation and the passive scanner flow as pull requests into one YAML dataset, which the static build renders as the atlases, the scanner reports and the JSON exports.</desc>
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${t["line-strong"]}"/></marker>
    ${dots("dots2", t)}
  </defs>
  <rect width="${W}" height="${H}" rx="24" fill="${t.bg}"/>
  <rect width="${W}" height="${H}" rx="24" fill="url(#dots2)"/>

  <g font-family="${MONO}" font-size="11" letter-spacing="2" fill="${t.accent}">
    <text x="48" y="44">SOURCES</text>
    <text x="492" y="44">ONE MODEL</text>
    <text x="846" y="44">MANY VIEWS</text>
  </g>

  ${box(48, 60, 370, 92, "Specifications", ["MCP Authorization, OAuth, OIDC, WIMSE, A2A, EU acts.", "Every feature cites a revision and a section."])}
  ${box(48, 168, 370, 92, "Observations", ["Vendor docs read by hand, public metadata read by", "the nightly scanner. Dated, with evidence, append-only."])}

  ${box(492, 86, 290, 128, "data/ · YAML", ["Validated by a Zod schema at build.", "Changed only through reviewed", "pull requests. CC BY 4.0."], true)}

  ${box(846, 50, 306, 64, "MCP auth atlas", ["Servers against requirements."])}
  ${box(846, 126, 306, 64, "Agent auth atlas", ["The standards map as one graph."])}
  ${box(846, 202, 306, 64, "Scanner reports · JSON exports", ["Per server, and the whole dataset."])}

  ${arrow(418, 106, 492, 150)}
  ${arrow(418, 214, 492, 150)}
  ${arrow(782, 150, 846, 82)}
  ${arrow(782, 150, 846, 158)}
  ${arrow(782, 150, 846, 234)}

  <text x="637" y="246" text-anchor="middle" font-family="${MONO}" font-size="10.5" fill="${t["ink-faint"]}">static build · no server contacted</text>
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
