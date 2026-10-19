# Contributing to letsauth.eu

Thank you for helping measure agent authorization. This page says what a contribution looks like
and what a pull request needs. The rules it applies come from the
[constitution](.specify/memory/constitution.md); the model it edits is described in
[`docs/data-model.md`](docs/data-model.md).

## What you can contribute

| Contribution | Where it goes | Guide |
|---|---|---|
| An observation: what a server does for one requirement, with evidence | `data/observations/<server>.yaml` | [Record an observation](docs/atlas-maintenance.md#record-an-observation) |
| A new public MCP server | `data/servers/<id>.yaml` | [Seed or list a server](docs/atlas-maintenance.md#seed-or-list-a-server) |
| A specification, draft or EU act on the standards map | `data/specs/<id>.yaml` | [Add a specification or a relation](docs/atlas-maintenance.md#add-a-specification-or-a-relation-agent-auth-atlas) |
| A relation between two specifications | `data/relations.yaml` | same |
| A new revision of the MCP Authorization spec | `data/specs/mcp-authorization.yaml`, `data/features/` | [Add a specification revision](docs/atlas-maintenance.md#add-a-specification-revision) |
| A scanner check, a page, a fix | `src/`, `scripts/`, `tests/` | [Code](#code) below |

The site's own [contribution page](https://letsauth.eu/contribute/) explains the entry
format for observations with examples. No account on the site is needed; everything is a pull
request against `main`.

## Data

Four rules, all enforced by `pnpm validate:data` and CI:

1. **Evidence.** Every observation carries `evidence` a reviewer can open (a URL) or verify (a
   precise note). A note instead of a URL is acceptable only for `manual` observations and must
   say what was done.
2. **Append-only.** An existing observation is never edited or removed. A correction is a new
   entry with a newer `observedAt`; the newest wins and the history stays visible.
3. **Unknown is a value.** Use `unknown` to record that you looked and could not tell, and
   `not-applicable` when the feature cannot apply. Never write `unsupported` for "could not
   tell".
4. **Facts come from the publisher.** A spec's title, dates and URLs come from its publisher's
   own page. A relation of a judgement type (`competes-with`, `solves-same-problem-as`) carries a
   `note` and, where one exists, a `source`.

`observedBy` is your handle. Scanner observations (`observedBy: scanner@<version>`) come from
`pnpm scan` and are never edited by hand; prefer `pnpm scan <server-id> --write` over a
hand-written `passive-scan` entry, so the evidence is reproducible by anyone.

After editing, run `pnpm validate:data` and, to see the result, `pnpm dev`.

## Code

The site is Astro with strict TypeScript, Svelte 5 for the few interactive islands, Biome for
lint and format, Vitest for unit tests and Playwright for end-to-end and screenshot tests.
[`docs/development.md`](docs/development.md) has the setup and every command;
[`docs/architecture.md`](docs/architecture.md) has the layout and the data flow.

What every code change keeps true:

- Pages read fully without JavaScript. Islands only where interaction needs them, and the site
  ships no more than 150 kB of compressed JavaScript per page.
- One token system (`src/styles/tokens.css`). Components use tokens, never literal colours;
  both themes are checked.
- Every feature, cell and grade cites a spec revision and section; the build fails on a dangling
  citation.
- `src/scanner/` is the only code that contacts a server, through passive `pnpm scan` or local
  owner-controlled `pnpm investigate run` (see `docs/investigations.md`). The site build never
  imports anything that fetches, and active investigations never run in the nightly job.
- `pnpm check` passes before a push. It runs data validation, lint, typecheck, unit tests and
  the build.

Features are specified before they are built: one Spec Kit feature per product under
[`specs/`](specs/) (`spec.md`, `plan.md`, `tasks.md`), and every plan checks itself against the
constitution. A change that needs a new field in the model amends the model first, in its own
pull request.

## Pull requests

- One topic per pull request. Data and code changes are easiest to review apart.
- Fill in the [template](.github/pull_request_template.md): what changes, and the data or code
  checklist that applies.
- CI must be green: validation, the append-only check, lint, typecheck, unit tests, build,
  end-to-end tests and the Lighthouse budgets (performance and accessibility at or above 95).
- Screenshot baselines are updated only for intended visual changes, and only from Playwright's
  pinned Chromium: either locally or with the `refresh-screenshots` label on the pull request
  (see [Refresh screenshot baselines](docs/atlas-maintenance.md#refresh-screenshot-baselines)).

Reviewing a data pull request means opening every evidence URL; the steps are in
[Review a data pull request](docs/atlas-maintenance.md#review-a-data-pull-request).

## Questions and problems

- A wrong cell in the atlas: open a pull request with a new observation, or an issue using the
  observation template.
- A security problem in the site, the workflows or the scanner: follow [`SECURITY.md`](SECURITY.md)
  and do not open a public issue.
- Problems in the servers and products listed in the atlas belong to their vendors.

This is a one-person project with agent support, so please allow a few days for a review.
