# Local manual investigation CLI

Help a maintainer turn unknown atlas cells into reproducible, reviewed observations.
The scheduled scanner remains passive. The contributor runs this CLI locally against listed
servers or explicit third-party MCP URLs, using accounts/endpoints they are permitted to test.
Domain ownership is not required; there is no hosted ownership challenge.

## User stories and acceptance criteria

1. `check <server-id|url>` handles OAuth discovery, client registration when available, browser
   launch, loopback callback and PKCE code exchange, then runs a baseline or invalid-token check.
   The human completes browser login and consent. Support preregistered clients and supplied
   CIMD URLs; explain provider registration restrictions without pretending account access is enough.
2. `init` and `run --login` support configurable operations/recipes. Existing access tokens can
   still be supplied through named environment variables. Scope/audience comparisons currently
   require a deliberately acquired second token. Revocation requires the same prior token.
3. OAuth uses the official MCP client SDK. Validate state, issuer and resource binding; pin
   discovery state across the callback; require S256. The loopback listener has a timeout and
   closes on all outcomes. Tokens/client secrets are memory-only, never CLI arguments or reports.
4. Run bounded explicit baseline, invalid-token, audience, scope, revocation and DCR checks.
   Compare only after operation-level baseline success. Network/protocol errors are inconclusive.
   Measurement requests never refresh, reauthenticate or silently change a comparison token.
5. Capture versioned evidence with timestamps, recipe/citations, digests, request stages,
   statuses and bounded outcomes. No raw bodies, tokens, session IDs or credential error text.
6. `record` validates and previews manual observations; only `--write` appends. The operator
   chooses a status and evidence. URL-based MCP reports can be attached after listing the exact
   endpoint. No unrelated-server or unbound AS-report mapping; observations stay append-only.
7. `list` and `plan` are optional guidance from fixed recipes and shared dataset citations.
   They never fetch or generate executable code. No plan/config required for `check`.

## Scope boundaries

Local Streamable HTTP investigation only, with JSON/SSE responses and protocol 2025-11-25.
No scheduler integration, hosted scanner, login service or persistent credential vault.
Provider restrictions may require preregistration. DCR creates a client and requires cleanup.
Source/documentation review remains necessary for properties not observable from requests.
All measurements require interpretation; none automatically assert universal conformance.
