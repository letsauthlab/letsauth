# Tasks

- [x] Typed recipes, configurations, plans and reports
- [x] Bounded credential-confined transport (original owner proof removed in workflow correction)
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

## Manual workflow follow-up

- [x] `init <server-id|https-url>` creates a private editable baseline configuration.
- [x] URL-based MCP evidence can be attached after adding the exact server endpoint.
- [x] Document manual login/token supply, optional planning and new-server recording.
- [x] Keep the passive scanner and nightly job unchanged; no credential persistence added.

Validation: all 58 investigation tests passed; TypeScript, lint (existing CSS warning), data
validation, append-only check and production build passed. The full suite passed 419/420
tests with one existing validator test exceeding its 5-second timeout during the concurrent
build. Rerunning that file alone passed all 9 tests. No live active probes were made.

## Interactive OAuth and third-party workflow correction

- [x] Remove domain proof from model, runner, CLI, docs and tests.
- [x] Amend constitution principle III and contributor instructions for local third-party testing.
- [x] Official SDK OAuth integration, in-memory state and loopback callback.
- [x] Direct `check` command and configured `run --login`.
- [x] Test real SDK discovery/PKCE/registration/exchange with simulated provider responses.
- [x] Test callback validation/cleanup and keep negative measurements isolated from OAuth retries.
- [x] Complete repository validation and update PR.

Final validation for the correction: 441 tests across 24 files passed, including 79 investigation
tests. Strict TypeScript, data validation, append-only validation, lint (one existing CSS warning),
and the 185-page Astro production build passed. OAuth tests exercise the real SDK with simulated
provider responses; callback HTTP handling is mocked. No live third-party login or probes were run.
The dependency lock was generated with the repository's pnpm 10.28.0 and only adds SDK dependencies.
