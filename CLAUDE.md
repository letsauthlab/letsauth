# letsauth.eu — working notes for coding agents

Read first, in this order:

1. `.specify/memory/constitution.md` — the rules. Every PR must comply; plans justify deviations.
2. `docs/data-model.md` — the shared data model. `src/schema/` is its executable form.
3. `specs/<feature>/` — the Spec Kit artifacts for the feature you are working on
   (`spec.md`, `plan.md`, `tasks.md`). Mark tasks `[x]` in `tasks.md` as you complete them.

`docs/architecture.md` has the layout and data flow, `docs/development.md` the full command
reference, `CONTRIBUTING.md` the rules for data and code pull requests. `README.md` is the public
front page and advertises the lab; keep working notes out of it.

## Commands

- `pnpm install` — Node 22, pnpm 10.
- `pnpm dev` — dev server on http://localhost:4321.
- `pnpm validate:data` — schema and cross-reference checks over `data/`. Run after any data edit.
- `pnpm check` — validate:data, lint (Biome), typecheck, unit tests, build. Must pass before a push.
- `pnpm test:e2e` — Playwright against `astro preview` (run `pnpm build` first). Screenshot
  baselines live in `tests/e2e/__screenshots__` and must come from Playwright's pinned Chromium:
  `pnpm test:e2e --update-snapshots` with that build, or the `refresh-screenshots` label on the
  pull request (see `docs/atlas-maintenance.md`). Update them only for intended changes.
- `pnpm observe <server> <feature> <status> --by <handle> --evidence <url|note>` — appends one
  validated manual observation (`docs/atlas-maintenance.md`). Observations are never edited.
- `pnpm check:append-only` — fails if an existing observation entry was edited or removed.
- `pnpm scan <url>|<server-id>|--all [--write]` — the passive scanner (`docs/scanner.md`);
  `--write` appends observations.
- `pnpm investigate --help` — local manual investigations and human-operated active recipes
  (`docs/investigations.md`). OAuth tokens stay in memory; supplied tokens use environment variables. Observations require review.

## Conventions

- Data is YAML under `data/`, one entity per file; observations are append-only lists per server.
- Every feature cites a spec revision and section; the build fails on a dangling citation.
- `unknown` is a real status. Never render missing data as `unsupported`.
- Explorer scenarios live in `data/scenarios/`, one file each; every step and toggle cites a
  revision and section, and the diagram, the step list and the token views are all rendered from
  the one definition. A toggle is its own static page; one toggle at a time.
- `src/scanner/` is the only code that may contact a server, through `pnpm scan` (run
  by the scheduled job or a contributor) or contributor-only `pnpm investigate check` / `run`;
  the site build never imports anything that fetches. Investigation recipes never run nightly.
  There is no on-demand scanning for visitors. Seed data is `vendor-claim` or `manual`; scanner
  cells arrive by pull request.
- One token system: `src/styles/tokens.css`. Components use tokens, never literal colours.
  Colours are OKLCH pairs resolved with `light-dark()`; `data-theme` only flips `color-scheme`.
  Type is Bricolage Grotesque for headlines, Geist for text and interface, Geist Mono for ids
  and code. Shared surfaces (`.card`, `.button`, `.pill`, `.level`, `.kv`, `.field`, `.crumbs`,
  `.eyebrow`) live in `src/styles/global.css`; reuse them before adding page-local styles.
- One page skeleton: every page is a left-aligned `.wrap` column that opens with
  `header.page-head` (eyebrow, h1, `.lede`, optional `.page-head__meta` line, optional
  `dl.facts` row) and closes a data page with `footer.page-foot`. Pages below `/mcp/` and
  `/standards/` put `<Crumbs>` above the head; long-form text pages use
  `src/layouts/Document.astro` (numbered sections, a rail of them on wide screens, no
  breadcrumb). New pages take these before inventing a head of their own.
- Status glyphs come from `StatusCell`: observed statuses are filled chips, a recorded `unknown`
  is a dashed ring, a derived one (no observation) a faint dot. Keep that distinction.
- Islands only where interaction needs them. Pages must read fully without JavaScript.
- The site is an early preview. `src/layouts/Base.astro` shows a work-in-progress banner (`.wip`)
  above the header on every page; keep it until the owner says the site is out of preview, then
  remove it in its own PR. Nothing else depends on it.
