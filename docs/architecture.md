# Architecture

letsauth.eu is a static site rendered from one dataset, plus one scheduled job that feeds that
dataset. This page describes the pieces and how data moves between them. The rules behind the
design are in the [constitution](../.specify/memory/constitution.md); the model is in
[`data-model.md`](data-model.md).

## One model, many views

Every product on the site is a view on the same entities:

| Entity | Files | What it is |
|---|---|---|
| Spec and revision | `data/specs/<id>.yaml` | A specification, draft or EU act with its publisher, maturity and dated revisions. Exactly one revision is `current`. |
| Feature | `data/features/<id>.yaml` | One requirement of the MCP Authorization spec, with the level (MUST, SHOULD, MAY) it has in each revision that defines it and the section it comes from. |
| Server | `data/servers/<id>.yaml` | A public MCP server: URL, transport, why it is listed, what its vendor claims. |
| Observation | `data/observations/<server>.yaml` | A dated statement that a server has a status for a feature under a revision, with a method (`manual`, `vendor-claim`, `passive-scan`, `active-scan`) and evidence. Append-only. |
| Relation | `data/relations.yaml` | One edge between two specs: `builds-on`, `profiles`, `references`, `replaces`, `competes-with`, `solves-same-problem-as`. |
| Scenario | `data/scenarios/<id>.yaml` | An explorer chain: actors, cited steps with the token each carries, and toggles that replace steps to show an attack or misconfiguration. |
| Vulnerability | `data/vulnerabilities/<id>.yaml` | A published vulnerability or incident, written from its advisory: class, summary, dates, the features whose absence caused it and the toggle that replays it. |

`src/schema/` is the executable form of the model (Zod). `src/lib/data.ts` loads every file,
validates it and cross-checks references; `scripts/validate-data.ts` runs the same checks from
the command line and in CI. A product that needs a field the model lacks amends the model first.

## Data flow

```
 specifications ─┐                                    ┌─▶ /mcp         matrix, server, feature, revision and scan pages
 vendor docs ────┼─▶ pull request ─▶ data/ (YAML) ─▶ build ─┼─▶ /standards   the standards map
 nightly scanner ┘        ▲                           ├─▶ /explorer    delegation chains, toggles, tokens
                          │                           ├─▶ /breaches    one anatomy per vulnerability, linked to its replay
                          │                           └─▶ *.json       exports under CC BY 4.0
                   review: CI green,
                   evidence opened
```

- **In.** Specifications are entered from the publisher's page. Observations come from reading
  vendor documentation by hand (`vendor-claim`, `manual`) or from the scanner (`passive-scan`).
  Both arrive as pull requests; nothing writes to `data/` directly.
- **Build.** `astro build` pre-renders every page from the dataset. The build contacts no server:
  nothing under `src/` except `src/scanner/` may fetch, and the site never imports that code.
  Citations are resolved at build time and a dangling one fails the build.
- **Out.** HTML pages, one JSON export per atlas and one per scanner report, a sitemap, and a
  Pagefind index for search. Everything is static files.

## Pages

One top-level segment per product; a product's pages all live under it. Nothing sits at a path
that has no page of its own.

```
/                               home
/mcp/                           MCP auth atlas: the matrix for the current revision
/mcp/servers/<id>/              one server; <id>.json is its export
/mcp/servers/<id>/scan/         the scanner's report for that server; scan.json is its export
/mcp/features/<id>/             one requirement
/mcp/revisions/<id>/            the matrix as of an older revision (the current one redirects to /mcp/)
/mcp/changes/<from>/<to>/       what changed between two revisions
/mcp/scanner/                   what the scanner reads, how it grades, and every report
/mcp/data.json                  the atlas export
/standards/                     Agent auth atlas: the standards map
/standards/<id>/                one specification
/standards/data.json
/explorer/                      Delegation chain explorer
/explorer/<scenario>/           one scenario; /<toggle>/ below it is one toggle switched on
/explorer/data.json
/breaches/                      Breach anatomy (roadmap 005), one breach per /<id>/
/contribute/                    how to add or correct data
/about/  /made-in-europe/       the lab
/imprint/  /privacy/  /disclaimer/  /accessibility/   legal
```

Pages at the top of the tree are named by the header or the footer and carry no breadcrumb. Every
page below them renders one with `Crumbs` (`src/components/Crumbs.astro`): the ancestors as links,
from the product root down, then the page itself. A product's subtree lights up its entry in the
header on every page under it.

Old addresses (`/atlas/mcp/…`, `/atlas/standards/…`, `/scanner/…`) are listed in `redirects` in
`astro.config.mjs`; the build writes a forwarding page for each. [`deploy.md`](deploy.md) has the
edge rules for the moved JSON exports, which a forwarding page cannot serve.

## Repository layout

```
data/            the dataset: specs, features, servers, observations, relations, scenarios, vulnerabilities (YAML)
docs/            this documentation, the roadmap and the research notes
public/          static assets copied as is: brand SVGs, favicon, social card, robots.txt
scripts/         command-line entry points: validate-data, scan, scan-nightly, append-only check,
                 and the generators for brand and README assets
specs/           Spec Kit artifacts per feature: spec, plan, tasks, contracts
src/
  components/    Astro components and the Svelte islands (matrix, standards map, explorer, scan report)
  layouts/       Base (header, footer, theme) and Document (long-form pages); the shared
                 page head and foot every page uses are in styles/global.css
  lib/           pure functions over the dataset: atlas matrix, standards graph, chains, exports, citations
  pages/         routes; file-system routing, every page pre-rendered
  scanner/       the passive scanner: url guard, fetch, checks, grade, observations, nightly job
  schema/        Zod schemas, the contract for data/
  styles/        tokens.css (the one token system), global.css (shared surfaces), fonts.css
tests/
  unit/          Vitest over src/lib and src/scanner, with fixtures
  e2e/           Playwright against the built site, with screenshot baselines
.specify/        the constitution and the Spec Kit templates and scripts
.github/         CI, deploy, scanner deploy and screenshot workflows; issue and PR templates
```

## The site

- **Astro 7** with strict TypeScript. Content is data-driven: the pages under `src/pages/atlas/`,
  `src/pages/explorer/` and `src/pages/scanner/` are generated from the dataset at build time.
- **Svelte 5** islands only where interaction needs them: the matrix filters, the standards map
  and the scan report. Every page reads fully without JavaScript, and no page ships more than
  150 kB of compressed JavaScript.
- **One design token system** in `src/styles/tokens.css`. Colours are OKLCH pairs resolved with
  `light-dark()`; `data-theme` only flips `color-scheme`. Type is Bricolage Grotesque for
  headlines, Geist for text, Geist Mono for ids and code, all self-hosted.
- **Status glyphs** are one component, `StatusCell`: observed statuses are filled chips, a recorded
  `unknown` is a dashed ring, a derived status (no observation) a faint dot. The distinction is
  the honesty of the atlas and is kept everywhere.
- **Budgets** are enforced in CI with Lighthouse: performance and accessibility at or above 95 on
  the atlas, the standards map, the explorer and the scanner pages. WCAG 2.2 AA, both themes,
  reduced motion, phone width without horizontal scroll.
- **Search** is Pagefind, built from the rendered pages.

## The scanner

The scanner is the one backend and the only code that contacts third-party servers. It reads
public OAuth metadata (the protected-resource and authorization-server well-known documents and
the `WWW-Authenticate` challenge), never a token, a body or an authorization flow, and judges each
passively observable requirement of the current MCP Authorization revision. It runs in exactly
one place: a Scaleway Serverless Job in an EU region, every night, from the image `Dockerfile`
builds. A run writes observations and opens one pull request; nothing on the site triggers a
scan. [`scanner.md`](scanner.md) has the request list, the grade and the job.

## Hosting and delivery

- The site is uploaded to a Bunny Storage Zone in the EU and served by a Bunny CDN pull zone.
  `.github/workflows/deploy.yml` runs after CI has passed on `main`, never on a red commit.
  [`deploy.md`](deploy.md) has the setup.
- The scanner image goes to Scaleway's container registry through
  `.github/workflows/scanner-deploy.yml`, also only after a green CI run.
- Analytics is Plausible (EU), emitted only when `PUBLIC_PLAUSIBLE_DOMAIN` is set. No cookies
  that require consent and no third-party script: `src/lib/analytics.ts` posts to `/r/e.json`
  on letsauth.eu, which a Bunny edge rule forwards to plausible.io. A prerendered page counts
  only once it is shown. [`deploy.md`](deploy.md) has the proxy setup.

## Workflow

Work follows [Spec Kit](https://github.com/github/spec-kit): constitution, then a feature spec,
a plan with a constitution check, tasks, implementation. One feature per product under `specs/`.
The [roadmap](roadmap.md) orders the features and records their status. Releases are continuous:
every merge to `main` deploys.
