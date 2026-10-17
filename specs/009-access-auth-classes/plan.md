# Implementation Plan: Server access and auth classes

**Branch**: `claude/project-thread-89arw2` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

## Summary

Amend the Server entity with two optional, evidenced Classification fields, `access` and `auth`
(schema, data model, docs); seed them for the listed servers from vendor pages; show them as
pills on the matrix with filters and grouping in the existing island, and as evidenced lines on
the server page; switch the scanner's target selection and the grade from the directory's
`authClaimed` label to `auth.class` and drop the label; add an `authSuggestion` to the report and
a disagreement note to the run summary.
No new entity, dependency or page. One new library module (`src/lib/classes.ts`) holds the
labels, descriptions and the two helpers every view uses.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 22 · **Dependencies**: unchanged ·
**Storage**: the two fields in `data/servers/*.yaml` · **Testing**: Vitest (schema, classes,
scanner view, suggestion, summary note), Playwright (filters, grouping, server page, no-JS);
the matrix and server screenshots change by design and are refreshed through the label ·
**Constraints**: the matrix island stays small (grouping is a DOM re-order of the server-rendered
rows); pages read fully without JavaScript; the scanner writes nothing new.

## Constitution Check

| Principle | Status | How this plan complies |
|---|---|---|
| I. One Model, Many Views | PASS, with a recorded deviation | The model is amended (two fields, one shape) and every view that renders a server picks them up: matrix, server page, exports, scanner view, run summary. The amendment and the views ship in one pull request on the one branch this thread was given; the model change is its own first commit so the owner can split it (Complexity Tracking). |
| II. Every Claim Cites a Revision | PASS | A class is not a claim about a revision; it carries method, evidence, date and handle instead, and the page shows all four. Nothing about citations changes. |
| III. Neutral and Passive by Default | PASS | Classes group, they do not rank; the matrix stays alphabetical inside a group. The scanner sends nothing new; it reads a suggestion off answers it already has and writes it only into the summary a person reviews. A missing class is a derived unknown. |
| IV. Static First, Open Data | PASS | YAML under `data/`, validated by the schema, changed by pull request; the exports carry it. |
| V. Craft and Budgets | PASS | Pills reuse tokens and the `.pill` surface; the filters reuse `.field`; grouping adds a header row style. Baselines for the matrix and server pages are refreshed through the label workflow. |
| VI. Agent-Legible Repository | PASS | The schema is the contract; labels and descriptions live in one module; fixtures cover the suggestion; docs say how to state a class. |
| VII. European by Default | PASS | Unchanged. |
| Honesty tests | PASS | Not summarisable: which real servers are reachable by self-service and how they authenticate is checked against vendor pages, with the scan as a cross-check. Compounding: the same rows gain two facets every other view can use (005 can group breaches by auth class). One maintainer: two fields per server, corrected in place. |

## Project Structure

```text
specs/009-access-auth-classes/{spec,plan,research,data-model,quickstart,tasks}.md
specs/009-access-auth-classes/contracts/data-export.md
specs/009-access-auth-classes/checklists/requirements.md

src/schema/server.ts                 # accessClass, authClass, Classification, two fields
src/lib/classes.ts                   # NEW: accessOf, authOf, hasNoOAuth, labels, descriptions, countBy
src/lib/scanner.ts                   # grade from auth class
src/scanner/grade.ts                 # noOAuth(how); rule text
src/scanner/report.ts                # suggestAuth, Discovered.authSuggestion
src/scanner/observations.ts          # authNote, RunResult.authNote, summary Notes
scripts/scan.ts                      # target selection by auth class; prints the note
src/components/MatrixTable.astro     # pills, data-access/data-auth, group row style
src/components/MatrixPage.astro      # facts, filters, group select, legend
src/components/Matrix.svelte         # access/auth filters, grouping, URL state
src/pages/atlas/mcp/servers/[id].astro   # Access and Auth lines with evidence
src/pages/scanner/index.astro        # prose
data/servers/*.yaml                  # access and auth statements
docs/{data-model,atlas-maintenance,scanner,roadmap}.md
tests/unit/{classes,scanner-view,scanner-checks,scanner-append}.test.ts
tests/e2e/{matrix,server-page}.spec.ts
tests/fixtures/bad-data/servers/*.yaml
```

## Complexity Tracking

| Deviation or decision | Why | Alternative rejected because |
|---|---|---|
| Model amendment and views in one pull request | This thread was given one branch; the amendment is the first commit and the owner can split it before merging | A second branch needs the owner's word (`CLAUDE.md`, branch rules) |
| Classes on the server file, not as observations | They are about the server as a whole, not a requirement of a revision; observations cite a revision | Two pseudo-features would need a citation they do not have, and would put a non-requirement in the matrix |
| The scanner suggests, a person states | A 401 does not prove OAuth; a vendor page does | Writing the class from the scan would make the scanner the author of a statement it cannot evidence |

## Revision history

| Date | Change | Decided by |
|---|---|---|
| 2026-10-17 | Plan written and implemented in one pull request, as 008 and 010 were | thread |
