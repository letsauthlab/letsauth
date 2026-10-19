# Quickstart: Composable discovery strategies

| # | Scenario | How | Expected |
|---|---|---|---|
| 1 | GET 405, POST 401 (US1) | `tests/unit/scanner-checks.test.ts` `challenge-post` | requests: two well-known, GET, POST, pointer, AS; challenge cells judged from the POST; `via` set on every cell |
| 2 | GET 401 | `complete` | no POST sent |
| 3 | GET timeout | `challenge-timeout` | no POST sent; challenge cells unknown naming the timeout |
| 4 | GET 405, POST 405 | `challenge-405` | unknown; evidence names `GET HTTP 405, POST HTTP 405` |
| 5 | Scope challenge (US3) | `complete`, `challenge-post`, `redirect-landing` | supported with the scopes; unsupported quoting a bare `Bearer` |
| 6 | Scope SHOULD fallbacks (US3) | `as-scopes`, `as-scopes-offline`, `challenge-scope-offline`, `no-scopes`, `offline-access` | `via` is `as.scopes`, `prm.silent`, `challenge.scope`, `prm.silent`, `prm.scopes` respectively |
| 7 | Stale URL (US4) | `stale-sse`; `pnpm scan --all --summary out.md` on the next run | `endpointNote` names 410 and `/mcp`; the summary's Notes column shows it |
| 8 | Fallbacks always decide (US2) | unit test over `PASSIVE_CHECKS` with `prm-timeout` | no check throws |
| 9 | Pages | `pnpm build`; open `/scanner/` and a report | "What it reads" names the ladder and eight requests; report rows are fourteen; the scanner page screenshot is refreshed by label |
| 10 | Live | next nightly run | Airtable, Attio, Figma and Zoom have a challenge status; the five corrected servers are scanned at their new URL |

> Superseded by 013-scanner-conformance: the `as.scopes` positive fallback is removed.
> When only the AS advertises scopes, the resource check is `unknown` via `prm.silent`.
