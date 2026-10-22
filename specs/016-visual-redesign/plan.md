# Implementation plan: visual redesign

**Branch**: `claude/project-thread-s77523` (plan only) | **Date**: 2026-10-20 | **Status**: proposed

This is a planning document. It describes how letsauth.eu moves to a calmer, more considered
visual language, where motion earns its place, how the stack and budgets change, and how the
copy loses its generated feel. It is written for coding agents: each work package below can be
picked up on its own branch, has an explicit scope, file list, dependencies and acceptance
criteria, and is mergeable on its own.

Two references shaped it:

- **Tone**: the `modernize` branch of janbrennenstuhl.eu ("Trust Boundaries" design system,
  `docs/DESIGN.md` and `assets/css/site.css` there). Graphite neutrals, desaturated support
  colours, one soft accent per view, 1px rules and 2px accent rails instead of shadows, Geist
  for everything with Geist Mono only for identifiers, a 13px floor, a 66ch measure, a
  deterministic decorative drawing per page that draws in once, CSS-only view transitions, a
  scroll-driven reading progress bar, and hard byte budgets. Its rule in one line: "Nothing
  shouts; the writing carries the page."
- **Components and motion**: the blue16.nl "Secure AI explained" page. Its useful patterns are
  numbers that count up once when they scroll into view, a layered diagram where clicking a layer
  explains it, a step loop that advances by itself until the reader touches it, a scenario with a
  state that changes per signal, a decision log that fills in as the reader picks, a terminal
  transcript, and a dated timeline. Its less useful patterns for a lab site are the quiz, the
  auto-advancing defaults and the amount of simultaneous motion. We borrow the first group and
  decline the second.

The result should look like one site with the blog, not a copy of it: same calm, same type, same
rules, but with letsauth's own two brand colours (the teal and the rust of the wordmark) as its
accent and warning, and with the data views (matrix, map, chain, report) as the things the page
is built around.

## 1. Goals and non-goals

Goals

1. One quiet visual system: flat surfaces, hairlines, two accents, Geist. No glass, no glow, no
   gradient text, no drop shadows, no hover lifts.
2. Motion only where it explains something or confirms an action: a path drawing in, a step
   becoming current, a number arriving, a dialog opening. Every animation has a reduced-motion
   form that still conveys the same state.
3. Zero JavaScript on pages that only read; islands under 8 kB each; CSS under 20 kB compressed;
   Lighthouse 100/100 on performance and accessibility for the home page, each atlas root and
   the explorer. CLS 0.
4. Copy that a careful engineer wrote: concrete nouns, one claim per sentence, no triads, no
   rhetorical headlines, no "in the era of".
5. No change to the data model, the schema, the scanner or any URL.

Non-goals

- A new information architecture. Pages, routes and the page skeleton stay (constitution,
  `docs/architecture.md` "Pages").
- A design system package or a Storybook. Tokens stay in one CSS file and components stay in
  `src/components/`.
- Illustrations, photography or icon sets. The site draws its own diagrams from data.
- Removing the work-in-progress banner. That is its own PR when Jan says so (`CLAUDE.md`).

## 2. Constitution check

- I — One model, many views: no entity changes. Every work package renders existing data.
- II — Every claim cites a revision: citations stay in every view; the content pass may not
  remove one. The build still fails on a dangling citation.
- III — Neutral and passive: no new fetches. Status glyphs keep the observed/recorded
  unknown/derived distinction (`StatusCell`). `unknown` is never styled as a failure.
- IV — Static first: everything stays pre-rendered. Islands remain progressive enhancement; every
  page reads without JavaScript. One new build-time script (budgets) and one lint (prose).
- V — Craft and budgets: this plan tightens the budgets (section 7) and keeps WCAG 2.2 AA, both
  themes, reduced motion and phone width as gates. Every colour pair is listed with its contrast.
- VI — Agent-legible: each work package names files and acceptance criteria; screenshot baselines
  are refreshed per package so an agent can verify its own change.
- VII — European by default: fonts stay self-hosted; no new third party.

One deviation, added by the review follow-up R-04: `elkjs` (the Eclipse Layout Kernel compiled
to JavaScript) lays out the standards map at build time. It is a dev dependency, runs only in
`src/lib/graph.ts` during `astro build`, ships no bytes to visitors and is deterministic for a
fixed input, so screenshot baselines stay stable. The hand-rolled column layout it replaces could
not route edges around nodes, and the map was unreadable with 67 free curves. One intentional
change to a documented convention: headlines move from Bricolage Grotesque to Geist (section 3.3). `CLAUDE.md`, `docs/architecture.md` and `tokens.css` are
updated in the same package (WP1), so the repository never contradicts itself.

## 3. Design language

### 3.1 Principles

1. **Rules, not boxes.** Group with a hairline or whitespace. A panel (`--ground-2`) is for a
   block that must read as a different kind of thing (a finding, a notice, a series). Never two
   nested panels.
2. **One accent per view.** Teal (`--signal`) is links, focus, the current step, the highlighted
   path. Rust (`--threat`) is warnings, attacks, unsupported. Nothing else is coloured except the
   four status inks, which carry meaning and are always paired with a glyph or a word.
3. **Type carries hierarchy.** Size, weight 600 and tracking do the work. Eyebrows and labels are
   sentence case in Geist at the small size, not uppercase mono. Mono is for identifiers, dates
   that align, code and the terminal transcript.
4. **Motion is a state change, shown once.** Things draw in, become current, or settle. Nothing
   loops by default, nothing pulses, nothing parallaxes. Durations 120 to 480 ms, one easing
   family. Under `prefers-reduced-motion: reduce` the end state appears without the transition.
5. **The data view is the hero.** On every product root the matrix, map, chain or report sits
   above the fold in the text column, framed by a 1px rule, not in a mock window.

### 3.2 Colour tokens

Defined once in `src/styles/tokens.css` as OKLCH pairs resolved by `light-dark()`;
`:root[data-theme]` only flips `color-scheme` (unchanged). The neutrals take the blog's cool
graphite (hue 250 to 255) so the two sites read as one family; the accents come from the
wordmark (`public/brand/wordmark.svg`: teal `#006b5d`, rust `#ad472e`), desaturated in dark.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--ground` | `oklch(98.5% 0.003 250)` | `oklch(21% 0.008 255)` | page |
| `--ground-2` | `oklch(95.5% 0.005 250)` | `oklch(25% 0.01 255)` | panels, footer, table head, diagram plate |
| `--ground-3` | `oklch(91.5% 0.007 250)` | `oklch(29.5% 0.011 255)` | inline code, pressed control |
| `--code-bg` | `oklch(97.2% 0.004 250)` | `oklch(18.5% 0.008 255)` | code blocks, token views, transcript |
| `--ink` | `oklch(24% 0.01 255)` | `oklch(91% 0.005 255)` | text |
| `--ink-2` | `oklch(47% 0.012 255)` | `oklch(72% 0.01 255)` | secondary text, labels |
| `--rule` | `oklch(88% 0.006 250)` | `oklch(33% 0.01 255)` | hairlines |
| `--rule-strong` | `oklch(62% 0.01 255)` | `oklch(52% 0.012 255)` | outlines, controls |
| `--signal` | `oklch(46% 0.09 175)` | `oklch(78% 0.08 172)` | the accent: links, focus, current, highlighted path |
| `--signal-soft` | `color-mix(in oklch, var(--signal) 14%, transparent)` | same | selection, marked row, `:target` |
| `--on-signal` | `oklch(98.5% 0.003 250)` | `oklch(21% 0.008 255)` | text on a signal fill |
| `--threat` | `oklch(50% 0.12 35)` | `oklch(79% 0.09 45)` | warnings, attack toggles, MUST |
| `--boundary` | `oklch(48% 0.06 230)` | `oklch(76% 0.05 230)` | MAY, the EU body, trust boundary dashes |
| `--ok` | `oklch(48% 0.07 155)` | `oklch(78% 0.06 155)` | supported, passing |
| `--caution` | `oklch(52% 0.1 70)` | `oklch(80% 0.08 80)` | partial, SHOULD, misconfiguration toggles |

Status mapping (replaces the `--status-*` and `--status-*-soft` pairs):

| Status | Ink | Glyph | Recorded vs derived |
| --- | --- | --- | --- |
| supported | `--ok` | filled square, check | filled |
| partial | `--caution` | filled square, half disc | filled |
| unsupported | `--threat` | filled square, cross | filled |
| unknown (recorded) | `--ink-2` | dashed ring | outline only |
| unknown (derived) | `--ink-2` at 45% | small dot | faint |
| not applicable | `--rule-strong` | dash | faint |

Requirement levels: MUST `--threat`, SHOULD `--caution`, MAY `--boundary`, DEPRECATED
`--ink-2` with strikethrough. Toggle kinds in the explorer: attack `--threat`, misconfiguration
`--caution`.

Contrast gate (WP1 acceptance): every text ink on `--ground` and `--ground-2` at or above 4.5:1
in both themes; status inks used as text at or above 4.5:1; status fills with `--on-signal`
glyphs at or above 3:1. The computed table goes into `docs/design.md`, as the blog does.

Removed tokens (kept as aliases to `none`/their nearest value through WP1 to WP9, deleted in
WP10): `--bg-glass`, `--accent-glow`, `--accent-soft`, `--accent-2-soft`, `--shadow-sm`,
`--shadow`, `--shadow-lg`, `--inset-highlight`, every `--status-*-soft`. Legacy names `--bg`,
`--bg-elevated`, `--bg-sunken`, `--ink-muted`, `--ink-faint`, `--line`, `--line-strong`,
`--line-soft`, `--accent`, `--accent-strong`, `--accent-ink`, `--accent-2`, `--focus` become
aliases of the new names in WP1 so unmigrated components keep rendering, and are removed in WP10.

### 3.3 Type

- **Geist** (variable, Latin subset) for headlines, interface and body. **Geist Mono** for
  identifiers, dates in tables, code, token views and the transcript. Bricolage Grotesque is
  removed with its package and preload: one font request fewer, roughly 30 kB less on first
  paint, and the same headline voice as the blog.
- Metric-matched fallback: `Geist Fallback` is Arial with `size-adjust: 104.71%`,
  `ascent-override: 95.98%`, `descent-override: 28.17%` (values from the blog, computed from
  Geist 1.7.2 metrics), so the swap does not move text. CLS 0 is a gate.
- Scale: body `clamp(1.0625rem, 1.02rem + 0.15vw, 1.125rem)`, line height 1.7, measure 66ch.
  `--small` 0.875rem, `--tiny` 0.8125rem (13px floor, nothing smaller). H1 on the home statement
  `clamp(2.25rem, 1.6rem + 2.6vw, 3.75rem)`, on data pages `clamp(2rem, 1.5rem + 2vw, 3.1rem)`,
  H2 `clamp(1.4rem, 1.25rem + 0.6vw, 1.7rem)`, H3 1.2rem. Headings weight 600, tracking −0.015em
  to −0.03em, `text-wrap: balance`.
- Labels, eyebrows, table heads: Geist at `--small` or `--tiny`, sentence case, `--ink-2`,
  tabular figures where numbers align. The uppercase mono eyebrow with the leading dash goes.
- Links in prose are `--signal` with a 1px underline at 45% opacity, full on hover. Links in
  navigation and lists inherit `--ink`/`--ink-2` with no underline.

### 3.4 Space, shape, rules

- Spacing scale unchanged (4px base, `--space-1` to `--space-9`). `--gutter`
  `clamp(1.25rem, 4vw, 3rem)`, `--page-max` 78rem, `--measure` 66ch.
- One radius for controls and panels (10px), 14px for the diagram plate, 999px for pills. No
  radius on tables or rules.
- Rules are 1px `--rule`; accent rails (findings, notices, the current step) are 2px.
- Shadows: none. Elevation is expressed by `--ground-2` and a rule. The one exception is the
  cell dialog (`Matrix.svelte`), which uses the backdrop, not a shadow.
- Focus: 2px solid `--signal`, offset 3px, 4px radius. Unchanged in spirit, new colour.

### 3.5 Motion tokens

```
--ease: cubic-bezier(0.2, 0.7, 0.2, 1);        /* interface */
--ease-draw: cubic-bezier(0.5, 0, 0.2, 1);     /* paths drawing in */
--dur-fast: 120ms;  --dur: 220ms;  --dur-slow: 480ms;  --dur-draw: 1200ms;
```

Under `prefers-reduced-motion: reduce` every duration is 0ms (as today), `@view-transition`
is `navigation: none` (as today), and every keyframe animation is wrapped in
`@media (prefers-reduced-motion: no-preference)` so it never runs. Islands read
`matchMedia("(prefers-reduced-motion: reduce)")` once through `src/lib/motion.ts` (WP0) and skip
timers, smooth scrolling and autoplay when it matches.

## 4. Motion catalogue

Every animation on the site, where it lives, what it means, its reduced-motion form, and the
package that builds it. Anything not in this table does not animate.

| # | Where | What | Means | Reduced motion | WP |
| --- | --- | --- | --- | --- | --- |
| M1 | Every page | Cross-document view transition, root crossfade 220ms | continuity | none (as today) | WP2 |
| M2 | Home → `/mcp/`, `/standards/` → spec, `/explorer/` → scenario | Shared `view-transition-name` on the data view (matrix plate, map, chain head) so it morphs instead of crossfading | "this is the same object, larger" | none | WP3, WP5, WP6 |
| M3 | Home facts, server page facts | Count-up from 0 to the value, 600ms, once, when 50% in view, tabular figures | "these are live numbers" | value rendered at once | WP3 |
| M4 | Standards map, decorative plate | Highlighted path draws in (`stroke-dashoffset`), 1200ms, halo fades after, once on load | "follow this path" | path shown complete | WP5, WP8 |
| M5 | Explorer chain | Per step: the sender and receiver light up in the actor head, the current arrow draws in (300ms, ease-out), the body fades up 8px (220ms); earlier steps keep a quieter arrow and later ones a hairline, in colour, not opacity, so text keeps its contrast | "you are here" | arrow and body shown, highlight and dimming applied without transition | WP6, R-08 |
| M6 | Explorer chain | One scene clock (a Web Animations API timeline) holds the playhead; Play, Pause, Previous, Next, the scrub bar, a click on a step or a log line and the arrow keys all move it. Steps advance every 2.5 s. Auto-advance (amended by review follow-up 8): armed once per page, it starts when the chain has sat in view for 1 s with no input, and stops for good on hover, touch, focus, scroll or any key; it never restarts by itself and never starts with a step in the URL. Play, once pressed, pauses on any click, key or scroll | guided reading | Play button hidden, no auto-advance; the scrub bar and the step buttons still seek | WP6, R-08 |
| M7 | Explorer token view | On step change, claims that differ from the previous hop get a 2px `--signal` rail that fades to `--rule` over 480ms, starting when the message has drawn (300ms) and 40ms apart | "this is what changed in the token" | rail shown without fade | WP6, R-08 |
| M8 | Explorer toggle pages | Changed and removed steps get the same rail treatment on page load (one pass, staggered 40ms per step, max 400ms total) | "the toggle touched these" | shown at once | WP6 |
| M9 | Matrix | Row and column crosshair on hover/focus of a cell (`--signal-soft` background, 120ms) | orientation in a large grid | instant | WP4 |
| M10 | Matrix | Cell dialog: backdrop fades, panel moves up 8px, 220ms, using `@starting-style` | "a detail opened" | appears | WP4 |
| M11 | Matrix filters | Count text changes with no animation; hidden rows collapse instantly (today's behaviour) | — | — | WP4 |
| M12 | Scanner report | The request ladder prints line by line, 60ms apart, when the section scrolls into view, once; the grade appears last | "this is what the scanner did, in order" | all lines shown | WP7 |
| M13 | Breach page | Timeline rail draws in top to bottom, 480ms, dates fade in behind it | "events in sequence" | shown | WP6 |
| M14 | Long-form pages (`Document.astro`) | Reading progress bar, 2px `--signal`, `animation-timeline: scroll(root)` behind `@supports` | place in the text | hidden | WP2 |
| M15 | Controls | Colour and border transitions on hover/focus, 120ms | affordance | instant | WP2 |
| M16 | Theme toggle | Icon swap only; no rotation | — | — | WP2 |
| M17 | Explorer toggles | A toggle link swaps the chain in place (crumbs, toggles, notice, steps) through a same-document view transition, 220ms; steps the two chains share morph, the rest fade, and M8 runs on the new rails. The toggle stays its own static page for a reload, a new tab or no JS | "the same chain, with one thing changed" | ordinary navigation | R-08 |
| M18 | Explorer chain | A quiet decision log under the chain gains one line per step reached (number, sender → receiver, message), the newest fading in over 220ms; a line seeks back to its step | "what has happened so far" | lines appear | R-08 |

Explicitly removed from today's site: the pulsing dot in the work-in-progress banner (it loops),
the hover lifts on cards, buttons and the hero thumbnail, the rotating theme toggle, the ambient
dot grid and accent glow, the gradient on the primary button and the hero accent word.

Rules for any later addition: it must fit one row of this table (place, meaning, reduced-motion
form), run once per page load or per user action, use only `transform`, `opacity`,
`stroke-dashoffset`, `background-color`, `border-color` or `color`, and fit the budgets.

## 5. Components

Shared surfaces stay in `src/styles/global.css` (constitution: one token system, reused
surfaces). Per-page styles stay in the page or component. This section says what each surface
becomes; WP2 builds the shared ones, later packages the product-specific ones.

### 5.1 Layout (`src/layouts/Base.astro`, `Document.astro`)

- Header: a 1px bottom rule on `--ground`, no blur, no sticky. Brand at left (wordmark, dark
  variant swaps as today), primary navigation as text links with a 2px bottom border on the
  current one, tools at right (theme toggle; search trigger when Pagefind gets a palette, see
  WP10 stretch). Phone: navigation becomes a horizontally scrollable row under the brand with
  no scrollbar; the long/short label pair goes.
- Work-in-progress banner: `--ground-2` band, 1px rule, one sentence, link at the end; no dot.
- Footer: `--ground-2` band with a statement, three link columns, and the legal line under a
  rule. Content as today.
- Page head: eyebrow (sentence case, `--small`, `--ink-2`), h1 (max 24ch), lede (`--ink-2`,
  48ch), optional meta line, optional facts row over a rule. Same structure, new type.
- `Document.astro`: article grid 15rem + measure on wide screens, sticky section list with
  `aria-current` tracking (CSS `:has(:target)` today; keep it, no observer), reading progress
  bar (M14), section numbers as `--tiny` labels in Geist, not mono.

### 5.2 Surfaces (`global.css`)

| Surface | Today | Becomes |
| --- | --- | --- |
| `.card` / `.cards` | elevated, shadow, inset highlight, grid of boxes | `.panel` (`--ground-2`, 10px radius, no border) for blocks that are a different kind of thing; lists of links become `.rows` (hairline rows, title left, meta right, like the blog's index). `.cards` is removed; the three "how" items on the home page become a numbered `.rows` list. |
| `.button` | pill, shadow, lift, gradient primary | `.button`: `--signal` fill with `--on-signal` text, 10px radius, no shadow, no transform. `.button.quiet`: 1px `--rule-strong` outline. `.button.small`. Hover darkens via `color-mix`. Only one filled button per view. |
| `.pill` | uppercase mono chip | `.chip`: Geist `--tiny`, sentence case, 1px `--rule` outline, pill radius; `.chip.signal` / `.chip.threat` tints |
| `.eyebrow` | uppercase mono with dash | sentence case Geist `--small`, `--ink-2`, parts separated by ` / ` |
| `.level` | mono chip with tinted background | mono `--tiny` text in its level colour, no background; a 1px outline only in tables |
| `.kv` | grid with uppercase labels | same grid, labels sentence case `--tiny` |
| `.steps` | numbered rows with ringed numerals | numbered rows, numeral in `--ink-2` tabular, 1px rules; current step (explorer) gets a 2px `--signal` left rail |
| `.callout` | elevated with accent left border | outlined with `--rule-strong`, no fill |
| `.notice` | accent-2 tinted card | `--threat` 2px rail on a 12% `--threat` tint; `.notice.caution` with `--caution` |
| `.facts` | display font numbers | Geist 600, `clamp(1.6rem, …, 2.25rem)`, tabular; labels `--tiny` |
| `.field` | elevated inputs with shadow | inputs on `--ground` with `--rule-strong` border, 8px radius, no shadow |
| `.page-foot` | muted links over a rule | unchanged structure; links as `.rows`-style text links |
| `.explainer` (new) | — | dashed `--rule-strong` outline, 10px radius: the part the reader can operate (explorer controls, scanner request ladder, matrix filters). Borrowed from the blog, where the dashes mean "trust boundary" in the drawings. |
| `.transcript` (new) | — | `--code-bg` block in Geist Mono, one request per line with method, URL and status; used by the scanner report (M12) |
| `.timeline` (new) | — | vertical rail with dated entries; used by breach pages (M13) and the revision changes page |
| `.plate` (new) | — | the frame for a data view: 1px `--rule`, 14px radius, `--ground-2` ground; used by the home matrix, the standards map, the decorative drawing |

### 5.3 Product components

- `StatusCell.astro`: flat glyphs per section 3.2. Keep the API (`status`, `derived`,
  `variant`). Keep the title text. 1.25rem cell, 1rem label variant.
- `MatrixTable.astro` and `Matrix.svelte`: sticky first column and header on `--ground`; group
  header rows in `--ground-2`; crosshair (M9) via `:has()` where supported, with the island
  adding `data-col` hover classes only as a fallback; dialog (M10). Server names as plain links,
  the access/auth classes as chips.
- `MatrixPage.astro`: filter form inside an `.explainer`; the count line in `--small`.
- `GradeBadge.astro`: a letter in Geist 600 inside a 1px outline, colour by grade using the four
  status inks; no fill.
- `MaturityTag.astro`: a `.chip`.
- `StandardsMap.astro` / `.svelte`: nodes as rounded rectangles on `--ground-2` with `--ink`
  labels; edges in `--ink-2` at 35%; the hovered node's neighbourhood in `--signal`; relation
  types by dash pattern, not by colour (the legend says so). Path draw-in (M4) on the
  `builds-on` spine from the oldest to the newest spec. After R-04: a rail beside the drawing
  is legend, filter and reading pane in one (checkboxes filtering through `:has()` rules, no
  script needed); references are off by default; the dependency edges are routed by ELK and
  the cross links drawn as curves; below 40rem the drawing gives way to `StandardsOutline.astro`,
  the dependency forest as an indented outline.
- `ChainPage.astro`, `Explorer.svelte`, `TokenView.astro`: lanes as 1px `--rule` lifelines;
  arrows as 1.5px `--ink-2` lines with the current one in `--signal` 2px; toggled steps get a
  `--caution`/`--threat` rail; removed steps struck and dimmed. Stepper controls inside an
  `.explainer` with Previous, Next, Play (M6) and the step count. Token view: claims as a `.kv`
  on `--code-bg`, changed claims with a rail (M7).
- `ScanReport.svelte` and `src/pages/mcp/servers/[id]/scan.astro`: head with the grade and the
  date, then the request ladder as a `.transcript` (M12), then the checks as `.rows` with a
  `StatusCell` each.
- `Crumbs.astro`, `Citation.astro`, `RelationList.astro`, `ObservationDetail.astro`: type and
  colour updates only.
- `Plate.astro` (new, WP8): deterministic decorative drawing. See WP8.

## 6. Tech stack

Keep: Astro 7, Svelte 5 islands, TypeScript strict, Biome, Vitest, Playwright with screenshot
comparison, Pagefind, pnpm, Bunny. The constitution's stack is right for this; the change is in
how it is used.

Decisions

1. **No animation library.** Everything in section 4 is CSS (`transition`, `@keyframes`,
   `@starting-style`, `animation-timeline`, `@view-transition`) or a few lines in an existing
   island. Motion One, GSAP, Framer and Lottie are out: they cost more than the budget allows and
   none of the catalogue needs them.
2. **CSS cascade layers.** `global.css` declares
   `@layer reset, tokens, base, layout, components, product, utilities, print;`. Component and
   page `<style>` blocks stay scoped by Astro and need no layer. This stops the `:where()` and
   specificity workarounds in `Document.astro`.
3. **Modern CSS with fallbacks that degrade to the end state.** `light-dark()`, `color-mix()`,
   `:has()`, `@starting-style`, scroll-driven animations and view transitions are used behind
   `@supports` or are harmless when unsupported. Baseline: the last two major versions of
   Chrome, Edge, Firefox and Safari; older browsers get the static page, which is the design
   anyway.
4. **Fonts**: `@fontsource-variable/geist` and `geist-mono` stay, `bricolage-grotesque` is
   removed. Both remaining fonts are preloaded. The fallback `@font-face` with metric overrides
   goes into `fonts.css`.
5. **Inline critical CSS**: Astro's default `inlineStylesheets: "auto"` inlines small
   stylesheets. Set it to `"always"` only if the Lighthouse LCP gate (section 7) fails with the
   external stylesheet; it is one round trip either way and the blog chose the strict CSP over
   it. Decision deferred to WP10 with the measurement in hand.
6. **Islands**: `client:idle` stays on all four. Each island imports `src/lib/motion.ts` for the
   reduced-motion check and nothing else new. No island may exceed 8 kB compressed; the matrix
   island is the largest today and must be measured in WP0.
7. **Budget enforcement in CI**: a new `scripts/check-budgets.ts` reads `dist/` after the build
   and fails on any page over budget (section 7). It runs inside `pnpm check` and in `ci.yml`.
8. **Prose lint**: a new `scripts/check-prose.ts` scans `src/pages/**/*.astro`,
   `src/components/**/*.astro`, `README.md` and `docs/*.md` for the banned list in section 8.
   Runs inside `pnpm check`.
9. **Search palette** (stretch, WP10): Pagefind already indexes the site. A ⌘K dialog that loads
   `pagefind.js` on demand, as the blog does with its own index, is in scope only if it fits the
   JS budget and lands after everything else.

## 7. Performance budgets

Enforced by `scripts/check-budgets.ts` on `dist/` (compressed with gzip at level 6, the figure
Bunny serves) and by `lighthouserc.json`. These tighten constitution V; they do not replace it.

| Budget | Limit | Today (to be measured in WP0) |
| --- | --- | --- |
| CSS per page, all stylesheets | 20 kB | ? |
| JavaScript on a page without an island | 0 kB (the theme script is inline and under 300 B) | ? |
| JavaScript per island, compressed | 8 kB | ? |
| JavaScript per page, total | 30 kB | ? |
| HTML per page (matrix excepted: 120 kB) | 60 kB | ? |
| Preloaded fonts, total | 60 kB | ~90 kB (three) |
| Inline SVG per page (map and chain excepted: 40 kB) | 8 kB | ? |
| Third-party requests | 1 (Plausible, production only, after `load`) | 1 |
| Lighthouse performance, accessibility | 100 on `/`, `/mcp/`, `/standards/`, `/explorer/`, `/breaches/`; 95 on every other page in `lighthouserc.json` | 95 gate |
| CLS | 0 | ? |
| TBT | 0 ms | ? |
| LCP, simulated mobile | 1.5 s | ? |

Rules that keep the budgets: no layout-affecting animation; `content-visibility: auto` on long
lists (matrix rows below the fold, the observation history, the spec list); images only in
`public/` and only the brand and OG card; every SVG that is data (map, chain, thumbnail) is
rendered at build time with no runtime measurement.

## 8. Content pass

The site reads in places like the output of a language model: triads ("see, test and break"),
headline questions and answers ("What it is, and what it refuses to be"), the "X, not Y"
construction in every lede, "in the agent era", a gradient-highlighted verb in the hero, and the
same claim restated three times in three boxes. The pass removes that and leaves plain
statements with the data behind them.

Voice rules (also the checklist for `scripts/check-prose.ts` where a rule is mechanical)

1. One claim per sentence, under 25 words, active, present tense. No semicolons in copy.
2. The first sentence of a page says what the page shows and where the data comes from. No
   slogan heads a data page.
3. No triads, no "not X but Y" or "X, not Y" framing, no rhetorical questions in headings, no
   headline verbs in a different colour.
4. Banned words and phrases (lint): seamless, robust, leverage, empower, unlock, delve, journey,
   landscape, ecosystem (except in a quoted source), cutting-edge, next level, game-changing,
   in the era of, in the age of, measured instead of asserted, yours to download, refuses to be,
   nothing is inferred from silence, first-class (as an adjective in copy), any sentence
   starting with "Whether", "Every claim" used more than once per page, and the em dash.
5. Numbers come from the dataset at build time, never typed into copy. A number in prose is
   rendered from `getDataset()`.
6. Labels are sentence case. Product names keep their case (MCP auth atlas, Agent auth atlas,
   Delegation chain explorer, Breach anatomy, Scanner).
7. Each page has a lede of one or two sentences; the facts row carries the numbers; the body
   says how the data was obtained and what it cannot say.
8. "unknown" is described as "no observation on record", never as missing or failing.

Inventory (every page with copy; the WP that rewrites it)

| Page | Today's problem | WP |
| --- | --- | --- |
| `/` | hero slogan with gradient word, three "every X cites Y" boxes, "what it refuses to be" | WP3 |
| `/mcp/` head, filter help, legend | mostly fine; legend wording, "unknown" phrasing | WP4 |
| `/mcp/servers/[id]`, `/mcp/features/[id]`, revisions, changes | eyebrow and meta phrasing | WP4 |
| `/standards/`, `/standards/[id]` | lede; relation descriptions | WP5 |
| `/explorer/`, scenario and toggle pages, scenario YAML `summary` fields | "step through"; toggle notices | WP6 |
| `/breaches/`, `/breaches/[id]` | class summaries | WP6 |
| `/mcp/scanner/`, scan pages | "passive" explained three ways | WP7 |
| `/about/`, `/contribute/`, `/made-in-europe/` | lab story, triads | WP9 |
| `/accessibility/`, `/privacy/`, `/imprint/`, `/disclaimer/`, `/404` | accessibility statement must describe the new motion behaviour | WP9 |
| `README.md`, footer statement, OG description, `Base.astro` title suffix | tagline | WP9 |

Scenario and breach text lives in YAML under `data/`. The content pass edits `summary`, `note`
and `message` fields there as data PRs with no schema change; citations are untouched.

## 9. Work packages

Sequence: WP0 → WP1 → WP2 → {WP3, WP4, WP5, WP6, WP7 in any order, in parallel} → WP8
(optional, after WP3) → WP9 (after all of WP3–WP7) → WP10. Each package is one pull request
against `main`, named `016-wpN-<slug>`, and marks its tasks in a `tasks.md` section it adds to
this directory. Every package runs `pnpm check`, refreshes the screenshot baselines it changes
(`pnpm test:e2e --update-snapshots` with the pinned Chromium, or the `refresh-screenshots`
label) and leaves the others untouched.

Common acceptance criteria (every package)

- `pnpm check` passes; `pnpm test:e2e` passes in light, dark and phone projects.
- No horizontal scroll at 320px; no text under 13px; axe reports no serious or critical issue.
- Reduced motion: with `page.emulateMedia({ reducedMotion: "reduce" })` the package's screens
  show their end state immediately (one Playwright assertion per animation introduced).
- No colour literal outside `tokens.css`; no new dependency unless the package says so.
- Budgets in section 7 hold for every page the package touches.

### WP0 — Baseline and tooling

Scope: measure where the site stands and add the gates the later packages rely on. No visual
change.

Files: `scripts/check-budgets.ts` (new), `scripts/check-prose.ts` (new, banned list from
section 8, warn-only until WP9 flips it to fail), `src/lib/motion.ts` (new:
`export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches`),
`lighthouserc.json` (add `/`, `/breaches/`, CLS and TBT assertions, keep 95 until WP10),
`package.json` (`check:budgets`, `check:prose` in `check`), `.github/workflows/ci.yml`,
`tests/e2e/helpers.ts` (add `expectEndStateUnderReducedMotion(page, selector)`),
`docs/development.md` (the two new commands), `specs/016-visual-redesign/tasks.md` (new).

Dependencies: none.

Acceptance: `pnpm check:budgets` prints a table of every page with CSS, JS, HTML and SVG bytes
and the island sizes, and fails only on the constitution's 150 kB JS line for now; the "Today"
column of section 7 is filled in by the PR description; `check:prose` lists current hits without
failing; the motion helper has a unit test.

### WP1 — Tokens and type

Scope: the new palette, type and motion tokens; the font change; aliases for legacy names so
nothing breaks; the contrast table.

Files: `src/styles/tokens.css` (rewrite per 3.2 to 3.5, with the alias block), `src/styles/fonts.css`
(remove Bricolage, add `Geist Fallback`), `src/layouts/Base.astro` (preload list: two fonts;
`theme-color` metas to the new ground values), `package.json` and `pnpm-lock.yaml` (remove
`@fontsource-variable/bricolage-grotesque`), `CLAUDE.md` and `docs/architecture.md` (type
convention: Geist for headlines), `docs/design.md` (new: tokens, contrast table, motion
catalogue; the design system page the blog has), `tests/e2e/__screenshots__/**` (every baseline
changes because every colour does; refresh all).

Dependencies: WP0.

Acceptance: contrast script or table in `docs/design.md` shows every pair at or above 4.5:1 (3:1
for glyph on fill) in both themes; `grep -r "Bricolage" src` is empty; the preloaded font total
is under 60 kB; CLS is 0 on the Lighthouse pages (fallback metrics work); every page still
renders with the legacy token names (visual regression limited to colour and type; the
screenshot diff is reviewed, not just accepted).

### WP2 — Layouts and shared surfaces

Scope: `Base.astro`, `Document.astro` and the shared surfaces in `global.css` per section 5.1
and 5.2; the cascade layers; M1, M14, M15, M16; remove the ambient background, the glass header,
the banner pulse, the shadows and the lifts.

Files: `src/styles/global.css`, `src/layouts/Base.astro`, `src/layouts/Document.astro`,
`src/components/Crumbs.astro`, `src/components/BrandLogo.astro` (size only),
`src/pages/404.astro`, the long-form pages only where a class name changes (`about`,
`contribute`, `made-in-europe`, `accessibility`, `privacy`, `imprint`, `disclaimer`: class
renames, no copy), `tests/e2e/foundation.spec.ts` (header fit test covers the scrolling nav;
add reduced-motion and progress-bar assertions), screenshot baselines for the foundation pages.

Dependencies: WP1.

Acceptance: no `box-shadow`, `backdrop-filter`, `filter: blur`, `background-image: *gradient`
or `transform: translateY` on hover anywhere in `global.css` or the layouts; header passes the
existing fit test at every width in `foundation.spec.ts`; the reading progress bar is absent
under reduced motion and when `animation-timeline` is unsupported; `.cards` no longer exists
(its last users are migrated in WP3–WP7, so WP2 keeps a deprecated alias that WP10 deletes).

### WP3 — Home page

Scope: the home page as statement, flagship data view, facts, index and latest observations;
the home copy; M2 (matrix plate → `/mcp/`), M3.

Files: `src/pages/index.astro` (rewrite of markup, styles and copy), `src/components/Facts.astro`
(new: the facts row with the count-up as a tiny inline script under 400 B, gated by reduced
motion, `IntersectionObserver` once), `src/components/MatrixThumb.astro` (new: the SVG thumbnail
extracted from `index.astro` with `view-transition-name: matrix`, also used by `MatrixPage.astro`
for the morph target in WP4), `tests/e2e/home.spec.ts` (new: screenshot, reduced motion,
no-JS numbers present in HTML), baselines.

Layout: statement (eyebrow "An independent lab for agent authorization", h1 of at most 18ch,
lede of two sentences), then the flagship `.plate` with the full matrix thumbnail and one line
under it (servers × requirements, last observation date, link), then the facts row over a rule,
then an index of the five products as `.rows` (name, one sentence, count from the dataset), then
the latest observations as `.rows` with a `StatusCell` each. No boxes, no icons, one filled
button.

Dependencies: WP2.

Acceptance: zero JavaScript on `/` except the inline theme script and the count-up (measured by
`check:budgets`); numbers present in the HTML without JavaScript; the h1 fits in two lines at
1440px and four at 360px; Lighthouse 100/100; the prose lint reports no hit on `index.astro`.

### WP4 — MCP atlas

Scope: the matrix, its filters and dialog, server, feature, revision and changes pages;
`StatusCell` flat glyphs; `GradeBadge`; M9, M10, M2 target.

Files: `src/components/StatusCell.astro`, `src/components/MatrixTable.astro`,
`src/components/MatrixPage.astro`, `src/components/Matrix.svelte`, `src/components/GradeBadge.astro`,
`src/components/MaturityTag.astro`, `src/components/ObservationDetail.astro`,
`src/components/RelationList.astro`, `src/pages/mcp/**` (markup and copy; revision changes page
gets the `.timeline`), `src/lib/labels.ts` only if a label wording changes, `tests/e2e/matrix.spec.ts`,
`server-page.spec.ts`, `feature-page.spec.ts`, `revision.spec.ts`, baselines.

Dependencies: WP2. Can run in parallel with WP5–WP7.

Acceptance: the five status forms (filled, dashed ring, dot, dash, with the label variant) are
distinguishable in both themes without colour (shape test by screenshot); the crosshair works
without the island (`:has()`) and the island only adds the fallback class; the dialog opens
with focus on its heading and returns focus on close (existing behaviour kept); the matrix
island stays under 8 kB compressed; the table scrolls horizontally inside its region at 320px
with the first column sticky; `content-visibility: auto` on rows keeps the matrix page's TBT at 0.

### WP5 — Standards map

Scope: the map SVG and the spec list, spec pages; M4 on the `builds-on` spine, hover
neighbourhood in `--signal`, relation types by dash pattern; M2 (map → spec page by node).

Files: `src/components/StandardsMap.astro`, `src/components/StandardsMap.svelte`,
`src/pages/standards/index.astro`, `src/pages/standards/[id].astro`, `src/lib/standards.ts`
(only if the spine needs a helper; no data change), `tests/e2e/standards.spec.ts`,
`spec-page.spec.ts`, baselines.

Dependencies: WP2. Parallel with WP4, WP6, WP7.

Acceptance: the legend explains relation types by dash pattern and maturity by chip, and the
map is readable in greyscale (screenshot with `filter: grayscale(1)` in the test); the draw-in
runs once and is absent under reduced motion; the map's inline SVG stays under 40 kB; the
island stays under 8 kB; keyboard focus on a node highlights its neighbourhood exactly as hover
does.

### WP6 — Explorer and breach anatomy

Scope: chain lanes, step reveal, Play, token diff, toggles; breach pages with the timeline;
scenario and breach copy in `data/`; M5, M6, M7, M8, M13, M2 (explorer index → scenario).

Files: `src/components/ChainPage.astro`, `src/components/Explorer.svelte`,
`src/components/TokenView.astro`, `src/components/Citation.astro`, `src/pages/explorer/**`,
`src/pages/breaches/**`, `src/lib/explorer.ts` (a `diffClaims(prev, next)` helper for M7 with a
unit test; pure, no schema change), `data/scenarios/*.yaml` and `data/vulnerabilities/*.yaml`
(copy fields only; `pnpm validate:data` and `check:append-only` must pass),
`tests/e2e/explorer.spec.ts`, `breaches.spec.ts`, `tests/unit/explorer.test.ts`, baselines.

Dependencies: WP2. Parallel with WP4, WP5, WP7.

Acceptance: the chain reads completely without JavaScript (existing test kept); Play never
starts by itself, pauses on any interaction and is hidden under reduced motion; the token diff
is computed at build time into `data-changed` attributes so the island only toggles a class;
arrow keys still step; the toggle pages show the changed and removed steps with the rail on
load and with no transition under reduced motion; the explorer island stays under 8 kB; the
timeline on a breach page is an ordered list with `time` elements, readable without CSS.

### WP7 — Scanner pages

Scope: the scanner overview and per-server report; the request ladder transcript; the grade;
M12; copy.

Files: `src/components/ScanReport.svelte`, `src/pages/mcp/scanner/index.astro`,
`src/pages/mcp/servers/[id]/scan.astro`, `src/lib/scanner.ts` (rendering helpers only; no change
under `src/scanner/`), `tests/e2e/scanner.spec.ts`, baselines.

Dependencies: WP2, and WP4 for the final `GradeBadge` (can start before it with the alias
tokens). Parallel otherwise.

Acceptance: the transcript lists every request the report records with method, URL, status and
what was read, in order, as static HTML; the line-by-line reveal runs once and is absent under
reduced motion; nothing on the page suggests the visitor can trigger a scan (the constitution's
"no on-demand scanning"); the island stays under 8 kB.

### WP8 — Decorative plate (optional)

Scope: a deterministic, label-free drawing per section root and per spec page, as the blog
does, so that every page has one calm visual and no two look alike; the social card generator
uses the same drawing.

Files: `src/components/Plate.astro` (new: hash of the page id and title → 3 to 5 columns of
nodes, links, one highlighted path, one dashed trust boundary, one of eight hues at shared
lightness and chroma; always `aria-hidden`), `src/lib/plate.ts` (the pure generator with a unit
test for determinism), `scripts/generate-brand-assets.ts` (OG cards per product from the same
generator), `src/pages/{mcp,standards,explorer,breaches}/index.astro` and
`src/pages/standards/[id].astro` (place it under the page head), `tests/unit/plate.test.ts`,
baselines.

Dependencies: WP3 (so the home flagship is the matrix, not a drawing, and the two do not
compete).

Acceptance: the same input always yields the same SVG (snapshot test); the SVG stays under 4 kB
per page; the draw-in (M4) runs once and is static under reduced motion; the drawing never
appears on a page that already has a data view above the fold (matrix, map, chain, report); a
`plate: false` prop removes it.

Decided (22 October 2026, review follow-up 10): Jan chose to ship it on `/explorer/`,
`/breaches/` and the spec pages only. `/mcp/` and `/standards/` keep their data view as the one
visual, so the drawing stays off them; the cards are per section root (explorer and breaches),
and spec pages keep the home card. As built, the drawing departs from the file list above: a
first version (a network on its own plate under the head, one of eight hues) read as added on
top, so it is a miniature delegation chain in the explorer's vocabulary and existing inks
(`--signal` path, `--boundary` dash, hairlines), floated beside the title inside the page head
on wide screens and left out below 64rem. A page leaves it out by not placing `<Plate>`, so no
`plate: false` prop is needed.

Original decision for Jan: ship this, or keep letsauth's visuals strictly data-derived. The plan
recommends shipping it on the four section roots and spec pages only, because those pages have
no diagram of their own and the drawing is what makes the two sites read as a family. Skipping
it costs nothing else in the plan.

### WP9 — Content pass

Scope: every page in the section 8 inventory that WP3–WP7 did not already rewrite; `README.md`;
the footer statement; the title suffix; the accessibility statement (describe reduced motion,
the Play control, the dialog); flip `check:prose` from warn to fail.

Files: `src/pages/about.astro`, `contribute.astro`, `made-in-europe.astro`, `accessibility.astro`,
`privacy.astro`, `imprint.astro` (wording only, legal content unchanged), `disclaimer.astro`,
`404.astro`, `src/layouts/Base.astro` (footer statement, title suffix), `src/lib/site.ts` (if the
tagline lives there), `README.md`, `scripts/check-prose.ts` (fail mode), `docs/*.md` where they
quote site copy.

Dependencies: WP3–WP7 merged.

Acceptance: `pnpm check:prose` passes in fail mode over `src/`, `README.md` and `docs/`; every
page's first sentence says what the page shows; no number in copy is typed by hand (grep for
digits in `.astro` prose outside `{}` expressions, reviewed by hand); the accessibility statement
lists every motion in section 4 with its reduced-motion form.

### WP10 — Consolidation

Scope: delete the alias tokens and `.cards`; raise the Lighthouse gate to 100 on the five root
pages; decide `inlineStylesheets`; refresh every baseline once; write `docs/design.md`'s final
form; the optional search palette.

Files: `src/styles/tokens.css`, `src/styles/global.css`, `lighthouserc.json`, `astro.config.mjs`
(only if the LCP gate requires inlining), `docs/design.md`, `docs/architecture.md`,
`CLAUDE.md` (the "Conventions" bullets for tokens, surfaces and motion), `tests/e2e/**`,
optionally `src/components/Palette.svelte` and `Base.astro` for ⌘K.

Dependencies: WP9.

Acceptance: `grep -rn "\-\-bg\b\|--ink-muted\|--line\b\|--accent\b\|--shadow" src` is empty;
`check:budgets` and Lighthouse at the section 7 limits; `CLAUDE.md` describes the site as it
is; the palette, if built, loads nothing until invoked and keeps `/` at zero island JavaScript.

## 10. Risks and open decisions

| Risk | Mitigation |
| --- | --- |
| Screenshot churn: WP1 changes every baseline, and parallel packages WP4–WP7 each refresh their own | Each package refreshes only the spec files it owns; WP10 does one full refresh. Conflicts are in PNGs only and are resolved by regenerating, never by hand-merging. |
| The alias tokens let a package forget to migrate | WP10's grep is the gate; `check:budgets` has nothing to do with it, so WP10 adds a one-line `scripts/check-tokens.ts` or a Biome-adjacent grep in `pnpm check`. |
| `:has()` crosshair cost on a 60 × 40 table | Measure in WP4; if paint time exceeds 16 ms on a mid phone, drop the column half of the crosshair and keep the row. |
| Count-up and reveal animations read as decoration | Each runs once and only when the number or line is the content of the section; if a reviewer cannot say what it means in one phrase (section 4 "Means" column), remove it. |
| Removing Bricolage changes the wordmark's relationship to the headlines | The wordmark is an SVG and does not use the font; headlines in Geist 600 sit closer to the blog. Jan to confirm (decision 1 below). |

Decisions for Jan before WP1 starts

1. **Headline font**: Geist only (recommended, matches the blog, saves a font) or keep Bricolage
   Grotesque for h1 only.
2. **Neutral hue**: cool graphite like the blog (recommended, hue 250 to 255) or keep the warm
   paper of today (hue 85) with the new flat treatment.
3. **WP8 plate**: ship or skip (section WP8). Decided: ship, on the explorer, breach and spec pages.
4. **Search palette**: in WP10 scope or not at all.

If no answer arrives, the packages proceed with the recommended option in each case.
