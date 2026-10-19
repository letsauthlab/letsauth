# Implementation Plan: Composable discovery strategies

**Branch**: `claude/scanner-004-ubcjp1` | **Date**: 2026-10-16 | **Spec**: [spec.md](spec.md)

## Summary

Restructure the scanner's judgement into strategy lists (`strategies.ts`, the lists in
`checks.ts`) and its endpoint request into a declared ladder (`discovery.ts`: `GET`, then an
empty `POST` when the `GET` was routed elsewhere). Read the `scope` parameter of the challenge;
make `mcp.rs.scope-challenge` passive; let `mcp.prm.no-offline-access` fall back to the challenge
and the authorization server; flag stale listings in the report and the summary; correct five
listings; bump the scanner version. No new entity, dependency or page.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 22 · **Dependencies**: unchanged ·
**Storage**: observations as before · **Testing**: Vitest over recorded responses (seven new
fixtures), the parser test extended; e2e counts derive from data, the scanner page screenshot
needs a refresh (check count 13 → 14) · **Constraints**: 008 FR-001 (headers only, body never
read) holds for every step; at most eight requests per scan.

## Constitution Check

| Principle | Status | How this plan complies |
|---|---|---|
| I. One Model, Many Views | PASS | No entity or field is added. One feature flips `observable`; five servers get their documented URL. The report's `via` and `endpointNote` are report fields, not model fields. |
| II. Every Claim Cites a Revision | PASS | The scope challenge cites the section the feature file already carries for the current revision; every observation names the URL and status that decided it, from whichever strategy. |
| III. Neutral and Passive by Default | PASS, with a recorded decision | The empty `POST` sends no credentials, body, flow or protocol message and reads only headers (spec, "Why the empty POST is still a passive scan"). Every non-401 answer and every failure stay `unknown`. A stale URL is a note to the maintainer, never a status. |
| IV. Static First, Open Data | PASS | Same job, same pull request, same data files. |
| V. Craft and Budgets | PASS | Prose edits on the scanner page; one screenshot baseline refreshed through the label. |
| VI. Agent-Legible Repository | PASS | Two tables (ladder, strategy lists) replace bespoke functions; each strategy has an id and a title; fixtures record every new case; the version is bumped as `docs/scanner.md` says. |
| VII. European by Default | PASS | Unchanged. |
| Honesty tests | PASS | Not summarisable: which request shape each real server authenticates is measured. Compounding: eight blind challenge cells and an empty column fill on cells every view renders. One maintainer: fewer code paths than before. |

## Complexity Tracking

| Decision | Alternative considered | Why not |
|---|---|---|
| Empty `POST` as the second step | `POST initialize` (what a client sends) | A protocol message; 008 placed it on the active side. Offered to the owner as a further step if the empty `POST` is parsed before authentication by many servers. |
| Empty `POST` as the second step | `HEAD`, `OPTIONS` | Not routed to authentication on most frameworks (008 R2). |
| Authorization server scopes settle only `supported` | Let them settle `unsupported` too | The AS offering `offline_access` says nothing about what this server requests. |
| A note for stale URLs | Trying the `/mcp` sibling | A guessed URL is not the listed server; observations must cite the listing. |

## Project Structure

```text
specs/010-discovery-strategies/{spec,plan,research,data-model,quickstart,tasks}.md
specs/010-discovery-strategies/contracts/report.md
specs/010-discovery-strategies/checklists/requirements.md
src/scanner/{strategies,discovery}.ts        # new
src/scanner/{checks,probe,fetch,challenge,report,observations,version}.ts
data/features/mcp.rs.scope-challenge.yaml; data/servers/{atlassian,plaid,linear,sentry,cloudflare-workers}.yaml
tests/unit/scanner-{checks,challenge,view}.test.ts; tests/fixtures/scanner/*.json
```

## Revision history

| Date | Change | By |
|---|---|---|
| 2026-10-16 | Plan written and implemented in one pull request, as 008 was | owner |

> Superseded by 013-scanner-conformance: the `as.scopes` positive fallback is removed.
> When only the AS advertises scopes, the resource check is `unknown` via `prm.silent`.
