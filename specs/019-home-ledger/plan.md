# Plan: One matrix, one ledger

- `src/lib/changes.ts`: `statusChanges()` (consecutive observations of one cell whose status
  differs, newest first; at one moment the weaker method first, as `currentCell` lets the stronger
  win), `changesByDay()`, `scanRunsAfter()`, `changedSince()`. Unit tests in
  `tests/unit/changes.test.ts`.
- `src/components/Ledger.astro`: the one rendering of status changes (day rule, line, evidence in
  the margin, fold). Used by `/`, `/ledger/`, the server page and the requirement page.
- `src/components/MatrixField.astro`: every cell of the matrix, servers across and requirements
  down, in the status colours, with a slow wave of light; optionally a lit server (column),
  requirement (row) or set of cells, the rest faint, the lit line turned to where the band shows
  it. Replaces the earlier `MatrixThumb` (the matrix in small in a narrow head column), which read
  as squeezed into a corner.
- `src/components/PageBand.astro`: the head of a data page as a full-width band right under the
  header, the page's picture behind it on the right. The home page, the ledger, server and
  requirement pages draw `MatrixField`; standard pages and the chains index draw their `Plate`
  large (`field`). The band's head keeps one text width and drops its rule over the facts.
- `src/components/MatrixPage.astro`: a `home` flag (title and eyebrow of the home page), a
  `changed` set passed to `MatrixTable` (the corner dot), and two slots (`aside` in the head,
  `after` above the foot). `src/pages/index.astro` fills them; `src/pages/mcp/index.astro` is gone.
- `src/components/HomeHero.astro`: the home page's head is a `PageBand` right under
  the header, the title, two figures (servers, requirements) and two actions (the matrix, the ledger) plus
  the data link, over every cell of the current matrix drawn in the status colours with a slow
  wave of light crossing it column by column (still under reduced motion). The revisions move to
  a quiet line under the matrix key; the record line already links the specification.
- The matrix head ends on one revision line (the specification, the revision, earlier ones,
  what changed). Right above the table, `.matrix-bar` holds a page's note about the matrix
  (`slot="bar"`; the home page: the cells that changed last, with the ledger link) and the
  folded filters, so both sit where they are used.
- `src/layouts/Base.astro`: nav of Matrix, Ledger, Standards, Chains, Contribute; the record
  line. Its time carries `data-record`, which `tests/e2e/screenshot.css` hides in screenshots so
  a scan run does not need new baselines.
- `src/styles/global.css`: `.page-head` as an 8/3 grid, `.section-head`,
  `.section-more`, serif figures in `.facts`.
- Redirects in `astro.config.mjs`: `/mcp`, `/atlas/mcp` and `/breaches` to `/`.
- Type: `--font-serif` in `tokens.css`; h1 and h2 in `global.css`; local h2 overrides at `--h3` or
  smaller keep Geist. Newsreader is cut to one weight and Latin (21 kB) and committed under
  `src/assets/fonts/` with its OFL licence, so the build needs no new package.

## Deviations

- **Preloaded fonts budget 60 kB → 75 kB** (`scripts/check-budgets.ts`, `docs/development.md`).
  Geist and Geist Mono are 52 kB; the serif cut adds 21 kB. Not preloading the serif would let
  the h1 swap after first paint and move the page. The owner approved the serif knowing it costs
  a font request.
- **016 plan 3.3** said Geist for headlines. Amended with a note pointing here.
- **The mockup drew requirements as rows.** The build keeps servers as rows (see the spec's
  alternatives).
- **Roadmap 005 (breach anatomy)** leaves the site by the owner's decision; `data/vulnerabilities`,
  `src/lib/breaches.ts` and their tests stay so the work is not lost.
