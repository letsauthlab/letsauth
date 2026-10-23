<!--
Sync Impact Report
- Version change: template (unversioned) → 1.0.0 (initial ratification)
- Modified principles: none (all seven are new)
- Added sections: Honesty Tests; Technology Constraints; Development Workflow; Governance
- Removed sections: none (template placeholders [SECTION_2_NAME] and [SECTION_3_NAME] replaced by
  Honesty Tests, Technology Constraints and Development Workflow)
- Templates: .specify/templates/plan-template.md Constitution Check gate is generic and needs no change;
  spec-template.md and tasks-template.md unchanged
- Follow-up TODOs: none. Remove this comment when the amendment is merged.
-->
# letsauth.eu Constitution

letsauth.eu is an open, vendor-neutral lab where engineers and architects can see, test and break
how AI agents are authorized. It covers the overlap of agent platforms (MCP, A2A, agent-to-API
signup) with identity and access management (OAuth, OpenID Connect, token exchange, workload
identity), with a European lens.

It is a set of products on one shared model: a standards atlas, an MCP feature atlas, a delegation
chain explorer, a conformance scanner, breach anatomies, and a changelog newsletter. This
constitution is the meta plan. Each product has its own feature spec under `specs/`.

## Core Principles

### I. One Model, Many Views

All products read from and write to one shared data model (`docs/data-model.md`): specs,
revisions, features, relations, servers, observations, scenarios and vulnerabilities. A product
MUST NOT keep a private copy of any of these entities. A new product is a new view on the model,
not a new model. If a product needs a field the model lacks, the model is amended first, in its
own PR, and every product that renders the entity picks the field up.

### II. Every Claim Cites a Revision

Every feature, scenario step, scan result and matrix cell MUST link to the spec revision and section it
is derived from. A claim without a citation does not ship. When a spec revision changes, the
affected pages say so and keep rendering correctly against the revision they cite; nothing is
silently re-interpreted against a newer revision. Dates on observations are mandatory.

### III. Neutral and Passive by Default

The site does not rank vendors, products or servers by anything other than data in the model, and
the data says how it was obtained. Observations carry a method (manual, vendor-claim,
passive-scan, active-scan) and evidence. Scanning third-party systems is passive by default:
public metadata only, no credentials, no authorization flows. Active probes run only against
systems whose owner has proven control. Unknown is a valid, explicit value; the absence of data
is never rendered as a failure.

### IV. Static First, Open Data

The site is pre-rendered. Data lives in the repository as YAML, validated by the schema, and
changes through reviewed pull requests. A backend exists only for work that cannot be static (the
scanner), and its output flows back into the repository as data so that the static site remains
the single source of truth. The repository, the data and the scenarios are public.

### V. Craft and Budgets

Every page meets WCAG 2.2 AA, renders in light and dark, respects reduced motion, and works at
phone width with no horizontal scroll. One design token system (colour, type, spacing, motion) is
defined once and used everywhere; islands do not bring their own. Performance budgets are enforced
in CI: Lighthouse performance and accessibility at or above 95 on the home page, each atlas page
and the explorer; no page ships more than 150 kB of compressed JavaScript without a documented
exception. No third-party scripts other than privacy-preserving analytics.

### VI. Agent-Legible Repository

The repository is built to be worked on by coding agents as much as by people. TypeScript is
strict. One linter and formatter (Biome). Every check runs headless with one command and prints
actionable output. End-to-end tests include screenshot comparisons so an agent can verify a visual
change itself. The Zod schema is the readable contract for the data model. `CLAUDE.md` (and
equivalents for other agents) points at this constitution, the data model and the commands, and
contains nothing that contradicts them.

### VII. European by Default

Hosting, storage and analytics run in the EU. No personal data is collected beyond what
privacy-preserving analytics needs; no cookies that require consent. European regulation (eIDAS
2.0 and the EUDI wallet, the AI Act, NIS2) is first-class content, not a footnote, wherever it
touches agent delegation.

## Honesty Tests

Any new product, page or series MUST pass all three before it is specified:

1. **Not summarisable.** A language model cannot produce it by summarising the public web.
2. **Compounding.** Each addition makes the existing site more useful, not just longer.
3. **Maintainable by one person.** It can be kept correct by one maintainer with agent support.

## Technology Constraints

- **Site**: Astro, TypeScript (strict), Svelte 5 for interactive islands. Content collections for
  data-driven pages. Islands only where interaction requires them; everything else is HTML.
- **Data**: YAML under `data/`, validated at build time by Zod schemas under `packages/schema/`
  (or `src/schema/` until a package split is justified). The schema is the contract that the site,
  the explorer and the scanner import.
- **Explorer**: scenarios are declarative state machines; sequence diagrams are rendered from the
  machine definition so diagram and behaviour cannot drift.
- **Tooling**: pnpm, Node LTS, Biome, Vitest, Playwright (with screenshot comparison), Pagefind
  for search.
- **Hosting**: Bunny Storage (EU) behind a Bunny CDN pull zone; Bunny Edge Scripting for small
  dynamic behaviour (redirects, headers, shareable report URLs). Fonts self-hosted or via Bunny
  Fonts.
- **Backend (scanner only)**: Scaleway Serverless Containers in an EU region, Scaleway Object
  Storage for results, a scheduled job that opens a PR with new observations.
- **Analytics**: Plausible (EU). Nothing else.
- **CI/CD**: GitHub Actions. Build, typecheck, lint, unit and e2e tests, data validation and
  Lighthouse budgets run on every PR. Deploy to Bunny on merge to `main`.

## Development Workflow

- Work follows Spec Kit: constitution → feature spec → plan → tasks → implement. One feature
  spec per product (`specs/NNN-name/`). A spec that violates a principle is changed, or the
  constitution is amended first.
- Every change is a pull request against `main`, including data changes. CI gates MUST pass.
  Data PRs additionally require evidence links for each new or changed observation.
- Spec revisions are added as data before any page references them. A revision's `status`
  (draft, current, superseded, withdrawn) drives what the atlases show by default.
- Observations are append-only. A newer observation supersedes an older one for the same server
  and feature; history is kept and rendered.
- Releases are continuous. The changelog (and the newsletter) is generated from merged data and
  content changes, never written independently of them.

## Governance

This constitution supersedes every other practice document in the repository. Amendments are
made by pull request that updates this file, bumps the version below, and carries a Sync Impact
Report in the PR description. MAJOR for a changed or removed principle, MINOR for a new
principle or section, PATCH for wording. Every plan's Constitution Check lists each principle and
states how the feature complies or justifies the deviation in its Complexity Tracking table.

**Version**: 1.0.1 | **Ratified**: 2026-10-13 | **Last Amended**: 2026-10-22
