# Quickstart: Server access and auth classes

| # | Scenario | How to verify |
|---|---|---|
| 1 | Schema | `pnpm test` → `classes.test.ts`: a statement with all five fields passes; a missing `evidence` or an unknown class is rejected with the field named; `pnpm validate:data` over `tests/fixtures/bad-data` names `servers/stripe.yaml.auth.evidence` |
| 2 | Filters | `pnpm build && pnpm test:e2e` → `matrix.spec.ts`: `?access=public&auth=oauth` leaves only rows with both `data-` attributes; the count line reflects it |
| 3 | Grouping | `matrix.spec.ts`: `?group=auth` inserts one `tr.group` per class present, rows alphabetical within each |
| 4 | No JavaScript | `matrix.spec.ts` (no-JS block): every row present, alphabetical, with two `.class` pills |
| 5 | Server page | `server-page.spec.ts`: a classified server shows both lines with method, date and an evidence link; an unclassified one shows the derived unknown |
| 6 | Grade | `scanner-view.test.ts`: `auth.class: api-key` → "No OAuth" with the class in the reason; a missing or `unknown` class grades normally |
| 7 | Suggestion | `scanner-checks.test.ts`: `authSuggestion` is `oauth` for `complete` and `challenge-pointer`, `none` for `challenge-open`, null for `challenge-neither` and `challenge-timeout` |
| 8 | Summary note | `scanner-append.test.ts`: a report suggesting `oauth` for a server without a statement yields a "not stated" note; with `auth.class: api-key` a disagreement note; with `auth.class: oauth` none |
| 9 | Live | After merge, the next nightly summary's Notes column names servers whose class is not yet stated or disagrees with the scan |
