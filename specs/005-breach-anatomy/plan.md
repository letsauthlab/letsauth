# Implementation Plan: Breach Anatomy

**Branch**: `claude/breach-anatomy-6g6j4l` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

## Summary

Amend the Vulnerability entity so a page can be rendered from it (summary, disclosure date,
fix, five more classes, a replay that points both ways); add five entries from public
advisories and three replay toggles on the existing `mcp-authorization` scenario; render an
index, one page per entry and a JSON export from a small pure library (`src/lib/breaches.ts`)
that reuses the explorer's `featureSupport` for the atlas counts. No island, no new dependency,
no backend.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 22 · **Dependencies**: unchanged ·
**Storage**: `data/vulnerabilities/*.yaml`, three toggles in `data/scenarios/mcp-authorization.yaml` ·
**Testing**: Vitest (schema, ordering, replay resolution, controls, export, validator messages),
Playwright (index, page, navigation, export, no-JS, phone width, axe, screenshots) ·
**Constraints**: pages are plain HTML; new screenshot baselines for the two pages come from the
label workflow (the explorer's stayed within tolerance); two new URLs join the Lighthouse list.

## Constitution Check

| Principle | Status | How this plan complies |
|---|---|---|
| I. One Model, Many Views | PASS, with the recorded deviation | The Vulnerability entity is amended (three fields, five classes, rule 8) and rendered by one new view; the explorer picks the back-link up through its existing `vulnerability` field. Amendment and views ship in one pull request, the amendment as its own first commit, as 009 did (Complexity Tracking). |
| II. Every Claim Cites a Revision | PASS | Every replay step and toggle cites a revision and section; every requirement card shows the feature's citation; the entry's own facts cite the advisory, which is the only source a breach has. |
| III. Neutral and Passive by Default | PASS | Entries are ordered by date, never by severity; classes name the kind of control, not a score. Nothing contacts anything; sources are links. No exploit detail beyond the advisory. |
| IV. Static First, Open Data | PASS | YAML under `data/`, validated; pages pre-rendered; `/breaches/data.json` under CC BY 4.0. |
| V. Craft and Budgets | PASS | Reuses `.card`, `.pill`, `.kv`, `.level`, `.crumbs`, `.eyebrow`, tokens only; no JavaScript on either page; axe and phone-width tests; two URLs added to the Lighthouse list. |
| VI. Agent-Legible Repository | PASS | The schema is the contract; the validator names file and field for a broken replay; one library module; docs updated. |
| VII. European by Default | PASS | Unchanged. |
| Honesty tests | PASS | See spec.md. |

## Project Structure

```text
specs/005-breach-anatomy/{spec,plan,research,data-model,tasks}.md
specs/005-breach-anatomy/contracts/data-export.md

src/schema/vulnerability.ts           # summary, disclosed, fixed, classes, min(1) on affects and sources
src/lib/data.ts                       # rule 8: replay points both ways
src/lib/labels.ts                     # VULNERABILITY_CLASS_LABEL
src/lib/breaches.ts                   # NEW: breachList, replayOf, missingControls, buildBreachesExport
src/pages/breaches/{index,[id]}.astro # NEW
src/pages/breaches/data.json.ts       # NEW
src/layouts/Base.astro                # nav and footer links
src/pages/about.astro                 # product card
data/vulnerabilities/*.yaml           # five entries
data/scenarios/mcp-authorization.yaml # three toggles with `vulnerability`
docs/{data-model,architecture,roadmap}.md, README.md, lighthouserc.json
scripts/validate-data.ts              # counts vulnerabilities in its summary line
tests/unit/{breaches,validate-data}.test.ts, tests/fixtures/bad-data/vulnerabilities/orphan.yaml
tests/e2e/breaches.spec.ts
```

## Complexity Tracking

| Deviation or decision | Why | Alternative rejected because |
|---|---|---|
| Model amendment and views in one pull request | One branch was given; the amendment is the first commit so the owner can split it | A second branch needs the owner's word |
| No runnable lab | The site is static and cites, it does not demonstrate exploits; the replay is the reading a lab would give | A backend lab is a product decision outside this feature and the constitution's backend exception (scanner only) |
| Five new classes instead of `other` | A class is what the index shows and what a reader scans for; five entries under `other` would carry no information | Keeping the enum as is |
| No grouping or filter on the index | Five entries fit one list; a filter is an island the page does not need | Grouping by class, until there are enough entries to need it |

## Revision history

| Date | Change | Decided by |
|---|---|---|
| 2026-10-17 | Plan written and implemented in one pull request, as 008, 009 and 010 were | thread |
