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
- [x] W4-T14 Screenshot baselines refreshed through the `refresh-screenshots` label on the pull request, not from a local browser: matrix, server and the new status-shape shots changed; the feature page and the scanner pages stayed within the 2% tolerance in CI's Chromium. After review, a second run refreshed the matrix and status-shape shots again (new tick, matrix-first layout); the home and server shots stayed within tolerance
- [x] W4-T15 Review: the matrix comes first. The revision moves into the head's meta line, the filters fold into one "Filter and group" button in a bar with the status legend and the count right above the table (the island opens it when the URL carries a filter), and the legend notes and the facts row move below the table; the matrix region is as wide as its table
- [x] W4-T16 Review: `.field` inputs and selects share one 2.5rem box; selects drop the platform drawing for a chevron in `--ink-2` (`.field` is only used on the matrix page)

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

### WP3 follow-up: one page, not a stack of sections

After review, the merged home page read as unfinished: loose sections with nothing tying them
together. The former layout's side-by-side split comes back in the new tone.

- [x] W3-T07 `src/pages/index.astro`: statement and matrix plate side by side above 64rem, as before; the plate gets a head (product and revision, link) and a foot (size, last observation, key) on its own rules, with the grid on `--ground`
- [x] W3-T08 The facts as one band between two rules, equal columns with a hairline between each (two by two below 64rem)
- [x] W3-T09 "What the lab publishes" (numbered `.rows`, counts as `.chip`) and "Latest observations" (on a `.panel`, with the seed note and a quiet small button) side by side above 64rem, each under an eyebrow
- [x] W3-T10 `tests/e2e/home.spec.ts`: the two sections sit side by side at 1440px; selectors follow the new markup; baselines refreshed through the `refresh-screenshots` label

## WP6: Explorer and breach anatomy

The chain on a plate with hairline lifelines and the stepper in an `.explainer`; Play, the step
reveal, the token rail and the toggle rails; breach pages on `.rows`, `.panel` and a
`.timeline`; the copy of these pages and of their YAML.

- [x] W6-T01 `src/components/ChainPage.astro`: the chain on a `.plate` (clipped, so the actor head stays sticky) with a `--ground-2` head and no blur; lanes as 1px `--rule` lifelines; arrows 1.5px `--ink-2`, the current one 2px `--signal` with a filled numeral; toggled steps carry a 2px rail and arrow in the toggle's ink (`--toggle-attack`, `--toggle-misconfiguration`); removed steps struck with dashed arrows; a self arrow in the last lane loops left so it stays inside the plate; the toggle notice is the shared `.notice` (`.caution` for misconfiguration), tinted in oklab; tags are `.chip`; the list no longer collides with the shared `.steps` surface
- [x] W6-T02 M5: once the reader steps, the current arrow draws in (`scaleX`, 300ms) and its body rises 8px (220ms); later steps dim through an opacity transition at `--dur`
- [x] W6-T03 M6 in `src/components/Explorer.svelte`: Play advances every 2.5 s after it is pressed, stops at the last step, pauses on any pointer, key, wheel or touch input other than pressing Play itself, and is not offered under reduced motion (`reducedMotion()` from `src/lib/motion.ts`); Next is the one filled button, Previous and Play are `quiet`
- [x] W6-T04 M7 in `src/components/TokenView.astro`: claims on `--code-bg` with a 2px rail on every added, changed or removed claim, marked at build time as `data-changed` (from `diffClaims`, already pure and unit tested); the island only toggles `is-fresh` on the current step, which starts the rail in `--signal` and settles it on `--rule` over 480ms
- [x] W6-T05 M8: on a toggle page the rails of the touched steps light up once on load, 40ms apart and no later than 400ms, in CSS alone
- [x] W6-T06 M2: the scenario title on `/explorer/` and the h1 of its scenario and toggle pages share a `view-transition-name`
- [x] W6-T07 `src/pages/explorer/index.astro`: scenarios as `.rows` with actors as a plain line and toggles as wrapping links with a kind dot and a key; "How to read a chain" as a `.panel`; this fixes the horizontal scroll at 320px (nowrap pills in a grid item)
- [x] W6-T08 `src/pages/breaches/index.astro`: entries as `.rows` with the class as a `.chip`; `src/pages/breaches/[id].astro`: facts in a `.panel`, a `.timeline` ordered list with a `time` element for the disclosure and the fix as its second entry, controls as `.rows`, the replay as a `.panel`
- [x] W6-T09 M13: the timeline rail draws in from the top (`scaleY`, 480ms) and its entries fade in behind it, once, on load
- [x] W6-T10 Copy: explorer and breach heads, ledes and how-to text rewritten to section 8 (no slogan heads, no semicolons, no "X, not Y"); semicolons removed from the `summary` and `note` fields of `data/scenarios/*.yaml` and `data/vulnerabilities/*.yaml`, citations and messages untouched
- [x] W6-T11 `tests/e2e/explorer.spec.ts`, `breaches.spec.ts`: no horizontal scroll at 320px on every explorer and breach page; Play never starts by itself, advances when pressed and pauses on a key; the token diff is in the markup without JavaScript; reduced-motion end states for M5, M6, M7, M8 and M13; the timeline holds a `time` element; axe runs on the settled breach page
- [x] W6-T13 Breach layout rework after review: the entry page puts the account (summary after its first sentence, the missing control, the replay as a rail in the toggle's ink) at reading width beside a sticky facts panel (timeline, affects, sources as short labels); the index is a ledger with the date, class and id in a narrow column beside each entry and its missing control and replay as labelled lines
- [x] W6-T12 Screenshot baselines for `explorer.spec.ts` and `breaches.spec.ts`: refreshed through the `refresh-screenshots` label on the pull request

## WP9: Content pass

The copy that WP3 to WP7 did not rewrite, against plan section 8 and the Plain English layer of
the review (sentences under 20 words on average and none over 30, active voice with a named
actor, "you" and "we", no em dashes or semicolons in body copy, no triads, no "X, not Y").
Taken as review follow-up 9. Legal content keeps its substance; only the wording changes.

- [x] W9-T01 Section-root h1 under 24 characters: `/mcp/` (and the revision pages, which share `MatrixPage.astro`), `/standards/`, `/explorer/`, `/breaches/`, `/mcp/scanner/`; the lede carries what the old headline said
- [x] W9-T02 `src/layouts/Base.astro`: the home `<title>` without the em dash; the footer statement without "in the agent era" and without the triad
- [x] W9-T03 `src/pages/accessibility.astro`: a motion section that lists every animation of plan section 4 in plain words with its reduced-motion form, including Play and auto-advance in the explorer and the cell dialog; the known limits match the matrix on phones (R-05)
- [x] W9-T04 `README.md` and `docs/*.md` pass `check:prose`; `FAIL` is true in `scripts/check-prose.ts`, which also bans "game-changer" and "holistic" from the review's list; `docs/development.md` says the check fails
- [x] W9-T05 `/about/`, `/contribute/`, `/made-in-europe/`: one idea per sentence, no semicolons, no "X, not Y" principle names, no "yours to download"
- [x] W9-T06 `/privacy/`, `/imprint/`, `/disclaimer/`, `/404`: wording only, no semicolons in body copy, headings without the colon-and-triad pattern; legal content unchanged
- [x] W9-T07 Screenshot baselines for the pages whose head changed, through the `refresh-screenshots` label (on the WP8 pull request, which refreshes the same pages)

## WP8: Decorative plate

One calm, label-free drawing in the head of the pages that have no diagram of their own, as the
blog does. Jan chose to ship it on `/explorer/`, `/breaches/` and the spec pages only (review
follow-up 10); `/mcp/` and `/standards/` keep their data view as the one visual. A first version
(a network on its own framed plate under the head, in one of eight hues) read as something added
on top, so the drawing now speaks the explorer's language and sits in the head itself.

- [x] W8-T01 `src/lib/plate.ts`: the pure generator. An FNV-1a hash of the page id and title seeds a small generator; a miniature delegation chain of 3 to 5 actor heads on lifelines and 4 to 6 messages, of which a chain (each message sent by the lane the previous one reached) is the highlighted path, and one dashed trust boundary around one or two lifelines. `plateSvg()` writes the SVG with classes only, no colours, `aria-hidden`
- [x] W8-T02 Colours from the existing tokens only: lifelines `--rule`, heads `--ground-2` on `--rule-strong`, quiet messages `--rule-strong`, the path `--signal`, the boundary dash `--boundary` (plan 3.2: "trust boundary dashes"); no new tokens
- [x] W8-T03 `src/components/Plate.astro`: the first child of `header.page-head`, floated beside the title at 18rem from 64rem up, no frame, hidden below 64rem; the path draws in once on load with a halo that fades after and its ends appear when it reaches them (M4, `--dur-draw`, `--ease-draw`), only under `prefers-reduced-motion: no-preference`
- [x] W8-T04 Placed in the page head of `/explorer/`, `/breaches/` and every `/standards/<id>/` page
- [x] W8-T05 `scripts/generate-brand-assets.ts`: `public/og-explorer.png` and `public/og-breaches.png` from the same generator and seed, the drawing beside the headline as in the page head; `Base.astro` takes an `image` prop for the card
- [x] W8-T06 `tests/unit/plate.test.ts` (same input, same SVG, as a snapshot; different pages, different drawings; every plate in bounds, its path a chain and under 4 kB) and `tests/e2e/plate.spec.ts` (in the head and hidden from assistive technology on the three page types, absent on home, `/mcp/`, `/standards/` and a chain, beside the title on wide screens and hidden on phones, the section cards, axe, the reduced-motion end state)
- [x] W8-T07 `src/pages/accessibility.astro` lists the draw-in and its reduced-motion form; the plan records the decision
- [x] W8-T08 Screenshot baselines for the pages it changes: refreshed through the `refresh-screenshots` label on the pull request

## Review follow-ups (21 October 2026)

Items from the redesign review, one pull request each, in order.

- [x] R-01 PR #58 merged: matrix and feature baselines refreshed
- [x] R-02 Small fixes: `.notice`, `.notice.caution` and `.card.notice` tint in oklab, not oklch (the toggle notice in `ChainPage.astro` keeps its local tint in the kind's ink); the link after "in the" on `/explorer/` and after "See" on `/standards/` no longer loses its space to HTML compression; the entry-format `pre` on `/contribute/` is focusable (axe scrollable-region-focusable)
- [x] R-02a Imagery on the new system (asked on the R-02 pull request): the social card (`public/og.png`) redrawn as the home hero on flat tokens with the real matrix, replacing the pre-redesign card (glow, shadow, dot grid, slogan); the Apple touch icon on `--ground`; the README hero and how-it-works pictures on the new tokens without glow, shadow, gradient or dot grid, with MatrixThumb's marks and the home headline. The favicon and `public/brand/` already match the supplied logo and are unchanged
- [x] R-03 Nav wording: the primary and footer navigation read Servers, Standards, Explorer, Breaches, Contribute (Scanner stays in the footer); every `<Crumbs>` trail, the page-foot cross link on `/standards/` and the 404 buttons use the same words; `/mcp/` and `/standards/` take Servers and Standards as `<title>` and eyebrow. "Atlas" stays the product word in ledes and body copy
- [x] R-04 Standards map rework (PR #62): the head is "The standards map" with the counts in the lede. A rail beside the drawing is legend, filter and reading pane in one: relation types as line-sample toggles (references off by default), publishing bodies as toggles (a band label in the drawing toggles the same), maturity chips, the live count, a reset, and a card that names the hovered or focused node's relations in words. The toggles are checkboxes that filter the drawing and the outline through `:has()` rules in the stylesheet, so filtering works without JavaScript; the island keeps the count, mirrors the state in the URL, shows the card and highlights the neighbourhood. "Recently revised" is a view of the map (dated nodes, the rest fades), not a list in the head. The drawing is laid out by `elkjs` at build time (`src/lib/graph.ts`): a spec sits a column right of what it builds on, columns group by body behind tinted bands, dependency edges are routed orthogonally, cross links stay curves. Below 40rem the drawing gives way to `StandardsOutline.astro`: the dependency forest (`buildForest`) as an indented outline, cross links as `<details>` chips, the spine as a hairline; the outline replaces the flat list on every screen and carries body, family, revision and both links (FR-015). Baselines through the `refresh-screenshots` label
- [x] R-05 Matrix on phones: below 40rem the matrix is read one way at a time instead of the desktop table squeezed. A row of plain anchors (All and one per requirement group, with counts) picks the view through `:target`, so it works without JavaScript and every group stays in the HTML; the island turns the choice into `data-view` with `aria-current`, so switching keeps the scroll and adds no history entry. "All" draws every requirement as a strip of small glyphs per server, sized from the column with container units, so the whole atlas fits without sideways scroll; its glyphs are a picture and a group's view opens them. A group shows its own columns (one generated `nth-child` range each) with two-line horizontal labels instead of `vertical-rl`, two and a half columns in view so the next one peeks in, and scroll shadows at the frame edges. The server column is 7rem, names wrap to two lines and link to the server page, the transposed view. Desktop is unchanged. Baselines through the `refresh-screenshots` label
- [x] R-06 Matrix on desktop: the table comes straight after the head, and the status key and the live count sit under it. "Filter and group" folds into one quiet button at the end of the head's meta line; opened, the form runs under the whole line. The revision is named once, in the meta line: the lede says "the MCP Authorization specification", the link to its text is "Specification text", and the published date shows only when it differs from the revision id. On wide screens the table fits the column instead of scrolling past its edge (at 1440 px three groups were hidden behind a clipped "Tra…"): its widths come from the group row, a group whose label is wider than its columns (`data-narrow`, from an estimate of the label's length) takes the label's width, and the other columns share the rest down to a 2.25rem floor, below which the frame scrolls. The island redoes the sums when a filter changes the groups. Phones keep R-05. Baselines through the `refresh-screenshots` label
- [x] R-07 Home figures and copy: the facts read Servers, Requirements, Cells observed and Specifications. "Cells observed" counts the current matrix cells that have an observation, beside the total (611 of 897), in place of the 1,664 entries of the append-only history, which counted every scan of the same cell again; `Facts.astro` takes an optional `of` total that stands still while the figure counts up. "Latest observations" shows the six newest observations of the current revision with one row per requirement and per server, so one scan run no longer fills the panel with six rows of the same feature. The seed-data sentence under the list is gone (the server page and `/contribute/` no longer carried one). No baseline changes: the home screenshot stops above the facts
- [x] R-08 The explorer as a scene: one Web Animations API timeline (a target-less scene clock) holds the playhead for Play, Pause, Previous, Next, a scrub bar in the stepper, the arrow keys, a click on a step and the decision log (M6). Auto-advance starts once the chain has sat in view for 1 s with no input, stops for good on hover, touch, focus, scroll or a key, never restarts and never runs under reduced motion; M6 in the plan is amended. Per step the sender and receiver light up in the actor head, the message draws in over 300ms, earlier steps keep a quieter arrow and later ones a hairline (colour, not opacity, so axe passes while stepping) (M5). The changed claims get their rail 40ms apart once the message lands (M7), now through the Web Animations API instead of an `is-fresh` class. A toggle swaps the chain in place through a same-document view transition of 220ms and pushes its URL; back and forward swap again, the analytics count the swap as a pageview (M17). A quiet log under the chain gains one line per step (M18). Durations come from the motion tokens (`--dur-message`, `--stagger` and `--dur-step` are new) through `durationToken()` in `src/lib/motion.ts`. Baselines through the `refresh-screenshots` label
- [x] R-09 Content pass (WP9 above): section-root headlines under 24 characters, the title suffix and footer statement, an accessibility statement that lists every motion with its reduced-motion form, `check:prose` as a gate, and the about, contribute, made-in-Europe, legal and 404 pages in plain English
- [x] R-10 Decorative plate (WP8 above): a deterministic miniature delegation chain in the head of the explorer and breach indexes and every spec page, beside the title on wide screens, drawn in once (M4) and complete under reduced motion, with social cards for the two section roots from the same generator
- [x] R-11 Spec page composition: under the head, relations and features take the wide column and a panel beside them holds the figures (revisions, relations, features, counting up as M3) and the revision timeline (drawing in as M13), sticky as on a breach page; below 60rem the panel follows the relations. Relation groups and feature topics pack into columns (`columns: 19rem`) instead of one long list; a group heading is the verb phrase alone ("Builds on", "Is built on by") and the source link follows the note. Features group by topic under a bar of how many carry each level, named in words beside it. A spec with no recorded features shows a sentence in the panel, not a zero and not an empty section. The withdrawn or expired notice moves into the main column. Baselines through the `refresh-screenshots` label
