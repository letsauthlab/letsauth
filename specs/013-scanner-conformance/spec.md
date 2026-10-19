# 013-scanner-conformance

Remediates main-branch review findings 3, 4, 6 at f9bccfd.

## Required behavior

Validate resource identity, compare issuers exactly, and avoid unsupported inference about scopes.

Existing observations remain append-only. Failure paths must preserve evidence and fail safely.

## Acceptance criteria

1. Validate required HTTPS resource identity before accepting PRM metadata or discovering its issuer.
2. Use exact route-dependent resource binding per RFC 9728 §3.3; retain invalid responses as evidence and try remaining candidates.
3. Compare issuer strings exactly per RFC 8414 §3.3, including trailing slashes.
4. Remove AS scope omission as evidence about the resource’s offline_access use.
5. Release scanner version 0.4.0 after transport version 0.3.1; leave existing observations untouched.
