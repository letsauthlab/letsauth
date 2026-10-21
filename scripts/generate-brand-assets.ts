import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

// Run with `pnpm generate:brand` after changing public/brand. No network requests are made.
const icon = readFileSync("public/brand/icon.svg", "utf8");
const iconDark = readFileSync("public/brand/icon-dark.svg", "utf8");
const wordmark = readFileSync("public/brand/wordmark.svg", "utf8");
const tokens = readFileSync("src/styles/tokens.css", "utf8");
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
    body{margin:0;background:var(--bg);display:grid;place-items:center;width:180px;height:180px}
    img{width:144px;height:144px}
    </style><img src="${svgUrl(icon)}" alt="">`);
  await page.screenshot({ path: "public/apple-touch-icon.png" });

  // Recreate the social card from vector assets, self-hosted fonts and shared design tokens.
  const cells = Array.from({ length: 72 }, (_, i) => {
    const status = ["supported", "supported", "unknown", "supported", "partial", "unknown"][
      (i * 7 + Math.floor(i / 9)) % 6
    ];
    return `<i style="background:var(--status-${status})"></i>`;
  }).join("");
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(`<style>${tokens}
    @font-face{font-family:Display;src:url('${fontUrl("geist")}');font-weight:100 900}
    @font-face{font-family:Mono;src:url('${fontUrl("geist-mono")}');font-weight:100 900}
    *{box-sizing:border-box}
    body{margin:0;width:1200px;height:630px;padding:64px 80px;background:
      radial-gradient(ellipse at 12% 0%,var(--accent-glow),transparent 55%),
      radial-gradient(circle at 1px 1px,var(--line) 1px,transparent 0),var(--bg);
      background-size:100% 100%,22px 22px;color:var(--ink)}
    .logo{display:block;width:300px;height:auto}
    h1{position:absolute;top:190px;left:80px;margin:0;width:720px;
      font:700 70px/1.1 Display;letter-spacing:-2px}
    em{font-style:normal;color:var(--accent)}
    .matrix{position:absolute;right:72px;top:166px;display:grid;
      grid-template-columns:repeat(9,26px);gap:7px;padding:24px;
      background:var(--bg-elevated);border:1px solid var(--line);border-radius:24px;
      box-shadow:var(--shadow-lg)}
    i{display:block;width:26px;height:26px;border-radius:6px}
    footer{position:absolute;bottom:68px;left:80px;font:22px Mono;color:var(--ink-muted)}
    </style>
    <img class="logo" src="${svgUrl(wordmark)}" alt="letsauth">
    <h1>Authentication for<br>agents, <em>measured</em><br>instead of asserted.</h1>
    <div class="matrix">${cells}</div>
    <footer>letsauth.eu · an independent lab for agent auth</footer>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "public/og.png" });
} finally {
  await browser.close();
}
