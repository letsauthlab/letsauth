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
| `pnpm investigate --help` | Local checks with interactive OAuth login, private evidence reports and reviewed observations. See [`investigations.md`](investigations.md). |
| `pnpm check:append-only [ref]` | Fails if an existing observation entry was edited or removed, compared with `origin/main` or the ref given. |
| `pnpm lint` / `pnpm lint:fix` | Biome: lint and format. |
| `pnpm typecheck` | `astro sync` and `tsc --noEmit`. |
| `pnpm test` | Unit tests (Vitest) over `src/lib` and `src/scanner`. |
| `pnpm test:e2e` | Playwright against `astro preview`; run `pnpm build` first. |
| `pnpm check` | validate:data, lint, typecheck, unit tests, build. Must pass before a push. |
| `pnpm scan <url>\|<server-id>\|--all [--write]` | The passive scanner; `--write` appends observations. See [`scanner.md`](scanner.md). |

## Tests

- **Unit tests** live in `tests/unit/` with fixtures in `tests/fixtures/`. They cover the matrix
  derivation, the standards graph, exports, citations, data validation and every scanner module
  (guard, urls, checks, grade, append rule, nightly job). The scanner tests never make a network
  request: fetch is stubbed with fixture responses.
- **End-to-end tests** live in `tests/e2e/` and run against the built site. They check that pages
  read without JavaScript, that the islands work with it, accessibility with axe, and
  screenshots per page in both themes and at phone width.
- **Lighthouse budgets** (`lighthouserc.json`) run in CI only: performance and accessibility at or
  above 95 on the listed pages, and no more than 150 kB of script per page. Run them locally with
  `pnpm build && pnpm exec lhci autorun --config=lighthouserc.json`.

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
changes with `data-nightly`, and the screenshot tests fix those values and mask the grades.

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

- `pnpm generate:brand` after changing the SVGs: the adaptive favicon (follows the system theme),
  the 180×180 Apple touch icon and the 1200×630 social card, the last two on an opaque light
  surface.
- `pnpm generate:readme` after changing the brand, the tokens or the data: the README's hero and
  how-it-works pictures under `docs/assets/readme/`, one light and one dark SVG each. GitHub
  renders a README image without the site's CSS, so the script resolves every token to a plain
  colour per scheme and draws the atlas thumbnail from the real matrix.

## Working with coding agents

The repository is built to be worked on by agents as much as by people (constitution VI).
[`CLAUDE.md`](../CLAUDE.md) is the entry point for Claude Code and points at the constitution,
the data model and these commands. Every check runs headless with one command and prints
actionable output, and the screenshot tests let an agent verify a visual change itself.
