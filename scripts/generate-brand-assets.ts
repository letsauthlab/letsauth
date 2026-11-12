import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { cellKey, currentRevision, matrixFor } from "../src/lib/atlas";
import { getDataset } from "../src/lib/data";
import { plate, plateSvg, SECTION_PLATES, sectionCard } from "../src/lib/plate";

// Run with `pnpm generate:brand` after changing public/brand, the tokens or the data. No network
// requests are made. The deploy workflow runs it before every build, so the published social card
// always shows the deployed data; the committed copy is only refreshed by hand.
const icon = readFileSync("public/brand/icon.svg", "utf8");
const iconDark = readFileSync("public/brand/icon-dark.svg", "utf8");
const wordmark = readFileSync("public/brand/wordmark.svg", "utf8");
const tokens = readFileSync("src/styles/tokens.css", "utf8");
const data = getDataset();
const revision = currentRevision(data);
const matrix = matrixFor(data, revision.id);
const svgUrl = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
const fontFile = (path: string) =>
  `data:font/woff2;base64,${readFileSync(path).toString("base64")}`;
const fontUrl = (family: string) =>
  `data:font/woff2;base64,${readFileSync(
    `node_modules/@fontsource-variable/${family}/files/${family}-latin-wght-normal.woff2`,
  ).toString("base64")}`;

// Browser tabs follow the OS theme, independently of the in-page theme override.
const colors = [...icon.matchAll(/fill="(#[a-f0-9]+)"/g)].map((m) => m[1]);
const darkColors = [...iconDark.matchAll(/fill="(#[a-f0-9]+)"/g)].map((m) => m[1]);
if (colors.length !== 2 || darkColors.length !== 2) {
  throw new Error("Expected two corresponding icon fills; update the favicon theme mapping.");
}
const themeStyle = `<style>@media(prefers-color-scheme:dark){${colors
  .map((color, i) => `[fill="${color}"]{fill:${darkColors[i]}}`)
  .join("")}}</style>`;
writeFileSync("public/favicon.svg", icon.replace(/(<svg[^>]*>)/, `$1${themeStyle}`));

const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
try {
  const page = await browser.newPage({ deviceScaleFactor: 1, colorScheme: "light" });
  // Opaque square with safe inset; iOS supplies its own rounded mask.
  await page.setViewportSize({ width: 180, height: 180 });
  await page.setContent(`<style>${tokens}
    body{margin:0;background:var(--ground);display:grid;place-items:center;width:180px;height:180px}
    img{width:144px;height:144px}
    </style><img src="${svgUrl(icon)}" alt="">`);
  await page.screenshot({ path: "public/apple-touch-icon.png" });

  // The social card is the home page's band at 1200 × 630: the wordmark, the headline and the two
  // figures of the hero over every cell of the current matrix, drawn as MatrixField draws it and
  // faded out under the text. Flat grounds, no frame, as on the site.
  const MARK = { supported: "s", partial: "p", unsupported: "x" } as const;
  const STEP = 10;
  const CELL = 8;
  const cells = matrix.rows
    .flatMap((server, x) =>
      matrix.columns.map((feature, y) => {
        const cell = matrix.cells.get(cellKey(server.id, feature.id));
        const status = cell?.status ?? "unknown";
        const at = (inset: number, size: number, cls: string) =>
          `<rect class="${cls}" x="${x * STEP + inset}" y="${y * STEP + inset}" width="${size}" height="${size}" rx="${size > 2 ? 1.5 : 0}"/>`;
        if (status === "unknown" && (cell?.derived ?? true)) return at(3, 2, "d");
        if (status === "unknown") return at(0.5, CELL - 1, "u");
        if (status === "not-applicable") return at(0, CELL, "n");
        return at(0, CELL, MARK[status]);
      }),
    )
    .join("");
  const field = `<svg class="field" viewBox="0 0 ${matrix.rows.length * STEP} ${
    matrix.columns.length * STEP
  }" preserveAspectRatio="xMaxYMid slice">${cells}</svg>`;
  const fmt = (n: number) => n.toLocaleString("en-GB");
  // the parts every card shares: the fonts, the ground, the wordmark top left, the address below
  const frame = `${tokens}
    @font-face{font-family:Serif;src:url('${fontFile("src/assets/fonts/newsreader-400-latin.woff2")}');font-weight:400}
    @font-face{font-family:Sans;src:url('${fontUrl("geist")}');font-weight:100 900}
    @font-face{font-family:Mono;src:url('${fontUrl("geist-mono")}');font-weight:100 900}
    *{box-sizing:border-box}
    body{margin:0;width:1200px;height:630px;position:relative;overflow:hidden;
      background:var(--ground);color:var(--ink);font-family:Sans}
    .logo{position:absolute;top:60px;left:72px;width:200px;height:auto}
    .text{position:absolute;left:72px;top:0;bottom:0;display:flex;flex-direction:column;
      justify-content:center}
    h1{margin:0;font:400 72px/1.04 Serif;letter-spacing:-0.02em}
    .site{position:absolute;bottom:56px;left:72px;margin:0;font:20px Mono;color:var(--ink-2)}`;
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(`<style>${frame}
    .field{position:absolute;inset:0;width:100%;height:100%;
      mask-image:linear-gradient(90deg,transparent 54%,rgb(0 0 0/.45) 66%,#000 84%)}
    .field rect{opacity:.55}
    .s{fill:var(--ok)}.p{fill:var(--caution)}.x{fill:var(--threat)}.n{fill:var(--rule-strong)}
    .d{fill:var(--ink-2)}.u{fill:none;stroke:var(--ink-2);stroke-width:.8;stroke-dasharray:1.5 1}
    h1{max-width:9.5em}
    dl{display:flex;gap:56px;margin:44px 0 0}
    dl div{display:grid;gap:6px}
    dt{font-size:20px;font-weight:500;color:var(--ink-2)}
    dd{margin:0;font:400 64px/1 Serif;letter-spacing:-0.02em;font-variant-numeric:tabular-nums}
    </style>
    ${field}
    <img class="logo" src="${svgUrl(wordmark)}" alt="letsauth">
    <div class="text">
      <h1>How MCP servers authorize AI agents</h1>
      <dl>
        <div><dt>Public MCP servers</dt><dd>${fmt(matrix.rows.length)}</dd></div>
        <div><dt>Spec requirements</dt><dd>${fmt(matrix.columns.length)}</dd></div>
      </dl>
    </div>
    <p class="site">letsauth.eu</p>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "public/og.png" });

  // The section roots that carry a decorative plate get a card of their own: the same frame as
  // the home card, with the page's drawing large at the right, as it sits in the page's band.
  for (const [id, section] of Object.entries(SECTION_PLATES)) {
    await page.setContent(`<style>${frame}
      svg{position:absolute;right:72px;top:165px;height:300px;width:auto;fill:none;
        stroke-linecap:round;stroke-linejoin:round}
      svg *{vector-effect:non-scaling-stroke}
      .pb{stroke:var(--boundary);stroke-dasharray:6 6;opacity:.7}
      .pl{stroke:var(--rule)}
      .pa{fill:var(--ground-2);stroke:var(--rule-strong)}
      .pm{stroke:var(--rule-strong)}
      .pp{stroke:var(--signal);stroke-width:3}
      .po{fill:var(--signal)}
      </style>
      ${plateSvg(plate(id, section.title))}
      <img class="logo" src="${svgUrl(wordmark)}" alt="letsauth">
      <div class="text"><h1>${section.title}</h1></div>
      <p class="site">letsauth.eu/${id}/</p>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `public${sectionCard(id as keyof typeof SECTION_PLATES)}` });
  }
} finally {
  await browser.close();
}
