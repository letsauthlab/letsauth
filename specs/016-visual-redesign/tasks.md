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

## WP5: Standards map

The map on a plate with one ink for every relation, told apart by dash pattern and weight; the
neighbourhood of the node in focus in the signal colour; the builds-on spine drawn in once; the
spec list and spec pages on the shared surfaces. No data change.

- [x] W5-T01 `src/lib/standards.ts`: `buildsOnSpine(specs, relations)`, the longest builds-on chain from the oldest document to the newest, stable on ties; unit test in `tests/unit/standards.test.ts`
- [x] W5-T02 `src/components/StandardsMap.astro`: the map frame is a `.plate`; lanes as hairlines with sentence-case labels; nodes on `--ground` with the maturity as a chip (dashed for a draft); edges in one ink, relation types by dash pattern, weight and arrowhead; all map text at 13px or more (`src/lib/graph.ts`: nodes 200 by 68, label column 120)
- [x] W5-T03 M4: the spine edges draw in once on load from the oldest end (`stroke-dashoffset` over `--dur-draw`, split across the chain), a `--signal-soft` halo shows during the draw and fades after; both only under `prefers-reduced-motion: no-preference`, so the spine is drawn complete and the halo absent otherwise; filtered items use `visibility` so a filter never restarts the draw
- [x] W5-T04 The legend moves into the map component as two `.panel`s: relation types with a sample drawn by the map's own edge styles, maturity by `MaturityTag`, and a note that colour only marks the node in focus
- [x] W5-T05 `src/components/MaturityTag.astro`: a `.chip`, signal-tinted when published or in force, dashed when a draft, struck when expired or withdrawn
- [x] W5-T06 `src/components/StandardsMap.svelte`: the neighbourhood highlight in `--signal` with a signal arrowhead; M2: on `pageswap` the followed list link, or an empty box over the followed map node (SVG cannot be captured), takes the `spec-title` view transition name that the spec page's h1 carries
- [x] W5-T07 `src/pages/standards/index.astro`: filters in an `.explainer` (samples dropped from the checkboxes, the legend has them); recently revised as the head's meta line; the spec list as `.rows` per body with `content-visibility: auto`; this fixes the horizontal scroll at 320px (the old grid had a 20rem minimum); lede and copy without semicolons
- [x] W5-T08 `src/pages/standards/[id].astro`: the withdrawn/expired notice as `.notice`, revisions as a `.timeline` with `.chip` status, features as `.rows`, eyebrow parts split by ` / `; `src/components/RelationList.astro` as `.rows`; `src/lib/labels.ts` relation descriptions without semicolons
- [x] W5-T09 `tests/e2e/standards.spec.ts`: no page scroll at 320 and 412px; the spine animates once per edge; reduced motion shows the end state with no halo; keyboard focus highlights the neighbourhood as hover does; the legend counts and a greyscale screenshot of the map; `spec-page.spec.ts`: the title's view transition name
- [x] W5-T10 Screenshot baselines for the standards and spec pages, plus the new greyscale one, through the `refresh-screenshots` label (the workflow only runs tests whose title contains "looks right", so the greyscale test is named that way)
- [x] W5-T11 Colour back on the map after review (Jan): each relation type keeps its dash pattern and weight and gets a colour (builds on `--signal`, profiles `--boundary`, competes with `--threat`, solves the same problem as `--caution`, replaces and references `--ink-2`) at 62% strength, full on the spine and on the focused node's relations, with matching arrowheads; maturity chips coloured too (published `--signal`, in force `--boundary`, candidate `--caution`), in the map and in `MaturityTag`. Deviates from plan 5.3, which kept colour for the focus only

## WP7: Scanner pages

The scanner overview and the per-server report on the new surfaces; the request ladder as a
transcript with the line-by-line reveal (M12); the 320px overflow on `/mcp/scanner/` fixed.

- [x] W7-T01 `src/lib/scanner.ts`: `requestLadder(view)` reads the requests a recorded report records from the evidence of its newest scanner observations (a recorded report keeps no request log, `requests` stays empty and `scan.json` is unchanged): method, URL, answer and the fields read, one line per method and address with the newest answer, in ladder order (protected resource metadata path-aware then root, the endpoint GET then POST, any pointer, the authorization server)
- [x] W7-T02 `src/components/ScanReport.astro` replaces `ScanReport.svelte`: the component never hydrated (its live mode went in 004 T031), and as Astro it uses `StatusCell` instead of a copy of its glyphs. Grade letter in a 1px outline with no fill; the ladder as a `.transcript` inside an `.explainer`, with the grade as its last line; the checks as `.rows` per party with a `StatusCell`, the level, id, cited section, date and evidence
- [x] W7-T03 M12: a page script (no island) arms the ladder only when motion is allowed and `IntersectionObserver` exists, and prints it line by line 60ms apart, once, when it scrolls into view; the static list is the end state, so without JavaScript or under reduced motion every line shows at once
- [x] W7-T04 `src/pages/mcp/servers/[id]/scan.astro`: the grade rule as a `.panel`, the unscanned requirements as `.rows` with `.chip`s, the withdrawn notice as `.notice`
- [x] W7-T05 `src/pages/mcp/scanner/index.astro`: "What it reads" is the ladder of one example scan as a `.transcript`, built from the scanner's own URL rules; status and grade rule as `.panel`s; the run-it-yourself note says the site never scans on request; grids use `min(100%, …)` so nothing is wider than the viewport at 320px; three missing spaces after line breaks restored
- [x] W7-T06 `tests/e2e/scanner.spec.ts`: no page scroll at 320 and 412px on both pages; no form, input or scan button; the transcript matches `requestLadder` line by line with JavaScript off and ends with the grade; the reveal runs once with the grade last; reduced motion shows the end state
- [x] W7-T07 Screenshot baselines: the `refresh-screenshots` run on the pull request found `scanner.png` and `report.png` unchanged (both are viewport shots, the head is above the changes and the report is masked), so none were committed
