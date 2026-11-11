# Plan: Home as a ledger

- `src/lib/changes.ts`: `statusChanges()` (consecutive observations of one cell whose status
  differs, newest first; at one moment the weaker method first, as `currentCell` lets the stronger
  win), `changesByDay()`, `scanRunsAfter()`, `missingMostOften()`, `changedSince()`. Unit tests in
  `tests/unit/changes.test.ts`.
- `src/components/MatrixThumb.astro`: one-ink print, wide band (30 px across, 16 px down per cell),
  rings from a `ringed` set, a faint second pass of the ink for the print feel (a `drop-shadow`),
  M20's ring keyframes. Only the home page uses it.
- `src/pages/index.astro`: page head with dateline and mono facts, the print, the ledger and the
  ranking side by side on wide screens, the lab's index in five columns. No `.card`, no `.plate`.
- Type: `--font-serif` in `tokens.css`; h1 and h2 in `global.css`; local h2 overrides at `--h3` or
  smaller keep Geist. Newsreader is cut to one weight and Latin (21 kB) and committed under
  `src/assets/fonts/` with its OFL licence, so the build needs no new package.
- Motion: `--dur-sweep` (900 ms) and `--dur-ring` (1200 ms), zeroed under reduced motion; rows M20
  and M21 in `docs/design.md` and the accessibility statement.

## Deviations

- **Preloaded fonts budget 60 kB → 75 kB** (`scripts/check-budgets.ts`, `docs/development.md`).
  Geist and Geist Mono are 52 kB; the serif cut adds 21 kB. Not preloading the serif would let
  the h1 swap after first paint and move the page. The owner approved the serif knowing it costs
  a font request.
- **016 plan 3.3** said Geist for headlines. Amended with a note pointing here.

## Out of scope: the other pages

The other pages keep their current heads, panels and stat rows in this change. A follow-up
carries the home page's language to them in four moves, each its own pull request: facts as one
mono line and rules instead of grey panels (mostly `global.css`); the server page's own print strip
and evidence stacks; rings and a dateline on `/mcp/` with run ledgers on the feature and scanner
pages, all from `src/lib/changes.ts`; one-ink head prints for standards, explorer and breaches.
