# letsauth.eu tech stack

The technologies, services and budget numbers the repository uses today. The constitution states
what must always hold and names none of them; this file says how the repository meets it now. A
change here needs a pull request and, where it touches a principle, a plan that checks it against
the constitution. Moving to another tool does not amend the constitution.

## Stack

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

## Budgets

The numbers behind constitution principle V, enforced in CI:

- Lighthouse performance and accessibility at or above 95 on the home page, each atlas page and
  the explorer.
- No page ships more than 150 kB of compressed JavaScript without a documented exception.
- WCAG 2.2 AA is the accessibility level.

## Agent tooling

The tools behind constitution principle VI: TypeScript in strict mode, Biome as the one linter and
formatter, the Zod schema under `src/schema/` as the readable contract for the data model,
Playwright screenshot comparison for visual changes, and `CLAUDE.md` as the agent working notes.
