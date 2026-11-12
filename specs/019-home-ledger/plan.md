# Plan: One matrix, one ledger

- `src/lib/changes.ts`: `statusChanges()` (consecutive observations of one cell whose status
  differs, newest first; at one moment the weaker method first, as `currentCell` lets the stronger
  win), `changesByDay()`, `scanRunsAfter()`, `changedSince()`. Unit tests in
  `tests/unit/changes.test.ts`.
- `src/components/Ledger.astro`: the one rendering of status changes (day rule, line, evidence in
  the margin, fold). Used by `/`, `/ledger/`, the server page and the requirement page.
- `src/components/MatrixThumb.astro`: the matrix in small, servers down and requirements across,
  one path per status in the status colours, with a lit row, column or set of cells.
- `src/components/MatrixPage.astro`: a `home` flag (title and eyebrow of the home page), a
  `changed` set passed to `MatrixTable` (the corner dot), and two slots (`aside` in the head,
  `after` above the foot). `src/pages/index.astro` fills them; `src/pages/mcp/index.astro` is gone.
- The matrix head ends on one revision line (the specification, the revision, earlier ones,
  what changed). Right above the table, `.matrix-bar` holds a page's note about the matrix
  (`slot="bar"`; the home page: the cells that changed last, with the ledger link) and the
  folded filters, so both sit where they are used.
- `src/layouts/Base.astro`: nav of Matrix, Ledger, Standards, Chains, Contribute; the record
  line. Its time carries `data-record`, which `tests/e2e/screenshot.css` hides in screenshots so
  a scan run does not need new baselines.
- `src/styles/global.css`: `.page-head` as an 8/3 grid with `.page-head__aside`, `.section-head`,
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
