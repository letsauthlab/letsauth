# 011-deployment-hardening

Remediates main-branch review findings 1, 9, 10 at f9bccfd.

## Required behavior

Authenticate production triggers, skip stale commits, reconcile obsolete published files.

Existing observations remain append-only. Failure paths must preserve evidence and fail safely.

## Acceptance criteria

1. Require successful push CI from this repository’s main, or manual current main.
2. Serialize jobs and compare candidate SHA with main before checkout or deployment credentials.
3. Build the latest main scanner snapshot without a single-commit path filter.
4. Upload all generated files before pruning obsolete site files; preserve unrelated storage and fail closed on bad listings/manifests.
