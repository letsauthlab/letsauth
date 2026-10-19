# 014-observation-integrity

Remediates main-branch review findings 8, 12 at f9bccfd.

## Required behavior

Keep pending scanner pull requests and sort observations by actual instants.

Existing observations remain append-only. Failure paths must preserve evidence and fail safely.

## Acceptance criteria

1. Remove the unsupported assumption that a later scan contains earlier pending observations.
2. Keep each pending PR and branch available for review; do not comment on or close earlier PRs automatically.
3. Compare observedAt using parsed instants for atlas cells, scanner checks and latest-scan dates.
4. Keep method-strength tie breaking for equivalent instants, regardless of offset representation.
