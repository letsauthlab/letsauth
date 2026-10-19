# Tasks

- [x] Typed recipes, configurations, plans and reports
- [x] Owner proof and bounded credential-confined transport
- [x] MCP comparisons, DCR and paired revocation evidence
- [x] CLI and validated observation preview/append
- [x] Documentation and contributor entry points
- [x] Negative-path, protocol, evidence and CLI tests (56 new tests)
- [x] Existing validation, lint, typecheck, tests and build (418 tests pass)

Validation on 2026-10-19: dataset and append-only checks passed; Biome passed with one existing
CSS specificity warning; strict TypeScript passed; all 22 Vitest files / 418 tests passed;
Astro production build passed (185 pages). CLI help and offline plan exercised through the
entry point. Existing validator subprocess tests now use `node --import tsx`, avoiding an
unnecessary Unix IPC socket while preserving all assertions. Active protocol/network checks
used deterministic fixtures and mocked sockets; no third-party active probes were performed.
No browser-visible code changed; hosted CI retains its normal browser/Lighthouse gates.
