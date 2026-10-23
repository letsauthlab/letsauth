# Implementation plan: Neutral scan summary

**Branch**: `claude/project-thread-vg8kgo` | **Date**: 2026-10-22 | **Spec**: `spec.md`

## Approach

`src/scanner/grade.ts` becomes `src/scanner/summary.ts`: the same either-or rule, with
`summarize()` returning per-level counts instead of a letter. Everything that read `grade` reads
`summary`. The report page renders the counts with `StatusCell` in the label variant, the same
pattern the server page uses for its own counts, so no new visual element is introduced. The
`GradeBadge` component is removed.

## Constitution check

- **I. One model, many views**: the summary is derived at render time from observations; no new
  stored entity.
- **II. Every claim cites a revision**: the report still cites the revision and each row its
  section. The constitution's wording changes "grade" to "scan result" (PATCH, 1.0.1).
- **III. Neutral and passive**: the point of this change. Nothing is scored; unknown stays
  unknown.
- **IV. Static first**: no change.
- **V. Craft and budgets**: tokens only, no new colours; the report summary stacks at phone
  width; one link fewer per matrix row's visual weight.

## Contract change

`contracts/report.md` of 004: `grade` → `summary`, `version` 1 → 2. The JSON is public, so the
README example changes with it.
