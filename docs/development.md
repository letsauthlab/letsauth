# Development

How to run, check and test letsauth.eu locally. Conventions for contributions are in
[`CONTRIBUTING.md`](../CONTRIBUTING.md); the layout is in [`architecture.md`](architecture.md).

## Setup

Node 22 (`.nvmrc`) and pnpm 10 (`packageManager` in `package.json`, so `corepack enable` is
enough).

```sh
git clone https://github.com/letsauthlab/letsauth.git
cd letsauth
pnpm install
pnpm dev            # http://localhost:4321
```

The dev server renders every page from `data/` and reloads on changes to data, components and
styles. No environment variable is needed; analytics is off unless `PUBLIC_PLAUSIBLE_DOMAIN` is
set.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server with hot reload. |
| `pnpm build` | Validates the data, then builds the site into `dist/`. |
| `pnpm preview` | Serves `dist/` the way the CDN will. |
| `pnpm validate:data` | Schema and cross-reference checks over `data/`. Run after every data edit; prints `path[index].field: message`. |
| `pnpm observe <server> <feature> <status> --by <handle> --evidence <url or note>` | Appends one validated `manual` (or `--method vendor-claim`) observation to `data/observations/<server>.yaml`. See [`atlas-maintenance.md`](atlas-maintenance.md#record-an-observation). |
| `pnpm check:append-only [ref]` | Fails if an existing observation entry was edited or removed, compared with `origin/main` or the ref given. |
| `pnpm lint` / `pnpm lint:fix` | Biome: lint and format. |
| `pnpm typecheck` | `astro sync` and `tsc --noEmit`. |
| `pnpm test` | Unit tests (Vitest) over `src/lib` and `src/scanner`. |
| `pnpm test:e2e` | Playwright against `astro preview`; run `pnpm build` first. |
| `pnpm check:prose` | Lists copy in `src/pages`, `src/components`, `README.md` and `docs/*.md` that breaks the mechanical voice rules (banned words, em dash) and fails on any hit. |
| `pnpm check:budgets [dir]` | Byte budgets over `dist/` (gzip level 6): CSS, JavaScript, HTML, inline SVG and preloaded fonts per page, plus each island. Run `pnpm build` first. |
| `pnpm check:contrast [--markdown] [--hex]` | WCAG contrast of the colour pairs in `src/styles/tokens.css`, light and dark; fails under 4.5:1 for text and 3:1 for glyphs and outlines. `--markdown` prints the table in `docs/design.md`, `--hex` the sRGB value of each token. |
| `pnpm check` | validate:data, lint, check:prose, check:contrast, typecheck, unit tests, build, check:links, check:budgets. Must pass before a push. |
| `pnpm scan <url>\|<server-id>\|--all [--write]` | The passive scanner. The only command that contacts a third-party server; `--write` appends observations. See [`scanner.md`](scanner.md). |

## Tests

- **Unit tests** live in `tests/unit/` with fixtures in `tests/fixtures/`. They cover the matrix
  derivation, the standards graph, exports, citations, data validation and every scanner module
  (guard, urls, checks, summary, append rule, nightly job). The scanner tests never make a network
  request: fetch is stubbed with fixture responses.
- **End-to-end tests** live in `tests/e2e/` and run against the built site. They check that pages
  read without JavaScript, that the islands work with it, accessibility with axe, and
  screenshots per page in both themes and at phone width.
- **Lighthouse budgets** (`lighthouserc.json`) run in CI only: performance and accessibility at or
  above 95 on the listed pages, and no more than 150 kB of script per page. Run them locally with
  `pnpm build && pnpm exec lhci autorun --config=lighthouserc.json`.
- **Byte budgets** (`pnpm check:budgets`) print one row per page and the size of each island,
  then a summary. Two limits fail the run today: the constitution's 150 kB of compressed
  JavaScript per page, and 60 kB of preloaded fonts per page. The other targets of the redesign plan
  (`specs/016-visual-redesign/plan.md`, section 7) are listed as reported; each one has an
  `enforce` flag in `LIMITS` at the top of `scripts/check-budgets.ts`, and the package that meets
  a target flips it.
- **Prose lint** (`pnpm check:prose`) reports the voice rules a script can check, from section 8
  of the same plan. It prints `file:line: rule: text` and fails on any hit, so `pnpm check`
  fails too. A quotation of a source may use "ecosystem"; nothing else is exempt.
- **Contrast** (`pnpm check:contrast`) recomputes every colour pair in `docs/design.md` from the
  OKLCH values in `tokens.css` and fails when one is under its minimum.

## Screenshot baselines

Baselines live in `tests/e2e/__screenshots__` and are only valid for the Chromium build
Playwright pins, because another build rasterises fonts a few percent differently. After an
intended visual change, either

```sh
pnpm exec playwright install chromium
pnpm build && pnpm test:e2e --update-snapshots
```

or add the `refresh-screenshots` label to the pull request: the screenshots workflow regenerates
the baselines with CI's browser, commits them to the branch and removes the label. A push made by
that workflow does not start CI, so push any further commit (or merge the base branch) to get a
green run. Update baselines only for intended changes.

Scanner pull requests must not need new baselines: the scanner pages mark text the nightly run
changes with `data-nightly`, and the screenshot tests fix those values and mask the report links.

## Working on the scanner

`pnpm scan <server-id>` prints the report for one listed server without writing anything;
`--write` appends the observations to `data/observations/<server-id>.yaml`. The checks are in
`src/scanner/checks.ts`, the status table they implement in `specs/004-scanner/data-model.md`.
Whenever a check's logic or evidence text changes, bump `SCANNER_VERSION` in
`src/scanner/version.ts`: the next nightly run then re-observes every cell once.

The nightly job itself (`pnpm scan:nightly`) needs a GitHub token and is meant for the Scaleway
job, not a laptop. `Dockerfile` builds its image; [`scanner.md`](scanner.md) describes the job
and its deployment.

## Brand and README assets

`public/brand/` holds the supplied, outlined icon and horizontal wordmark in a light and a dark
palette. `src/components/BrandLogo.astro` picks the wordmark for the page theme, including a
stored override, without JavaScript; the header and footer share it.

Two scripts derive everything else from those SVGs, the design tokens and the data, with no
network request. Both need Playwright's Chromium (`pnpm exec playwright install chromium`):

- `pnpm generate:brand` after changing the SVGs, the tokens or the data: the adaptive favicon
  (follows the system theme), the 180×180 Apple touch icon and the 1200×630 social card, the
  last two on the light ground. The card is the home hero: wordmark, headline and the current
  matrix on a plate.
- `pnpm generate:readme` after changing the brand, the tokens or the data: the README's hero and
  how-it-works pictures under `docs/assets/readme/`, one light and one dark SVG each. GitHub
  renders a README image without the site's CSS, so the script resolves every token to a plain
  colour per scheme and draws the matrix thumbnail from the real data, with the marks of
  `MatrixThumb`.

## Working with coding agents

The repository is built to be worked on by agents as much as by people (constitution VI).
[`CLAUDE.md`](../CLAUDE.md) is the entry point for Claude Code and points at the constitution,
the data model and these commands. Every check runs headless with one command and prints
actionable output, and the screenshot tests let an agent verify a visual change itself.

`pnpm check:links` verifies local href targets in the generated `dist/` tree without network
requests. It runs after the build in `pnpm build` and `pnpm check`, catching missing revision,
server-index and asset routes. It checks file targets, not fragment identifiers.
