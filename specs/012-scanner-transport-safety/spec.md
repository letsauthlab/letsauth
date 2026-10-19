# 012-scanner-transport-safety

Remediates main-branch review findings 2, 5, 7 at f9bccfd.

## Required behavior

Connect only to validated public addresses; record throttling and body failures as inconclusive.

Existing observations remain append-only. Failure paths must preserve evidence and fail safely.

## Acceptance criteria

1. Use node:https with per-request validated DNS answers pinned by the socket lookup, preserving Host, SNI and certificate verification.
2. Disable socket reuse across guarded requests and validate redirects independently.
3. Classify HTTP 429 as an error in JSON and challenge modes; retain uncertainty in downstream checks.
4. Capture body-stream failures as FetchResult errors so discovery can continue.
5. Release scanner version 0.3.1; leave existing observations untouched.
