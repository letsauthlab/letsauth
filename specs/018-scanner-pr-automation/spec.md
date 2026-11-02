# 018-scanner-pr-automation

Owner request, 2026-11-02: a nightly scan opens a pull request only when it found something new,
and an agentic workflow reviews the scanner's pull requests and approves the ones that hold.

## Problem

Five scanner pull requests were open on 2026-11-02 (#82, #83, #85, #87, #88). Most of their
entries repeat each other, for two reasons:

1. A run compares only with `main`. While an earlier pull request is unmerged, every later run
   writes the same observations again (`neon` `mcp.as.cimd` and `mcp.as.iss-param` in #85, #87
   and #88).
2. Some servers return a set in a different order on each request. Ramp's `scopes_supported`
   came back reordered, so the evidence string differed, and the append rule wrote a new entry
   every night for an unchanged set (#83, #85, #87, #88).

## Required behavior

1. Before it scans, a nightly run reads the observations of every open scanner pull request (a
   `scanner/` branch of this repository against the base branch) and lets the append rule
   compare with them as well as with `main`.
2. The pull request a run opens carries only what neither `main` nor a pending pull request
   carries. A run that found nothing new opens nothing.
3. Earlier pull requests stay open and are not commented on or closed (014, criterion 2). The
   new pull request names the pending ones it was compared with.
4. Evidence for a field the specifications define as a set (`scopes_supported`,
   `code_challenge_methods_supported`) lists its values sorted, so a reordered set writes the same
   evidence. Lists whose order carries meaning (`authorization_servers`) are left as served.
5. An agentic workflow (GitHub Agentic Workflows, `.github/workflows/scanner-review.md`) reviews
   each scanner pull request: it checks every appended entry against the decision table and the
   evidence format, and submits an approving review when all hold, a comment review otherwise.
   It never requests changes, never merges, and never contacts a listed server or an evidence URL
   (constitution III: the scan runs only on Scaleway).
6. A deterministic step before the agent fails the run when the pull request changes anything
   other than `data/observations/*.yaml` or removes a line, so such a pull request is never
   approved.

## Acceptance criteria

1. Unit tests cover the overlay (pending entries, de-duplication, carrying only the new suffix,
   refusing an edit) and the pending pull request listing (only same-repository `scanner/`
   branches, oldest first).
2. A unit test shows the same evidence for the same set in two orders.
3. The workflow compiles with `gh aw compile`; the lock file is committed beside its source.
4. `docs/scanner.md` and `specs/004-scanner/contracts/job.md` describe the new run and the review.
