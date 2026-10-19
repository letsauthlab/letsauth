# Feature Specification: Composable discovery strategies

**Feature Branch**: `claude/scanner-004-ubcjp1`

**Created**: 2026-10-16

**Status**: Implemented (pull request open)

**Input**: Owner's request after the first nightly runs: "For a few requirements it seems not to
be able to generate insights for any MCP provider. Review these scenarios, research and reason
about how to improve discovery strategies and implement these in a way that makes it easy to
compose different strategies per item to improve discovery rate and reliability."

## What the first runs showed

Over the 34 servers scanned by 2026-10-16, four kinds of blind spot recur, each for the same
structural reason rather than a server's fault:

1. **The endpoint never issues a challenge to the scanner's request.** Eight servers answered
   the unauthenticated `GET` with 405 (Airtable, Attio, Figma, Zoom: streamable HTTP servers that
   do not offer the listening stream, which the transport explicitly allows), 404 or 410 (Linear,
   Sentry, Cloudflare: retired `/sse` paths), or a redirect to a documentation page (Stack
   Overflow's root URL). The challenge cell stayed `unknown`, and for three servers without
   well-known metadata every metadata cell with it.
2. **Stale listings.** Five of the 39 server URLs pointed at `/sse` endpoints their vendors had
   retired in favour of `/mcp`; the scanner could not tell a moved endpoint from a broken one.
3. **Nothing advertised to judge a scope requirement.** Twelve servers publish metadata without
   `scopes_supported`, so `mcp.prm.no-offline-access` stayed `unknown`, although the same
   servers' challenges or authorization servers name scopes.
4. **A column read but never judged.** `mcp.rs.scope-challenge` (the `scope` parameter of the
   401 challenge) was marked active, although the scanner already receives the header it lives
   in; the column was empty for every server.

Ten further columns (`mcp.rs.401-on-invalid`, `mcp.rs.bearer-header`,
`mcp.rs.audience-validation`, `mcp.rs.insufficient-scope`, and the manual requirements) need a
token, a scope or a reading of the implementation. They stay out of scope: the constitution
reserves them for owner-verified probes, and this feature does not change that.

## Why the empty POST is still a passive scan

008 settled that the challenge an endpoint returns to an unauthenticated request is public
metadata. The question here is only the request's shape. The streamable HTTP transport says a
server may answer `GET` with 405 when it offers no server-initiated stream; such a server
authenticates the client's first `POST` instead. A `POST` with an empty body and the JSON content
type reaches that authentication step with nothing the server could act on: it is not a JSON-RPC
message, opens no session, calls no tool, presents no token. A server that parses before it
authenticates answers 400, which is recorded as `unknown` like every other non-401 status. The
scanner sends it only when the `GET` was demonstrably routed somewhere other than authentication
(a definite non-401 status, or a redirect off the host), never after a failure to connect, and
reads nothing but the status and the `WWW-Authenticate` header. The `initialize` call a client
would send stays out: it is a protocol message, and 008 placed it on the active side.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A streamable HTTP server that rejects GET gets its challenge read (Priority: P1)

A server answers the scanner's `GET` with 405, as the transport allows. The scanner follows with
one empty `POST`, receives the 401 challenge, judges the challenge cells from it and, when the
well-known locations had nothing, follows the challenge's pointer to the metadata as 008 does.

**Why this priority**: Four of the eight blind challenge cells, and the three withheld grades
behind servers without well-known metadata, come from this one request shape.

**Independent Test**: Over recorded responses where the `GET` answers 405 and the `POST` answers
401 with a pointer and a scope, confirm the request list is the two well-known tries, the `GET`,
the `POST`, the pointer and the authorization server; confirm the challenge cells are judged from
the `POST`'s header; confirm no `POST` follows a timeout, and none follows a 401.

**Acceptance Scenarios**:

1. **Given** an endpoint that answers `GET` with any definite status but 401, or redirects off
   its host, **When** the scan runs, **Then** exactly one `POST` with an empty body follows, and
   its answer is the one judged.
2. **Given** an endpoint that answers `GET` with 401, **When** the scan runs, **Then** no `POST`
   is sent.
3. **Given** an endpoint whose `GET` fails to connect, times out, fails TLS or answers 5xx,
   **When** the scan runs, **Then** no `POST` is sent and the challenge cells are `unknown` with
   the failure named.
4. **Given** both steps answer with a status other than 401, **When** the scan runs, **Then** the
   challenge cells are `unknown` and the evidence names both steps and their statuses.

---

### User Story 2 - Every check is a readable list of strategies (Priority: P1)

A maintainer who wants the scanner to read a requirement from one more place adds one strategy to
that check's list, or one step to the endpoint ladder, and the report says which strategy decided
each cell.

**Why this priority**: The owner asked for composition per requirement; without it every new
source means editing a bespoke function and its evidence text.

**Independent Test**: Confirm every passive check is an ordered list of strategies whose last
entry always decides; confirm a report's checks carry `via` naming the strategy; confirm the
decision table in 004's data model has a row per strategy.

**Acceptance Scenarios**:

1. **Given** a requirement with several sources, **When** the first source is silent, **Then**
   the next is read, and the evidence URL is the deciding source's.
2. **Given** no source can decide, **When** the check runs, **Then** the fallback writes
   `unknown` with the reason, never `unsupported`.

---

### User Story 3 - The scope challenge is measured and the scope SHOULD reads every source (Priority: P2)

The `scope` parameter of the 401 challenge becomes a passively observable requirement, and
`mcp.prm.no-offline-access` reads the server's metadata, then the challenge, then the
authorization server.

**Why this priority**: One empty column fills from a header the scanner already receives, and
twelve `unknown` cells become judgeable, with no new request.

**Acceptance Scenarios**:

1. **Given** a 401 challenge with a `scope` parameter, **Then** `mcp.rs.scope-challenge` is
   `supported` with the scopes as evidence; without one, `unsupported` with the header quoted;
   with no 401, `unknown`.
2. **Given** metadata without `scopes_supported` and a challenge whose `scope` lacks
   `offline_access`, **Then** `mcp.prm.no-offline-access` is `supported` from the challenge.
3. **Given** neither names scopes and the authorization server's `scopes_supported` lacks
   `offline_access`, **Then** the cell is `supported` from the authorization server; when it
   offers `offline_access`, the cell stays `unknown` with that said.

---

### User Story 4 - A stale listing is flagged, not graded (Priority: P2)

When every step of the endpoint ladder answers 404 or 410, or every step is a redirect the scanner
would not follow, the report and the run summary carry a note that the listed URL looks stale.
The five known stale listings are corrected in the data.

**Acceptance Scenarios**:

1. **Given** an endpoint gone on every step, **Then** the summary's Notes column names it and
   suggests the usual `/mcp` sibling for an `/sse` path; no observation changes because of it.

### Edge Cases

- A `GET` that answers 401 and a server that would have answered the `POST` differently: the
  `GET` wins; one challenge per server is judged.
- A `POST` that redirects: followed under the same rules as every other request (same host,
  HTTPS, at most three hops), with the same method.
- A `scope` parameter that is empty (`scope=""`): the challenge names no scopes;
  `mcp.rs.scope-challenge` is `unsupported`, and the scope SHOULD passes to the next source.
- A challenge whose `scope` names `offline_access` while the metadata is silent: `unsupported`
  from the challenge; the metadata's own list, when present, always wins.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The endpoint MUST be asked in a declared ladder of unauthenticated requests that
  stops at the first 401: a `GET` as 008 defines, then one `POST` with an empty body and the JSON
  content type, only when the `GET` answered a definite status other than 401 or a redirect off
  the host. No step sends a JSON-RPC message, a token or a body; every step reads only the status
  and the `WWW-Authenticate` header.
- **FR-002**: Every passive check MUST be an ordered list of strategies; each reads one source and
  decides or passes; the last always decides; the report names the deciding strategy.
- **FR-003**: `mcp.rs.scope-challenge` MUST be passively observable and judged from the `scope`
  parameter of the 401 challenge: `supported` when it names at least one scope, `unsupported`
  on a 401 without it, `unknown` without a 401.
- **FR-004**: `mcp.prm.no-offline-access` MUST read, in order, `scopes_supported` of the
  protected resource metadata, the challenge's `scope`, and the authorization server's
  `scopes_supported` (the last only to establish `supported`, never `unsupported`), and stay
  `unknown` with the reason when none decides.
- **FR-005**: When every step of the ladder answers 404 or 410, or every step is a refused
  redirect, the report MUST carry an `endpointNote` and the run summary MUST show it; no
  observation is derived from it.
- **FR-006**: The scanner version MUST be bumped so every cell is re-observed, and the request
  count on the scanner page and in the documentation MUST be derived from the ladder's length.
- **FR-007**: The five listings known to point at retired `/sse` endpoints (Atlassian, Plaid,
  Linear, Sentry, Cloudflare Workers Bindings) MUST be corrected to their documented endpoints.

### Key Entities

No entity or field changes. One feature file changes `observable`; five server files change
`url` and `transport`.

## Success Criteria *(mandatory)*

- **SC-001**: Over the recorded scenarios, a `GET` answered 405 followed by a `POST` answered
  401 yields the same cells as a `GET` answered 401 would (unit tests).
- **SC-002**: No scenario sends more than one `POST`, and none after a connection failure or a
  401 (unit tests over the request list).
- **SC-003**: The decision table and the strategy lists agree: every passive feature of the
  current revision has a list, and every list ends in a fallback (unit test).
- **SC-004**: On the next nightly run, the challenge cell is judged for the servers that answered
  405, and `mcp.rs.scope-challenge` has a status for every server whose challenge was read
  (verified by the maintainer on the run's pull request).

## Assumptions

- The `scope` SHOULD is judged on the first source that names scopes, in the order given,
  because the server's own metadata speaks for the server most directly, the challenge next,
  and the authorization server only bounds what the server could ask for.
- Making `mcp.rs.scope-challenge` passive changes grades: a 401 without `scope` is a SHOULD
  `unsupported`, hence C at best. That is the published rule applied to a measured cell; the
  owner can keep the feature active if the atlas should not grade on it yet.
- Correcting stale listings is a data change to the server entity, not to observations; older
  observations keep citing the old URL, as the append-only rule wants.

> Superseded by 013-scanner-conformance: the `as.scopes` positive fallback is removed.
> When only the AS advertises scopes, the resource check is `unknown` via `prm.silent`.
