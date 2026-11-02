# Implementation plan: Scanner pull request automation

**Branch**: `claude/project-thread-4qsq5c` | **Date**: 2026-11-02 | **Spec**: `spec.md`

## Approach

- `src/scanner/pending.ts`: pure text functions. `pendingEntries` takes a pending branch's
  observations file and returns the entries the run's file lacks (compared as canonical JSON, so
  key order does not matter); `withEntries` appends them in the scanner's own YAML form;
  `appendedText` and `onto` take what the scan appended after the overlay and put it on `main`'s
  file.
- `src/scanner/nightly.ts`: `listPendingScannerPulls` (open pull requests against the base from
  a `scanner/` branch of the repository itself, oldest first) and `pendingNote` for the
  description.
- `scripts/scan-nightly.ts`: list pending pull requests, fetch each branch shallowly, overlay its
  entries, scan, take the overlay back out, then validate and continue as before. The overlay
  never reaches a commit.
- `src/scanner/checks.ts`: `showSet` sorts string arrays for the two set-valued fields.
- `.github/workflows/scanner-review.md`, compiled to `scanner-review.lock.yml`: a
  `pull_request` workflow limited to the scanner bot's `scanner/` branches and to
  `data/observations/**`; a shell step gates on "only appended lines in observation files"; the
  agent (engine `claude`) has read-only GitHub tools and a short bash allowlist, no web access;
  the safe outputs allow `submit-pull-request-review` with `APPROVE` or `COMMENT` and up to ten
  line comments, only on titles starting `Scanner: `.

## SCANNER_VERSION

Not bumped. The checks' logic is unchanged; only the order inside two list values is. A bump
would re-observe every cell of every server in one pull request; without it the append rule
re-observes exactly the cells whose evidence text changes (a set that was not already sorted),
once, and they then stay quiet.

## Constitution check

- **I. One model, many views**: no new entity; observations keep their shape.
- **II. Every claim cites a revision**: unchanged; every entry still cites the revision.
- **III. Neutral and passive**: the scan is unchanged and still runs only on Scaleway. The
  reviewer reads the repository and the pull request and contacts no listed server.
- **IV. Static first, open data**: data still changes only through reviewed pull requests; the
  review is a pull request review, not a merge.
- **V. Craft and budgets**: no page changes.
- **VI. Agent-legible repository**: the workflow's instructions are in the repository as
  Markdown, next to the lock file GitHub runs.

## Owner setup (outside the repository)

- Repository secret `ANTHROPIC_API_KEY` for the agent's engine.
- Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests", so
  the safe-output job's `GITHUB_TOKEN` may submit an approving review.
