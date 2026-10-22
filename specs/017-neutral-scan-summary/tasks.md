# Tasks: Neutral scan summary

- [x] T01 `src/scanner/summary.ts` replaces `src/scanner/grade.ts`: `summarize()`, `SUMMARY_RULE`, `NOT_SCANNED`, `noOAuth()`; the either-or rule unchanged
- [x] T02 `src/scanner/report.ts`, `src/lib/scanner.ts`: `summary` on `Report` and `ScanView`; `REPORT_VERSION` 2
- [x] T03 `src/components/ScanReport.astro`: "What the scan found" with counts per level and the checks not supported; the ladder ends on the number of checks
- [x] T04 `src/components/MatrixTable.astro`, `MatrixPage.astro`: the grade box becomes a quiet "report" link; legend copy; `GradeBadge.astro` removed
- [x] T05 `src/pages/mcp/servers/[id].astro`: checks count and date instead of the grade
- [x] T06 `src/pages/mcp/scanner/index.astro`, `src/pages/mcp/servers/[id]/scan.astro`: "How the summary is counted"
- [x] T07 `src/scanner/observations.ts`, `scripts/scan.ts`: the nightly table and the CLI print the summary
- [x] T08 Unit and e2e tests; `tests/unit/scanner-grade.test.ts` becomes `scanner-summary.test.ts`
- [x] T09 Docs: `docs/scanner.md` "The summary", README, architecture, design (M12), development, data model, maintenance; 004 spec and report contract marked superseded; constitution 1.0.1
- [ ] T10 Screenshot baselines for the matrix, report and server pages: `refresh-screenshots` label on the pull request
