# Tasks: Visual redesign

**Input**: `specs/016-visual-redesign/plan.md`. Each work package (section 9) appends its own
section here and marks its tasks as it completes them.

## Format: `[ID] Description`

## WP0: Baseline and tooling

No visual change. Measures the site and adds the gates the later packages rely on.

- [x] W0-T01 `scripts/check-budgets.ts`: reads `dist/`, gzip level 6; prints CSS, JavaScript, HTML, inline SVG and preloaded font bytes per page and the size of each island; `LIMITS` holds the section 7 targets with an `enforce` flag each, and only the constitution's 150 kB JavaScript line is enforced
- [x] W0-T02 `scripts/check-prose.ts`: the mechanical rules of section 8 (banned words and phrases, "ecosystem" outside quotes, sentences starting with "Whether", "Every claim" more than once per file, the em dash) over `src/pages/**/*.astro`, `src/components/**/*.astro`, `README.md` and `docs/*.md`; warn-only, with `--fail` and a `FAIL` constant for WP9
- [x] W0-T03 `package.json`: `check:budgets` and `check:prose`, both inside `pnpm check` (prose after lint, budgets after the build and link check)
- [x] W0-T04 `src/lib/motion.ts`: `reducedMotion()`, false outside a browser; unit test in `tests/unit/motion.test.ts`
- [x] W0-T05 `lighthouserc.json`: add `/` (`/breaches/` was already listed), CLS at most 0.1 and TBT at most 200 ms as errors; the 95 gate stays until WP10
- [x] W0-T06 `.github/workflows/ci.yml`: CI runs the steps one by one rather than `pnpm check`, so it gains a prose step after lint and a budgets step after the build
- [x] W0-T07 `tests/e2e/helpers.ts`: `expectEndStateUnderReducedMotion(page, selector)` emulates reduced motion, reloads an open page, and asserts the element is visible with no running animation or transition in its subtree
- [x] W0-T08 `docs/development.md`: the two new commands and what they enforce
- [x] W0-T09 Fill in the "Today" column of section 7 from `pnpm check:budgets` in the pull request description

## WP1: Tokens and type

Graphite neutrals, the wordmark's teal and rust as the two accents, Geist only. Legacy token
names alias the new ones so every unmigrated component keeps rendering. Decisions 1 and 2 of
section 10 took the recommended options (Geist for headlines, cool graphite neutrals).

- [x] W1-T01 `src/styles/tokens.css`: the section 3.2 colour table, the status mapping, requirement levels and toggle kinds (`--toggle-attack`, `--toggle-misconfiguration`); the 3.3 type scale (`--text-body`, `--leading-body` 1.7, `--measure` 66ch, `--small`, `--tiny` as the 13px floor, `--h1-home`, `--h1`, `--h2`, `--h3`); 3.4 shape (`--radius` 10px, `--radius-plate` 14px, `--radius-pill`, `--radius-focus`, `--gutter`, `--page-max` 78rem); 3.5 motion (`--ease-draw`, `--dur-draw`, zeroed under reduced motion); `data-theme` still only flips `color-scheme`
- [x] W1-T02 `src/styles/tokens.css` alias block: the legacy names resolve to the new tokens, the removed ones to their nearest value (shadows to an invisible shadow so comma lists stay valid, glows to `transparent`, `--status-*-soft` to a 12% tint); `--text-2xs` and `--text-xs` now resolve to `--tiny`; no custom property used under `src/` is left undefined
- [x] W1-T03 `src/styles/fonts.css`: Bricolage Grotesque removed; `Geist Fallback` (local Arial with Geist 1.7.2 metric overrides) added and placed after Geist in `--font-body`; `--font-display` aliases `--font-body`
- [x] W1-T04 `src/layouts/Base.astro`: two preloads (Geist, Geist Mono; 51.3 kB per page by `check:budgets`); `theme-color` metas set to `--ground` in sRGB; phone nav padding narrowed so the five 13px labels still fit at 320px under the wider gutter
- [x] W1-T05 `src/styles/global.css`, base rules only: body text at `--text-body`, focus ring offset 3px with `--radius-focus`; the shared surfaces are left to WP2
- [x] W1-T06 `package.json`, `pnpm-lock.yaml`: `@fontsource-variable/bricolage-grotesque` removed; `scripts/generate-brand-assets.ts` and `scripts/generate-readme-assets.ts` set headlines in Geist; `src/pages/made-in-europe.astro` names the two fonts
- [x] W1-T07 `scripts/check-contrast.ts` and `scripts/lib/contrast.ts` (unit test in `tests/unit/contrast.test.ts`): OKLCH to sRGB to WCAG contrast for every gated pair, read from `tokens.css`; `pnpm check:contrast` runs inside `pnpm check` and in `ci.yml`
- [x] W1-T08 Contrast adjustments, recorded in `docs/design.md`: dark `--rule-strong` 52% to 54% (outline on a panel, 3:1) and light `--caution` 52% to 50% (SHOULD tag text on its own 8% tint, 4.5:1)
- [x] W1-T09 `scripts/check-budgets.ts`: the preloaded font limit (60 kB) is enforced
- [x] W1-T10 `docs/design.md` (new): tokens with sRGB values, status and level mapping, legacy aliases, the contrast table, type, shape and the motion catalogue of section 4; `docs/development.md` lists `check:contrast`
- [x] W1-T11 `CLAUDE.md`, `docs/architecture.md`: Geist for headlines and text, Geist Mono for ids and code
- [x] W1-T12 Screenshot baselines: every one changes with the palette; to be refreshed through the `refresh-screenshots` label on the pull request, not from a local browser

## WP2: Layouts and shared surfaces

Flat header, banner and footer; the long-form layout with its rail and reading progress; the
shared surfaces of section 5.2 on cascade layers. Product components are left to WP3 to WP7,
apart from marking their secondary buttons `quiet`.

- [x] W2-T01 `src/styles/global.css`: `@layer reset, tokens, base, layout, components, product, utilities, print`; `tokens.css` imported into `tokens`, `fonts.css` unlayered; scoped component styles stay unlayered and win
- [x] W2-T02 `src/styles/global.css`, base: headings weight 600 with tracking and `text-wrap: balance`, prose links in `--signal` with a 45% underline, sentence-case table heads, inline code on `--ground-3`
- [x] W2-T03 `src/styles/global.css`, surfaces: `.panel`, `.rows`, `.plate`, `.explainer`, `.transcript`, `.timeline` (new); `.button` (signal fill), `.button.quiet`, `.button.small`; `.chip` with `.pill` as a deprecated alias; sentence-case `.eyebrow` without the dash; `.level`, `.kv`, `.steps`, `.callout`, `.notice` (+ `.caution`), `.facts`, `.field`, `.page-foot`; `.card`/`.cards` kept as flat deprecated aliases until WP10
- [x] W2-T04 `src/layouts/Base.astro`: header on `--ground` with a hairline, not sticky, no blur; text navigation with a 2px rail under the current section; up to 64rem the navigation is its own row that scrolls sideways with no scrollbar and brings the current section into view; the long/short label pair is gone; theme toggle swaps its icon only (M16); banner on `--ground-2` as one sentence with the link at its end, no pulsing dot; footer on `--ground-2`; ambient dot grid and glow removed
- [x] W2-T05 M1: root crossfade at `--dur` (220ms) through `::view-transition-group(root)`; `navigation: none` under reduced motion
- [x] W2-T06 `src/layouts/Document.astro`: text column one measure wide beside a 15rem rail; section numbers as `--tiny` Geist labels; the rail marks the `:target` section through generated `:has()` selectors; body typography moved from `:where()` into `@layer layout`
- [x] W2-T07 M14: `.reading-progress`, 2px `--signal`, `animation-timeline: scroll(root)` inside `@supports` and `prefers-reduced-motion: no-preference`, hidden otherwise (longhand properties, because the minifier folds a shorthand and the timeline into one invalid declaration)
- [x] W2-T08 M15: buttons, navigation, toggle, rail links and fields transition colour and border at `--dur-fast`
- [x] W2-T09 `src/styles/tokens.css`: `--lede` added (`--text-lg` aliases it); `--header-h` is 0 since the header scrolls away
- [x] W2-T10 `src/components/BrandLogo.astro` 10rem; `src/pages/404.astro`, `about.astro`, `contribute.astro`, `privacy.astro`, `imprint.astro`, `made-in-europe.astro`: `.cards`/`.card` to `.rows`/`.panel`, `.pill` to `.chip`, buttons to `.button`/`.button.quiet`; no copy changes
- [x] W2-T11 Secondary buttons in `index.astro`, `MatrixPage.astro`, `Matrix.svelte`, `Explorer.svelte`, `standards/index.astro` and the server and scan pages marked `quiet`, so each view keeps one filled button
- [x] W2-T12 `tests/e2e/foundation.spec.ts`: the fit test checks the scrolling navigation at every width (row inside the viewport, no scrollbar, every link reachable at 13px or more, no page scroll); the current section is marked and in view at 320px; the header is static with no shadow or blur; the progress bar renders and fills where `animation-timeline` is supported; under reduced motion it is hidden and nothing runs
- [x] W2-T13 `docs/design.md`: the `--lede` token, the layers and the surface list with the deprecated aliases
- [x] W2-T14 Screenshot baselines: every page changes; to be refreshed through the `refresh-screenshots` label on the pull request, not from a local browser

## WP3: Home page

The home page as a statement, the matrix on its plate, the facts, an index of the five products
and the latest observations. No boxes, no icons, one filled button.

- [x] W3-T01 `src/components/MatrixThumb.astro` (new): the whole matrix as one SVG, servers across and requirements down; observed statuses as filled squares, a recorded unknown as a dashed ring, a derived one as a faint dot, not applicable as a dash, so the StatusCell distinction holds without colour; one-letter classes and a namespaced global style so the marks carry no scoping attribute; `view-transition-name: matrix` with a `--dur-slow` group (M2), ready for `MatrixPage.astro` to name its table the same way in WP4
- [x] W3-T02 `src/components/Facts.astro` (new): the `.facts` row with the figures in the HTML; an inline script (384 B gzip) resets them to 0 and counts up over 600ms with an ease-out once the row is half in view, through one `IntersectionObserver`; nothing runs under reduced motion or without the observer; each figure reserves the width of its final value, so counting moves nothing (CLS 0); `beforeprint` restores the final figures (M3)
- [x] W3-T03 `src/pages/index.astro`: statement head (eyebrow, an 18ch h1 at `--h1-home`, a two-sentence lede, one filled and one quiet button), the matrix on a `.plate` with one caption line (servers × requirements, last observation date, link) and a key, the facts over a rule, the five products as `.rows` with counts from the dataset, the latest observations as `.rows` with a `StatusCell` each (newest per server, six servers), and a `page-foot`; the gradient word, the window chrome, the glow, the hover lift, the three "how" boxes and the "refuses to be" section are gone
- [x] W3-T04 Home copy rewritten per section 8: no slogan, no triad, no banned phrase; `check:prose` reports nothing for `index.astro`; every number is rendered from `getDataset()`
- [x] W3-T05 `tests/e2e/home.spec.ts` (new): the five products and their counts, one filled button, no script file or island, every matrix cell drawn and named `matrix`, the count-up waiting at 0 out of view and ending at the dataset's figures, the final figures at once under reduced motion, the h1 in two lines at 1440px and four at 360px, no sideways scroll at 320px, the figures present without JavaScript, axe and a screenshot
- [x] W3-T06 Screenshot baselines: `home.spec.ts` is new; its three baselines come from the `refresh-screenshots` label on the pull request, not from a local browser

## WP4: MCP atlas

The matrix, its filters and dialog, and the server, feature, revision and changes pages on the
new surfaces; flat status glyphs and grade badge; M9, M10 and the M2 target. The work also takes
the matrix page's blocking time from about 1.9 s to about 0.5 s of long-task time at a 4x CPU
throttle (Lighthouse TBT from 390 to 500 ms to roughly 50 to 150 ms in local runs). `MaturityTag`
and `RelationList` render only on the standards pages, so they stay with WP5.

- [x] W4-T01 `src/components/StatusCell.astro`: one element per glyph, drawn from its own background and border, with a one-path SVG for the three observed glyphs (no pseudo-element, mask or transform; each measured as a cost across the matrix's 900 cells; a check drawn from gradient stripes did not join and was replaced after review); filled square with check, half disc or cross for observed statuses, dashed ring for a recorded unknown, faint dot for a derived one, dash for not applicable; same props; the label variant (`.status-label`) puts the glyph before the word; styles global in `@layer product` with prefixed names
- [x] W4-T02 `src/components/ObservationDetail.astro`: global styles in `product` (no scoping attribute on each of the thousand copies), the shared `.kv` for its fields, "no observation on record" wording
- [x] W4-T03 `src/components/MatrixTable.astro`: global styles in `product`, every selector under `.matrix`; fixed table layout from a `colgroup` (most of the page's layout time was the auto layout measuring each cell); the region framed by rules on `--ground`, server column sticky on `--ground`, group rows on `--ground-2`; feature id, level and party written upwards at 13px or more; changed and new columns as a filled dot and a ring; access and auth as `.chip`s, dashed when derived; no hover transforms; `view-transition-name: matrix` for M2
- [x] W4-T04 M9: the row under the pointer or focus takes `--signal-soft`; the column takes it from the hovered cell's `::after`, which reaches past the table and is clipped by `.matrix-clip` (`overflow: clip`, `isolation: isolate`). Plain CSS, so it needs neither the island nor `:has()`, and only one pseudo-element exists at a time
- [x] W4-T05 `src/components/Matrix.svelte`: M10 with `@starting-style` (backdrop fade, panel up 8px over `--dur`); the backdrop veils the page in `--ground` instead of a colour literal and a blur; the dialog on `--ground-2` with a `--rule-strong` outline and no shadow; focus moves to its heading on open and back to the cell on close; the island skips its first pass when the URL has no filter, leaves rows in place unless they were grouped, touches cells only when the shown columns change, and keeps the fixed layout's `--cols` and column span in step with the filters
- [x] W4-T06 `src/components/MatrixPage.astro`: revision line between rules, the segmented switch flat, filters inside an `.explainer`, `.chip` for the revision state, legend and footer copy without "inferred from silence", semicolons or the "X, not Y" frame; selects share a row on phones
- [x] W4-T07 `src/components/GradeBadge.astro`: Geist 600 letter in a 1px outline, A and B in the supported ink, C partial, F unsupported, a withheld grade dashed; no fill
- [x] W4-T08 `src/pages/mcp/features/[id].astro`: the two boxes become ruled sections in a grid whose columns shrink to the viewport (`minmax(min(100%, 22rem), 1fr)`), which fixes the horizontal scroll at 320px; the level table scrolls in its own region; status lists as ruled columns; the empty share bar dashed instead of a gradient
- [x] W4-T09 `src/pages/mcp/servers/[id].astro`: withdrawn notice as `.notice`; profile facts ruled, the status summary a `.panel`; `.chip`s for classes and the current revision; the feature table between rules with its head on `--ground-2`; the em dash in the evidence regex written as `—`
- [x] W4-T10 `src/pages/mcp/changes/[from]/[to].astro`: the two revisions as dated `.timeline` entries, the changed, added and removed features as ruled lists under the newer one
- [x] W4-T11 Code inside the small key/value text keeps the 13px floor on the server and feature pages
- [x] W4-T12 `tests/e2e/matrix.spec.ts`: focus on the dialog heading; 320px region scroll with the server column sticky and no page scroll; the five status forms in greyscale (screenshot); M10 and M9 end states under reduced motion; the crosshair without JavaScript. `feature-page.spec.ts`: no page scroll at 320px
- [x] W4-T13 `docs/design.md`: how status glyphs are drawn and why the matrix styles sit in `product`
- [x] W4-T14 Screenshot baselines refreshed through the `refresh-screenshots` label on the pull request, not from a local browser: matrix, server and the new status-shape shots changed; the feature page and the scanner pages stayed within the 2% tolerance in CI's Chromium
- [x] W4-T15 Review: the matrix comes first. The revision moves into the head's meta line, the filters fold into one "Filter and group" button in a bar with the status legend and the count right above the table (the island opens it when the URL carries a filter), and the legend notes and the facts row move below the table; the matrix region is as wide as its table
- [x] W4-T16 Review: `.field` inputs and selects share one 2.5rem box; selects drop the platform drawing for a chevron in `--ink-2` (`.field` is only used on the matrix page)
