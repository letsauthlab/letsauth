# Tasks: Breach Anatomy

**Input**: `specs/005-breach-anatomy/` · **Tests**: unit for the schema, the library and the
validator messages; e2e for the index, the page, navigation, export, no-JS, phone width, axe
and screenshots.

## Phase 1: Model (its own commit)

- [x] T001 `src/schema/vulnerability.ts`: `summary`, `disclosed`, `fixed`, five classes, `min(1)` on `affects` and `sources` (FR-001)
- [x] T002 `src/lib/data.ts`: rule 8 in both directions; `docs/data-model.md` (FR-003)
- [x] T003 `src/lib/labels.ts`: `VULNERABILITY_CLASS_LABEL`
- [x] T004 `tests/fixtures/bad-data/vulnerabilities/orphan.yaml`, `scenarios/broken.yaml`; `tests/unit/validate-data.test.ts` (SC-003)

## Phase 2: Data

- [x] T005 Five entries under `data/vulnerabilities/` from their advisories (research R2)
- [x] T006 Three replay toggles on `data/scenarios/mcp-authorization.yaml`, each naming its entry (FR-005)
- [x] T007 `scripts/validate-data.ts` counts vulnerabilities in its summary line

## Phase 3: User Story 1 and 3 - Index and export (P1, P2)

- [x] T008 `src/lib/breaches.ts`: `breachList`, `replayOf`, `missingControls`, `buildBreachesExport`
- [x] T009 `src/pages/breaches/index.astro` (FR-002), `src/pages/breaches/data.json.ts` (FR-006)
- [x] T010 `tests/unit/breaches.test.ts`

## Phase 4: User Story 2 - One page per entry (P1)

- [x] T011 `src/pages/breaches/[id].astro`: facts, controls with atlas counts, replay or its absence (FR-004)
- [x] T012 `tests/e2e/breaches.spec.ts`

## Phase 5: Wiring and prose

- [x] T013 `src/layouts/Base.astro` nav and footer, `src/pages/about.astro`, `README.md`, `lighthouserc.json` (FR-007)
- [x] T014 `docs/architecture.md`, `docs/roadmap.md` (rows 005 and 009)
- [x] T015 `pnpm check`; baselines for `breaches.spec.ts` generated through the `refresh-screenshots` label on the pull request (after the merge with the page tree, the scenario page baseline was refreshed the same way: three more toggles in its list)
