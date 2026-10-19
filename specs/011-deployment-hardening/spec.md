# 011-deployment-hardening

Remediates main-branch review findings 1 and 10 at f9bccfd.

## Required behavior

Authenticate production triggers and skip stale commits. Keep the existing uploader unchanged.
Finding 9 (stale files) is deferred to a separate official Bunny Sites migration.

Existing observations remain append-only. Failure paths must preserve evidence and fail safely.

## Acceptance criteria

1. Require successful push CI from this repository’s main, or manual current main.
2. Serialize jobs and compare candidate SHA with main before checkout or deployment credentials.
3. Build the latest main scanner snapshot without a single-commit path filter.
4. Do not introduce a custom publisher, deployment manifest or storage cleanup policy.
