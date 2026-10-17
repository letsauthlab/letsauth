# Tasks: Server access and auth classes

**Input**: `specs/009-access-auth-classes/` · **Tests**: unit tests for the schema, the helpers,
the grade and the suggestion; e2e for the filters, the grouping and the server page. The scanner
never touches the network in tests.

## Phase 1: Model (its own commit)

- [x] T001 `src/schema/server.ts`: `accessClass`, `authClass`, the Classification shape, `access` and `auth` optional fields (FR-001)
- [x] T002 `docs/data-model.md`: the two fields, the Classification shape and its rules; an example
- [x] T003 `tests/fixtures/bad-data/servers/stripe.yaml`: a statement missing `evidence`; `tests/unit/validate-data.test.ts` names the field

## Phase 2: Foundational

- [x] T004 `src/lib/classes.ts`: `accessOf`, `authOf`, `hasNoOAuth`, `countBy`, labels, descriptions, orders (FR-002)
- [x] T005 `tests/unit/classes.test.ts`: derived unknown, stated unknown, `hasNoOAuth` over every class, schema rejections

## Phase 3: User Story 1 - Filter and group the matrix (P1)

- [x] T006 [US1] `src/components/MatrixTable.astro`: pills with derived state, `data-access`/`data-auth` on rows, group row style
- [x] T007 [US1] `src/components/MatrixPage.astro`: class counts in the facts, Access/Auth/Group controls, legend
- [x] T008 [US1] `src/components/Matrix.svelte`: filter by the two classes, group with header rows, URL state (FR-003)
- [x] T009 [US1] `tests/e2e/matrix.spec.ts`: filter, group, URL restore, no-JS pills

## Phase 4: User Story 2 - The server page states the classes (P1)

- [x] T010 [US2] `src/pages/atlas/mcp/servers/[id].astro`: Access and Auth lines with meaning, method, handle, date, evidence; derived wording (FR-004)
- [x] T011 [US2] `tests/e2e/server-page.spec.ts`: classified and unclassified servers
- [x] T012 [US2] Seed `data/servers/*.yaml` from vendor pages (research R4, FR-007); `pnpm validate:data`

## Phase 5: User Story 3 - Scanner and grade (P2)

- [x] T013 [US3] `src/scanner/grade.ts`: `noOAuth(how)`; rule text; `src/lib/scanner.ts` and `scripts/scan.ts` read `auth.class` (FR-005)
- [x] T014 [US3] `src/scanner/report.ts`: `suggestAuth`, `Discovered.authSuggestion`; `src/scanner/observations.ts`: `authNote`, summary Notes (FR-006)
- [x] T015 [US3] Fixture `challenge-open.json`; tests in `scanner-checks`, `scanner-append`, `scanner-view`

## Phase 6: Prose

- [x] T016 `docs/atlas-maintenance.md`, `docs/scanner.md`, `docs/roadmap.md` (row 009), `src/pages/scanner/index.astro`
- [x] T017 `pnpm check`; refresh the matrix and server page screenshots through the `refresh-screenshots` label on the pull request (baselines committed by the workflow)
- [x] T018 Remove `authClaimed` from `src/schema/server.ts`, every `data/servers/*.yaml`, the server page, docs and tests (owner's call: keep the model simple) ; server page baselines refreshed by the workflow
