import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { cellKey, currentRevision, matrixFor } from "../src/lib/atlas";
import { getDataset } from "../src/lib/data";
import { plate, plateSvg, SECTION_PLATES, sectionCard } from "../src/lib/plate";

// Run with `pnpm generate:brand` after changing public/brand, the tokens or the data. No network
// requests are made.
const icon = readFileSync("public/brand/icon.svg", "utf8");
const iconDark = readFileSync("public/brand/icon-dark.svg", "utf8");
const wordmark = readFileSync("public/brand/wordmark.svg", "utf8");
const tokens = readFileSync("src/styles/tokens.css", "utf8");
const data = getDataset();
const revision = currentRevision(data);
const matrix = matrixFor(data, revision.id);
const svgUrl = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
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

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1, colorScheme: "light" });
  // Opaque square with safe inset; iOS supplies its own rounded mask.
  await page.setViewportSize({ width: 180, height: 180 });
  await page.setContent(`<style>${tokens}
    body{margin:0;background:var(--ground);display:grid;place-items:center;width:180px;height:180px}
    img{width:144px;height:144px}
    </style><img src="${svgUrl(icon)}" alt="">`);
  await page.screenshot({ path: "public/apple-touch-icon.png" });

  // The social card is the home hero at 1200 × 630: wordmark, eyebrow, headline, and the current
  // matrix on a plate with the marks of MatrixThumb. Flat grounds and hairlines, as on the site.
  const MARK = { supported: "s", partial: "p", unsupported: "x" } as const;
  const marks = matrix.columns
    .flatMap((feature) =>
      matrix.rows.map((server) => {
        const cell = matrix.cells.get(cellKey(server.id, feature.id));
        const status = cell?.status ?? "unknown";
        if (status === "unknown" && (cell?.derived ?? true)) return `<i class="d"></i>`;
        if (status === "unknown") return `<i class="u"></i>`;
        if (status === "not-applicable") return `<i class="n"></i>`;
        return `<i class="${MARK[status]}"></i>`;
      }),
    )
    .join("");
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(`<style>${tokens}
    @font-face{font-family:Display;src:url('${fontUrl("geist")}');font-weight:100 900}
    @font-face{font-family:Mono;src:url('${fontUrl("geist-mono")}');font-weight:100 900}
    *{box-sizing:border-box}
    body{margin:0;width:1200px;height:630px;padding:56px 64px;background:var(--ground);
      color:var(--ink);font-family:Display;display:grid;grid-template-columns:1fr 460px;
      gap:48px;align-items:center}
    .logo{position:absolute;top:56px;left:64px;width:220px;height:auto}
    .eyebrow{margin:0 0 18px;font-size:22px;color:var(--ink-2)}
    h1{margin:0;font-weight:600;font-size:58px;line-height:1.08;letter-spacing:-0.03em;
      white-space:nowrap}
    .site{position:absolute;bottom:56px;left:64px;font:22px Mono;color:var(--ink-2)}
    .plate{background:var(--ground-2);border:1px solid var(--rule);border-radius:14px;
      overflow:hidden}
    .head,.foot{display:flex;gap:12px;align-items:baseline;padding:14px 18px;font-size:17px}
    .head{border-bottom:1px solid var(--rule)}
    .head span{font:15px Mono;color:var(--ink-2)}
    .grid{display:grid;grid-template-columns:repeat(${matrix.rows.length},1fr);gap:3px;
      padding:20px 18px;background:var(--ground)}
    .foot{border-top:1px solid var(--rule);color:var(--ink-2);font-size:15px}
    i{display:block;aspect-ratio:1;border-radius:3px}
    .s{background:var(--ok)}.p{background:var(--caution)}.x{background:var(--threat)}
    .u{border:1.5px dashed var(--ink-2)}
    .d{background:radial-gradient(circle,var(--ink-2) 22%,transparent 26%);opacity:.45}
    .n{background:linear-gradient(var(--rule-strong),var(--rule-strong)) center/50% 2px no-repeat}
    </style>
    <img class="logo" src="${svgUrl(wordmark)}" alt="letsauth">
    <div>
      <p class="eyebrow">An independent lab for agent authorization</p>
      <h1>Agent authorization,<br>on the record</h1>
    </div>
    <div class="plate">
      <div class="head">MCP servers <span>${revision.id}</span></div>
      <div class="grid">${marks}</div>
      <div class="foot">${matrix.rows.length} servers × ${matrix.columns.length} requirements</div>
    </div>
    <p class="site">letsauth.eu</p>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "public/og.png" });

  // The section roots that carry a decorative plate (WP8) get a card of their own: the same layout
  // as the home card, with the headline over the page's drawing on a plate.
  for (const [id, section] of Object.entries(SECTION_PLATES)) {
    const drawing = plate(id, section.title);
    await page.setContent(`<style>${tokens}
      @font-face{font-family:Display;src:url('${fontUrl("geist")}');font-weight:100 900}
      @font-face{font-family:Mono;src:url('${fontUrl("geist-mono")}');font-weight:100 900}
      *{box-sizing:border-box}
      body{margin:0;width:1200px;height:630px;padding:56px 64px;background:var(--ground);
        color:var(--ink);font-family:Display;display:flex;flex-direction:column;
        justify-content:center;gap:32px}
      .logo{position:absolute;top:56px;left:64px;width:220px;height:auto}
      .eyebrow{margin:0 0 12px;font-size:22px;color:var(--ink-2)}
      h1{margin:0;font-weight:600;font-size:52px;line-height:1.08;letter-spacing:-0.03em}
      .site{position:absolute;bottom:56px;left:64px;font:22px Mono;color:var(--ink-2)}
      .plate{--plate:var(--plate-${drawing.hue});width:880px;margin-top:40px;background:var(--ground-2);
        border:1px solid var(--rule);border-radius:14px;overflow:hidden}
      svg{display:block;width:100%;height:auto;fill:none;stroke-linecap:round}
      .pb{stroke:var(--rule-strong);stroke-dasharray:4 5}
      .pl{stroke:var(--rule-strong);opacity:.6}
      .ph{display:none}
      .pp{stroke:var(--plate);stroke-width:2.5}
      .pn{fill:var(--ground);stroke:var(--rule-strong)}
      .po{fill:var(--plate);stroke:var(--plate)}
      </style>
      <img class="logo" src="${svgUrl(wordmark)}" alt="letsauth">
      <div>
        <p class="eyebrow">${section.eyebrow}</p>
        <h1>${section.title}</h1>
      </div>
      <div class="plate">${plateSvg(drawing)}</div>
      <p class="site">letsauth.eu/${id}/</p>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `public${sectionCard(id as keyof typeof SECTION_PLATES)}` });
  }
} finally {
  await browser.close();
}
