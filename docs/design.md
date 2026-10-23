# Design system

The visual language of letsauth.eu: tokens, type, contrast and motion. The tokens are defined
once, in `src/styles/tokens.css`; this page documents them and is checked against them.
`specs/016-visual-redesign/plan.md` has the reasoning and the work packages that apply it.

The rule in one line: nothing shouts, and the data view carries the page. Surfaces are flat,
groups are separated by 1px rules or whitespace, two accents carry meaning, and motion shows a
change of state once.

## 1. Colour

Every colour is an OKLCH pair resolved by `light-dark()`. The root follows the system preference
through `color-scheme: light dark`; `:root[data-theme]` only flips `color-scheme` when the viewer
picks a theme. Neutrals are a cool graphite (hue 250 to 255). The two accents come from the
wordmark (teal `#006b5d`, rust `#ad472e`) and are desaturated in dark. No component sets a colour
literal.

| Token | Light | Dark | sRGB (light, dark) | Use |
| --- | --- | --- | --- | --- |
| `--ground` | `oklch(98.5% 0.003 250)` | `oklch(21% 0.008 255)` | `#f9fafc`, `#16191c` | page |
| `--ground-2` | `oklch(95.5% 0.005 250)` | `oklch(25% 0.01 255)` | `#eef0f3`, `#1e2226` | panels, footer, table head, diagram plate |
| `--ground-3` | `oklch(91.5% 0.007 250)` | `oklch(29.5% 0.011 255)` | `#dfe3e7`, `#292d32` | inline code, pressed control |
| `--code-bg` | `oklch(97.2% 0.004 250)` | `oklch(18.5% 0.008 255)` | `#f4f6f8`, `#101316` | code blocks, token views, transcript |
| `--ink` | `oklch(24% 0.01 255)` | `oklch(91% 0.005 255)` | `#1c2024`, `#dfe1e5` | text |
| `--ink-2` | `oklch(47% 0.012 255)` | `oklch(72% 0.01 255)` | `#565b62`, `#a0a5ab` | secondary text, labels |
| `--rule` | `oklch(88% 0.006 250)` | `oklch(33% 0.01 255)` | `#d5d8db`, `#32363b` | hairlines |
| `--rule-strong` | `oklch(62% 0.01 255)` | `oklch(54% 0.012 255)` | `#82878c`, `#6a6f76` | outlines, controls |
| `--signal` | `oklch(46% 0.09 175)` | `oklch(78% 0.08 172)` | `#006855`, `#80c8b1` | the accent: links, focus, current step, highlighted path |
| `--signal-soft` | `--signal` at 14% | same | | selection, marked row, `:target` |
| `--on-signal` | `oklch(98.5% 0.003 250)` | `oklch(21% 0.008 255)` | `#f9fafc`, `#16191c` | text and glyphs on a filled chip or button |
| `--threat` | `oklch(50% 0.12 35)` | `oklch(79% 0.09 45)` | `#9b4630`, `#eca88a` | warnings, attack toggles, MUST |
| `--boundary` | `oklch(48% 0.06 230)` | `oklch(76% 0.05 230)` | `#376479`, `#91b8cb` | MAY, the EU body, trust boundary dashes |
| `--ok` | `oklch(48% 0.07 155)` | `oklch(78% 0.06 155)` | `#3b694c`, `#9ac3a7` | supported, passing |
| `--caution` | `oklch(50% 0.1 70)` | `oklch(80% 0.08 80)` | `#875814`, `#d9b982` | partial, SHOULD, misconfiguration toggles |

The sRGB column is for places that cannot read a token, such as the `theme-color` meta tags in
`src/layouts/Base.astro`. `pnpm check:contrast --hex` prints it.

### Status, levels and toggles

| Status | Token | Ink | Glyph | Recorded vs derived |
| --- | --- | --- | --- | --- |
| supported | `--status-supported` | `--ok` | filled square, check | filled |
| partial | `--status-partial` | `--caution` | filled square, half disc | filled |
| unsupported | `--status-unsupported` | `--threat` | filled square, cross | filled |
| unknown (recorded) | `--status-unknown` | `--ink-2` | dashed ring | outline only |
| unknown (derived) | `--status-unknown` | `--ink-2` at 45% | small dot | faint |
| not applicable | `--status-not-applicable` | `--rule-strong` | dash | faint |

A filled chip draws its glyph in `--status-on`, which is `--on-signal`. `unknown` is never
styled as a failure. `StatusCell` draws each form on one element from its background and border;
the three observed statuses add a one-path SVG for the check, half disc or cross. No mask,
pseudo-element or transform: the matrix renders about nine hundred of them, and each of those
showed up in its blocking time.

Requirement levels: `--level-must` is `--threat`, `--level-should` `--caution`, `--level-may`
`--boundary`, `--level-deprecated` `--ink-2` (with strikethrough). Explorer toggle kinds:
`--toggle-attack` is `--threat`, `--toggle-misconfiguration` `--caution`.

### Legacy and removed names

Until WP10 of the redesign, `tokens.css` keeps an alias block so that components not yet
migrated keep rendering. New code uses the names above.

| Legacy name | Resolves to |
| --- | --- |
| `--bg`, `--bg-glass` | `--ground` |
| `--bg-elevated` | `--ground-2` |
| `--bg-sunken` | `--code-bg` |
| `--ink-muted`, `--ink-faint` | `--ink-2` |
| `--line`, `--line-soft` | `--rule` |
| `--line-strong` | `--rule-strong` |
| `--accent`, `--focus` | `--signal` |
| `--accent-strong` | `--signal` mixed 20% towards `--ink` |
| `--accent-ink` | `--on-signal` |
| `--accent-2` | `--threat` |
| `--accent-soft` | `--signal-soft` |
| `--accent-2-soft` | `--threat` at 12% |
| `--status-*-soft` | the status ink at 12% (`unknown` 10%, `not-applicable` transparent) |
| `--accent-glow` | `transparent` |
| `--shadow-sm`, `--shadow`, `--shadow-lg`, `--inset-highlight` | an invisible shadow (`0 0 0 0 transparent`), so lists of shadows stay valid |
| `--font-display` | `--font-body` (Geist) |
| `--text-2xs`, `--text-xs` | `--tiny` |
| `--text-sm` | `--small` |
| `--text-xl`, `--text-2xl` | `--h2`, `--h1` |
| `--radius-lg`, `--radius-xl` | `--radius-plate` |
| `--ease-out` | `--ease` |

## 2. Contrast

Computed by `pnpm check:contrast` from the OKLCH values in `tokens.css` (OKLCH to linear sRGB,
clipped to the gamut, then WCAG 2.2 relative luminance). The check runs inside `pnpm check` and
fails when a pair is under its minimum: 4.5:1 for text, 3:1 for glyphs on a fill and for control
outlines (WCAG 1.4.11). A row marked as a tint measures the text against the ground with a
translucent wash of the text colour over it, composited in sRGB as the browser paints it. `pnpm check:contrast --markdown` prints this table.

| Foreground | Background | Use | Minimum | Light | Dark |
| --- | --- | --- | --- | --- | --- |
| `--ink` | `--ground` | text | 4.5:1 | 15.75 | 13.56 |
| `--ink-2` | `--ground` | text | 4.5:1 | 6.53 | 7.15 |
| `--signal` | `--ground` | text | 4.5:1 | 6.47 | 9.16 |
| `--threat` | `--ground` | text | 4.5:1 | 6.08 | 8.91 |
| `--boundary` | `--ground` | text | 4.5:1 | 6.16 | 8.35 |
| `--ok` | `--ground` | text | 4.5:1 | 6.05 | 9.07 |
| `--caution` | `--ground` | text | 4.5:1 | 5.88 | 9.43 |
| `--ink` | `--ground-2` | text | 4.5:1 | 14.43 | 12.24 |
| `--ink-2` | `--ground-2` | text | 4.5:1 | 5.98 | 6.45 |
| `--signal` | `--ground-2` | text | 4.5:1 | 5.93 | 8.27 |
| `--threat` | `--ground-2` | text | 4.5:1 | 5.57 | 8.05 |
| `--boundary` | `--ground-2` | text | 4.5:1 | 5.65 | 7.54 |
| `--ok` | `--ground-2` | text | 4.5:1 | 5.54 | 8.19 |
| `--caution` | `--ground-2` | text | 4.5:1 | 5.38 | 8.51 |
| `--ink` | `--ground-3` | inline code | 4.5:1 | 12.79 | 10.62 |
| `--ink` | `--code-bg` | code blocks, token views | 4.5:1 | 15.17 | 14.27 |
| `--ink-2` | `--code-bg` | labels in token views | 4.5:1 | 6.29 | 7.52 |
| `--on-signal` | `--signal` | button text on a signal fill | 4.5:1 | 6.47 | 9.16 |
| `--on-signal` | `--ok` | glyph on a supported chip | 3:1 | 6.05 | 9.07 |
| `--on-signal` | `--caution` | glyph on a partial chip | 3:1 | 5.88 | 9.43 |
| `--on-signal` | `--threat` | glyph on an unsupported chip | 3:1 | 6.08 | 8.91 |
| `--threat` | `--ground-2` | level tag, 8% tint of itself | 4.5:1 | 4.98 | 6.90 |
| `--caution` | `--ground-2` | level tag, 8% tint of itself | 4.5:1 | 4.83 | 7.24 |
| `--boundary` | `--ground-2` | level tag, 8% tint of itself | 4.5:1 | 5.07 | 6.48 |
| `--ink-2` | `--ground-2` | level tag, 8% tint of itself | 4.5:1 | 5.37 | 5.63 |
| `--rule-strong` | `--ground` | control outlines, not-applicable dash | 3:1 | 3.49 | 3.50 |
| `--rule-strong` | `--ground-2` | control outlines on a panel | 3:1 | 3.19 | 3.16 |

Two values differ from the plan, each moved by the smallest step that clears its gate:

- Dark `--rule-strong` is `oklch(54% 0.012 255)` instead of `oklch(52% 0.012 255)`. At 52% it
  reached 2.91:1 on `--ground-2`, under the 3:1 that a control outline on a panel needs.
- Light `--caution` is `oklch(50% 0.1 70)` instead of `oklch(52% 0.1 70)`. At 52% it passed on
  the plain grounds (4.94:1 on `--ground-2`) but reached 4.46:1 in a SHOULD level tag, which
  paints an 8% tint of itself behind 13px text (axe flagged it on the matrix, feature, server and
  scan pages).

Every other pair in the plan passed as written.

## 3. Type

Geist (variable, Latin subset) sets headlines, interface and body. Geist Mono sets identifiers,
dates in tables, code, token views and the transcript. Both are self-hosted through
`@fontsource-variable` and preloaded; together they are under the 60 kB preload budget.

`Geist Fallback` (`src/styles/fonts.css`) is local Arial with `size-adjust: 104.71%`,
`ascent-override: 95.98%` and `descent-override: 28.17%` (Geist 1.7.2 metrics). It follows Geist
in `--font-body`, so the swap does not move text.

| Token | Value | Use |
| --- | --- | --- |
| `--text-body` | `clamp(1.0625rem, 1.02rem + 0.15vw, 1.125rem)` | body text |
| `--leading-body` | 1.7 | body line height |
| `--measure` | 66ch | prose width |
| `--small` | 0.875rem | labels, eyebrows, table heads |
| `--tiny` | 0.8125rem | the floor: no text is smaller than 13px |
| `--h1-home` | `clamp(2.25rem, 1.6rem + 2.6vw, 3.75rem)` | the home statement |
| `--h1` | `clamp(2rem, 1.5rem + 2vw, 3.1rem)` | data page headings |
| `--h2` | `clamp(1.4rem, 1.25rem + 0.6vw, 1.7rem)` | section headings |
| `--h3` | 1.2rem | sub-sections |
| `--lede` | `clamp(1.125rem, 1.08rem + 0.25vw, 1.25rem)` | the lede under a page heading |
| `--tracking-tight`, `--tracking-snug` | -0.03em, -0.015em | headings |

Headings are weight 600 with `text-wrap: balance`. Labels are sentence case Geist at `--small`
or `--tiny` in `--ink-2`, with tabular figures where numbers align. Links in prose are `--signal`
with a 1px underline at 45% that turns solid on hover.

## 4. Space and shape

The spacing scale has a 4px base, `--space-1` (0.25rem) to `--space-9` (7rem). `--gutter` is
`clamp(1.25rem, 4vw, 3rem)` and `--page-max` 78rem.

| Token | Value | Use |
| --- | --- | --- |
| `--radius` | 10px | controls and panels |
| `--radius-plate` | 14px | the frame of a data view |
| `--radius-pill` | 999px | chips |
| `--radius-focus` | 4px | the focus ring |

Rules are 1px `--rule`; accent rails (findings, notices, the current step) are 2px. There are no
shadows: elevation is `--ground-2` and a rule. Focus is a 2px solid `--signal` outline, offset
3px.

### Shared surfaces

`src/styles/global.css` declares the cascade layers
`reset, tokens, base, layout, components, product, utilities, print` (`tokens.css` is imported
into `tokens`). Astro's scoped component and page styles are unlayered, so they win over every
layer without extra specificity; a layout that styles slotted content puts those rules in
`layout`. The shared surfaces, all in `components` unless noted:

| Class | What it is |
| --- | --- |
| `.eyebrow`, `.lede`, `.facts`, `.page-head`, `.page-foot`, `.crumbs` (`layout`) | the page skeleton |
| `.panel` | `--ground-2`, 10px radius, no border: a block of a different kind (an aside, an address) |
| `.rows` (`.rows__head`, `.rows__title`, `.rows__meta`, `.rows.numbered`) | a list as hairline rows, title left, meta right |
| `.plate` | the frame of a data view: 1px `--rule`, 14px radius, `--ground-2` |
| `.explainer` | dashed `--rule-strong` outline: the part the reader operates |
| `.button`, `.button.quiet`, `.button.small` | one filled action per view; every other one quiet |
| `.chip`, `.chip.signal`, `.chip.threat` | a short label in a pill outline |
| `.level`, `.level-MUST` and the others | mono level text; outlined only inside a table |
| `.kv`, `.steps`, `.callout`, `.notice`, `.notice.caution`, `.field` | key/value grid, numbered rows, outlined remark, warning rail, form control |
| `.transcript`, `.timeline` | the scanner's request ladder, dated entries on a rail |

Deprecated until WP10: `.card` and `.cards` (now flat `--ground-2` panels; move to `.panel` or
`.rows`), `.pill` and `.pill.accent` (aliases of `.chip` and `.chip.signal`) and
`.button.primary` (a plain `.button` is the filled one).

The page head of `/explorer/`, `/breaches/` and every spec page carries a decorative drawing
(`Plate.astro`, WP8): a small delegation chain drawn from the page id and title by
`src/lib/plate.ts`, so a page always gets the same one. It is the first child of
`header.page-head`, floats beside the title from 64rem up and is left out below that. It has no
frame and uses the existing inks only: `--signal` for the path, `--boundary` for the trust
boundary dash, hairlines for the rest. It never goes on a page with a data view above the fold.

The header scrolls away with the page, so `--header-h` (what sticky content must clear) is 0.

Product surfaces go in `product`. The matrix (`MatrixTable`, `StatusCell`, `ClassIcon`)
keeps its styles there through `<style is:global>` instead of scoped styles, because a scoped
style puts an attribute on each of the table's thousands of elements. Their class names are
prefixed (`.matrix`, `.status-cell`, `.status-label`, `.class-icon`) so they cannot meet another
component's.

## 5. Motion

| Token | Value | Use |
| --- | --- | --- |
| `--ease` | `cubic-bezier(0.2, 0.7, 0.2, 1)` | interface |
| `--ease-draw` | `cubic-bezier(0.5, 0, 0.2, 1)` | paths drawing in |
| `--dur-fast` | 120ms | hover and focus colour |
| `--dur` | 220ms | dialogs, view transitions, step changes |
| `--dur-slow` | 480ms | rails fading, timelines |
| `--dur-draw` | 1200ms | a path drawing in |
| `--dur-message` | 300ms | an explorer message drawing in |
| `--stagger` | 40ms | the gap between rails that light up one after another |
| `--dur-step` | 2500ms | one step of the explorer scene (not zeroed: under reduced motion the scene never plays) |

Under `prefers-reduced-motion: reduce` every duration is 0ms, the cross-document view transition
is off, and every keyframe animation sits inside `@media (prefers-reduced-motion: no-preference)`
so it never runs. Islands ask `reducedMotion()` from `src/lib/motion.ts` and skip timers, smooth
scrolling and autoplay when it is true, and read durations from these tokens through
`durationToken()` rather than keeping their own.

### Motion catalogue

Every animation on the site, where it lives, what it means, its reduced-motion form, and the
package of the redesign that builds it. Anything not in this table does not animate.

| # | Where | What | Means | Reduced motion | WP |
| --- | --- | --- | --- | --- | --- |
| M1 | Every page | Cross-document view transition, root crossfade 220ms | continuity | none (as today) | WP2 |
| M2 | Home → `/mcp/`, `/standards/` → spec, `/explorer/` → scenario | Shared `view-transition-name` on the data view (matrix plate from `MatrixThumb.astro` as `matrix`, map; on the explorer, the scenario title into the page h1) so it morphs instead of crossfading | "this is the same object, larger" | none | WP3, WP5, WP6 |
| M3 | Home facts, server page facts, spec page facts (`Facts.astro`) | Count-up from 0 to the value, 600ms, once, when 50% in view, tabular figures | "these are live numbers" | value rendered at once | WP3 |
| M4 | Decorative plate | Highlighted path draws in (`stroke-dashoffset`), 1200ms, halo fades after, once on load. The standards map dropped it in R-12: its spine is two or three short edges, so the draw read as a glitch, not a path; the spine is drawn complete at full strength | "follow this path" | path shown complete | WP8 |
| M5 | Explorer chain | Per step: the sender and receiver light up in the actor head, the current arrow draws in (300ms, ease-out), the body fades up 8px (220ms); earlier steps keep a quieter arrow and later ones a hairline, in colour, not opacity, so text keeps its contrast | "you are here" | arrow and body shown, highlight and dimming applied without transition | WP6, R-08 |
| M6 | Explorer chain | One scene clock (a Web Animations API timeline) holds the playhead; Play, Pause, Previous, Next, the scrub bar, a click on a step or a log line and the arrow keys all move it. Steps advance every 2.5 s. Auto-advance (amended by review follow-up 8): armed once per page, it starts when the chain has sat in view for 1 s with no input, and stops for good on hover, touch, focus, scroll or any key; it never restarts by itself and never starts with a step in the URL. Play, once pressed, pauses on any click, key or scroll | guided reading | Play button hidden, no auto-advance; the scrub bar and the step buttons still seek | WP6, R-08 |
| M7 | Explorer token view | On step change, claims that differ from the previous hop get a 2px `--signal` rail that fades to `--rule` over 480ms, starting when the message has drawn (300ms) and 40ms apart | "this is what changed in the token" | rail shown without fade | WP6, R-08 |
| M8 | Explorer toggle pages | Changed and removed steps get their rail in the toggle's ink on page load, from transparent over 480ms (one pass, staggered 40ms per step, max 400ms total) | "the toggle touched these" | shown at once | WP6 |
| M9 | Matrix | Row and column crosshair on hover/focus of a cell (`--signal-soft` background, 120ms) | orientation in a large grid | instant | WP4 |
| M10 | Matrix | Removed: a cell links to its row on the server page instead of opening a dialog (the inline records were most of the page's weight) | n/a | n/a | WP4 |
| M11 | Matrix filters | Count text changes with no animation; hidden rows collapse instantly (today's behaviour) | n/a | n/a | WP4 |
| M12 | Scanner report | The request ladder prints line by line, 60ms apart, when the section scrolls into view, once; the count of checks appears last | "this is what the scanner did, in order" | all lines shown | WP7 |
| M13 | Breach page, spec page revisions | Timeline rail draws in top to bottom, 480ms; on the breach page the dates fade in behind it | "events in sequence" | shown | WP6 |
| M14 | Long-form pages (`Document.astro`) | Reading progress bar, 2px `--signal`, `animation-timeline: scroll(root)` behind `@supports` | place in the text | hidden | WP2 |
| M15 | Controls | Colour and border transitions on hover/focus, 120ms | affordance | instant | WP2 |
| M16 | Theme toggle | Icon swap only; no rotation | n/a | n/a | WP2 |
| M17 | Explorer toggles | A toggle link swaps the chain in place (crumbs, toggles, notice, steps) through a same-document view transition, 220ms; steps the two chains share morph, the rest fade, and M8 runs on the new rails. The toggle stays its own static page for a reload, a new tab or no JS | "the same chain, with one thing changed" | ordinary navigation | R-08 |
| M18 | Explorer chain | A quiet decision log under the chain gains one line per step reached (number, sender → receiver, message), the newest fading in over 220ms; a line seeks back to its step | "what has happened so far" | lines appear | R-08 |
| M19 | Standards map | Hovering or focusing a node fades the documents and lines outside its neighbourhood to 22% over 220ms, and its own lines to full colour. The highlight holds for 280ms while the pointer crosses the gap to the next node, so moving across the map changes the highlight once per node instead of flashing back to full strength in every gap | "these are its relations" | applied and lifted at once | R-12 |

Removed from the site by the redesign: the pulsing dot in the work-in-progress banner (it loops),
the hover lifts on cards, buttons and the hero thumbnail, the rotating theme toggle, the ambient
dot grid and accent glow, the gradient on the primary button and the hero accent word.

A later addition must fit one row of this table (place, meaning, reduced-motion form), run once
per page load or per user action, animate only `transform`, `opacity`, `stroke-dashoffset`,
`background-color`, `border-color` or `color`, and fit the byte budgets.
