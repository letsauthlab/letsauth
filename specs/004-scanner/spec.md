# Feature Specification: Scanner

**Feature Branch**: `004-scanner`

**Created**: 2026-10-14

**Status**: Draft · revised 2026-10-14 on the owner's decisions: no on-demand scanning, the nightly run is a Scaleway job, its deployment is a dedicated workflow

**Input**: User description: "Scanner: automates what the MCP Atlas (001) did by hand. Passive checks on public metadata, graded report, nightly PR with observations. First and only backend."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Wake up to a pull request of fresh observations (Priority: P1)

The maintainer no longer reads vendor documentation to fill the MCP auth atlas. Every night a
scanner reads the public authorization metadata of every listed server with an HTTP transport,
judges each passively observable requirement of the current MCP Authorization revision, and
opens one pull request that appends the results as observations, each with the metadata URL it
read as evidence. Nothing is merged without review; nothing is written to the data outside a pull
request; nothing is edited in place. A run that finds nothing new opens no pull request and says
so in its log.

**Why this priority**: This is the roadmap's definition of the feature ("automates what 001 did
by hand"). The atlas was seeded from documentation, which goes stale and often says nothing; the
scanner turns 12 of the 20 server-side requirements into measured, dated, re-checkable cells.

**Independent Test**: Run the scanner over the listed servers against recorded metadata
responses; confirm it produces one observation per passively observable requirement per server,
each citing the revision and section, with method `passive-scan`, observer `scanner@<version>`
and a URL as evidence; confirm that a second run over the same responses appends nothing; confirm
that a run where one server's metadata changed appends exactly the changed cells; confirm that an
unreachable server yields `unknown`, never `unsupported`.

**Acceptance Scenarios**:

1. **Given** a listed server whose protected resource metadata and authorization server metadata
   are reachable, **When** the nightly run completes, **Then** the pull request appends one
   observation per passively observable requirement with `status` derived from the metadata,
   `method: passive-scan`, the metadata URL as `evidence`, the current revision as `revision`,
   and a timestamp.
2. **Given** a server whose metadata cannot be fetched (timeout, connection refused, TLS
   failure), **When** the run completes, **Then** every requirement that depends on that
   document is recorded as `unknown` with the failure named in the evidence, and no cell is
   recorded as `unsupported` because of it.
3. **Given** a server whose current cell for a requirement already comes from the scanner with
   the same status and evidence, **When** the run completes, **Then** no new observation is
   appended for that cell.
4. **Given** a server whose current cell comes from documentation (`vendor-claim`) or a manual
   check, **When** the scanner judges the same requirement, **Then** a new observation is
   appended even when the status agrees, so the cell is now measured and dated.
5. **Given** a run that appends at least one observation, **When** it finishes, **Then** one pull
   request exists against `main` whose description lists each server scanned, the cells that
   changed, and the cells that could not be judged; CI runs the usual validation and the
   append-only check on it.
6. **Given** a run that appends nothing, **When** it finishes, **Then** no branch and no pull
   request are created.
7. **Given** a server with `transport: stdio-only` or a `withdrawn` entry, **When** the run
   starts, **Then** that server is not contacted.

---

### User Story 2 - Read a server's scan report (Priority: P2)

A visitor opens a server's report and sees, for the current revision, every requirement the
scanner can judge from public metadata: what was checked, which document and field decided it,
the status, when it was last confirmed, and the requirement's level and citation. The report
carries a grade computed from those results by a published rule, with the reasons listed under
it. A requirement the scanner could not judge is shown as unknown and never counts against the
server. A server that has not been scanned yet says so. The grade shows where the server already is:
next to its name in the atlas matrix and on its atlas page, each linked to the report. The
scanner page itself keeps no list of servers.

**Why this priority**: The roadmap asks for a graded report; the positioning research calls the
product "SSL Labs for MCP auth". The report is where measured data becomes legible for the
engineer who runs a server, and the grade is what gets fixed.

**Independent Test**: With a server that has scanner observations for every passively observable
requirement, open its report and confirm the grade matches the published rule applied to those
statuses, every check shows status, evidence link, date, level and citation, and the atlas matrix
shows the server with the same grade; with a server without scanner observations, confirm the report
says no scan has been recorded and shows no grade; with a server whose MUST-level cell is
unknown, confirm no letter grade is shown and the reason is named.

**Acceptance Scenarios**:

1. **Given** a server with scanner observations under the current revision, **When** the visitor
   opens its report, **Then** each passively observable requirement is listed with its level,
   citation, status, evidence link and the date of the newest scanner observation for it.
2. **Given** the same server, **When** the report renders, **Then** it shows a grade with the
   rule's reasons (which MUST or SHOULD requirements are unsupported or unknown), and the grade
   equals the published rule applied to the shown statuses.
3. **Given** a server where a MUST-level requirement is unknown, **When** the report renders,
   **Then** no letter grade is shown, the report says the grade is withheld and names the unknown
   requirement.
4. **Given** a server without any scanner observation, **When** the visitor opens its report,
   **Then** the report says no scan has been recorded, shows no grade, and links to the
   documentation-based cells on the server's atlas page.
5. **Given** the atlas matrix, **When** it renders, **Then** every listed server carries its latest
   grade (or "not scanned" / "no OAuth") next to its name, linked to its report, the rows stay
   alphabetical, and nothing is sorted or ranked by grade.
6. **Given** JavaScript is disabled, **When** either page renders, **Then** every report, grade,
   rule and link is present.

---

### User Story 3 - removed: on-demand scanning (2026-10-14)

The first draft of this specification had a third story: a visitor enters any MCP server URL on
`/scanner/` and an HTTP service scans it on demand. The owner removed it on 2026-10-14: scanning
triggered by random visitors is a feature the project must not have. All scanning happens in
scheduled backend jobs under the project's control, and the only thing a run produces is data
that flows back into the repository by pull request (FR-010). The story number is kept so that
task and scenario numbers stay stable; nothing of it is built.

---

### User Story 4 - Run the scanner yourself (Priority: P4)

A contributor runs one command against a server URL or a listed server id and sees the report in
the terminal. With a flag, the command appends the observations for a listed server to its data
file, in the same format and with the same rules the nightly run uses, so a pull request can be
opened by hand. The same command is what the nightly run and the container image execute.

**Why this priority**: One maintainer with agent support has to be able to reproduce any cell the
scanner wrote, and the contribution path for scanner data should be the same tool, not a parallel
one.

**Independent Test**: Run the command against the fixture server and a listed server id;
confirm the report in the terminal matches the report page's checks and grade; run it with the
write flag against a scratch copy of the data and confirm the appended entries validate and the
append-only check passes.

**Acceptance Scenarios**:

1. **Given** a server URL, **When** the command runs, **Then** it prints the report (checks,
   statuses, evidence, grade and reasons) and exits zero.
2. **Given** a listed server id and the write flag, **When** the command runs, **Then** the
   observations that the nightly rule would append are appended to that server's data file, and
   `pnpm validate:data` and the append-only check pass afterwards.
3. **Given** a URL that is refused by the public-host rules, **When** the command runs, **Then**
   it prints the reason and exits non-zero.

---

### Edge Cases

- The protected resource metadata is not at either well-known location: the well-known
  requirement is unsupported (it is a MUST), the "metadata served" requirement is unknown (the
  document may be announced only in a challenge the passive scan does not provoke), and every
  authorization-server check is unknown because no authorization server was discovered.
- The metadata lists several authorization servers: the first is checked and the report names the
  others as not checked; a later revision of the scanner may check all of them.
- The authorization server metadata is found under one well-known location but not the others:
  found is found; the report names the location.
- The metadata document is served with the wrong content type but parses as JSON: it is used and
  the report notes the content type. A document that does not parse is "not found" at that URL.
- A redirect leads to a different host or to plain HTTP: the fetch is treated as failed and the
  check is unknown, with the redirect target named.
- A server answers slowly or not at all: the fetch times out and the check is unknown.
- A server returns an error status (5xx) for the well-known URL: unknown, not unsupported, because
  the document may exist and the server may be unhealthy.
- The MCP endpoint URL has no path: the path-aware well-known URL and the root well-known URL are
  the same; it is fetched once.
- The scanner version changes: every cell is re-observed on the next run, because the observer
  string differs and the rule treats a cell written by an older scanner as not yet measured by
  this one.
- The current revision changes: observations cite the revision they were made against; the nightly
  run scans against the new current revision and the old cells stay under the old revision.
- Two listed servers share an authorization server: the metadata is fetched once per server,
  cached within a run, and each server's observations cite it.
- A listed server is withdrawn between runs: it is skipped; its earlier scanner observations stay
  in history.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The scanner MUST judge every feature of the current MCP Authorization revision whose
  `observable` is `passive` and whose `party` is the MCP server or its authorization server, and
  MUST NOT judge any other feature.
- **FR-002**: The scanner MUST send only `GET` requests, only over HTTPS, only to the well-known
  metadata locations derived from the server URL and from the discovered authorization server
  issuer, with no credentials, no cookies, no authorization flow, and MUST follow no redirect to
  another host or to plain HTTP.
- **FR-003**: Every status the scanner writes MUST be one of supported, partial, unsupported,
  unknown; a document that could not be fetched or parsed MUST yield `unknown` for every check that
  depends on it, with the failure named in the evidence; `unsupported` MUST be written only when
  a document was fetched and the required field or value is absent or wrong.
- **FR-004**: Every observation the scanner writes MUST carry `method: passive-scan`,
  `observedBy: scanner@<version>`, the revision and feature it judged against, the metadata URL it
  read as the start of `evidence`, and a short deterministic note of the field and value that
  decided the status, so two runs over the same responses produce byte-identical evidence.
- **FR-005**: The scanner MUST append an observation for a cell only when its own newest
  observation of that cell is absent, is from another scanner version, or differs in status or
  evidence from what it now sees; a newer manual or vendor-claim observation MUST stand until
  then, and the run summary MUST name every cell so held when it disagrees with the scan. The
  scanner MUST never edit or remove an existing observation. (Until 2026-10-16 the rule compared
  with the cell's current observation of any method, so a hand-recorded restriction was written
  over by the next night's advertisement.)
- **FR-006**: The nightly run MUST scan every listed server that is not withdrawn, has an HTTP
  transport and is not listed as open or API-key (those have no OAuth to judge), MUST open at most one pull request per run, MUST open none when nothing was
  appended, and the pull request description MUST list the servers scanned, the cells appended
  and the checks that could not be judged.
- **FR-007**: Each listed server MUST have a report page at a stable address showing, for the
  current revision, every passively observable requirement with its level, citation, status,
  evidence link and the date of the newest scanner observation, and the report MUST show a grade
  with its reasons or say why the grade is withheld; a server without scanner observations MUST
  say so and show no grade.
- **FR-008** *(superseded by 017-neutral-scan-summary, 2026-10-22: there is no grade; the report
  counts statuses per level)*: The grade MUST be derived only from the statuses the report shows, by this rule, and
  the rule MUST be published next to every grade: a MUST-level check that is unsupported or partial
  gives F; otherwise a MUST-level check that is unknown withholds the grade; otherwise a
  SHOULD-level check that is unsupported or partial gives C; otherwise a SHOULD-level check that is
  unknown gives B; otherwise A. MAY-level and deprecated requirements never affect the grade. A
  MUST the server may meet in either of two ways (protected resource metadata at a well-known
  location or in a `WWW-Authenticate` challenge) counts as unknown while the other way is unknown.
  A server listed as open or API-key is not graded ("No OAuth").
- **FR-009** *(the grade part superseded by 017-neutral-scan-summary: the matrix links the report
  and shows no grade)*: The atlas matrix MUST show each listed server's latest grade (or that it is not
  scanned or not graded) next to its name, linked to its report, and the site MUST NOT order or
  rank servers by grade anywhere. The scanner page MUST NOT carry a second list of servers; it
  describes the method and points at the atlas.
- **FR-010**: All scanning MUST run in a scheduled job on the project's own backend (Scaleway, EU
  region) under the maintainer's control. The site MUST NOT offer visitors any way to trigger a
  scan, no HTTP endpoint MUST accept URLs from outside, and the only output of a run MUST be data
  that flows back into the repository by pull request. The job MUST refuse to fetch URLs that are
  not HTTPS, that resolve to private, loopback, link-local or otherwise non-public addresses,
  that carry credentials or a port, or that are malformed, whether the URL is a listed server's
  or an issuer found in metadata.
- **FR-011**: The job's image MUST reach Scaleway only through a dedicated deployment workflow in
  the repository, run after CI has passed on `main` for a commit that touches the scanner, or by hand, which builds the
  image, pushes it to the project's registry and points the job definition at it. The job's
  schedule, resources and secret are configured once by the owner, outside the image and the
  repository.
- **FR-012**: One command MUST run the scanner against a URL or a listed server id, print the
  report, and with a flag append the observations the nightly rule would append; the nightly run
  and the container image MUST use that same command.
- **FR-013**: The report MUST be available as JSON at a stable address per listed server, with
  one documented shape and a version field, built from the repository's observations alone.
- **FR-014**: The scanner MUST identify itself in a `User-Agent` header that names the project and
  links to a page explaining what it does and how to opt out.
- **FR-015**: Nothing the scanner does MUST contact a server during the site build; the site reads
  scanner results only from the repository's data.

### Key Entities

Defined in the shared data model (`docs/data-model.md`); the scanner reads Server, Feature, Spec
and Revision and writes Observation. It adds no entity. A report is a derived view: the set of
newest scanner observations per (server, feature) under the current revision, plus a grade
computed from them at render time.

- **Observation** (written): one dated statement per server and feature with method
  `passive-scan`, observer `scanner@<version>`, evidence starting with the metadata URL.
- **Report** (derived, not stored): target, revision, the checks with their statuses and evidence,
  the requests made, the documents discovered, and the grade with reasons.
- **Grade** (derived): a letter A, B, C or F, or withheld, with the reasons that produced it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After the first nightly run, every listed OAuth server with an HTTP transport has a
  scanner observation for each of the 12 passively observable requirements of the current
  revision, each with a URL as evidence, and `pnpm validate:data` and the append-only check pass
  on the pull request.
- **SC-002**: 100% of scanner observations with status `unsupported` cite a document that was
  fetched; 100% of fetch failures are recorded as `unknown` (verified by unit tests over recorded
  responses, including timeouts and error statuses).
- **SC-003**: A second run over unchanged responses appends zero observations (verified by a unit
  test).
- **SC-004**: The grade on every report equals the published rule applied to the shown statuses
  (verified by a unit test over every combination of levels and statuses).
- **SC-005**: One nightly run finishes within 30 minutes for every listed server and opens at most
  one pull request; a second run on the same day updates that pull request instead of opening
  another.
- **SC-006**: The scanner sends requests only to HTTPS well-known metadata URLs on public hosts
  (verified by unit tests that record every request made for fixture servers, private addresses
  and redirecting responses).
- **SC-007**: Report pages and the scanner page meet the site's budgets: Lighthouse performance and
  accessibility at or above 95, no horizontal scroll at phone width, no serious accessibility
  violation.
- **SC-008**: Every cell the scanner wrote is reproducible by one command from the repository
  (verified by running the command against a listed server and comparing with the report page).

## Assumptions

- Passive means: public metadata only. The scanner reads the protected resource metadata at the
  two well-known locations RFC 9728 and the MCP specification derive from the server URL, and the
  authorization server metadata at the well-known locations RFC 8414 and OpenID Connect Discovery
  derive from the issuer. It never sends a request to the MCP endpoint itself, so the
  `WWW-Authenticate` challenge and every token-handling requirement (`observable: active`) stay out
  of scope; they belong to a later feature with owner verification.
- The nightly run is a Scaleway Serverless Job in an EU region, as the constitution's technology
  constraints say, built from the repository's `Dockerfile` and deployed by the dedicated
  workflow (FR-011). It never runs on GitHub's runners: the scan is not part of building or
  testing the repository. Until the owner has created the Scaleway project, the job and its
  secret, no scan runs and every report page reads "not scanned".
- The job stores nothing outside the repository; results exist only as observations in `data/`.
  Shareable report URLs for arbitrary servers are out of scope, since nothing is scanned for
  anyone but the atlas.
- Active probes and owner verification (proving control of a server to run requests against its
  endpoint) are out of scope for this feature.
- The grade is a property of one report at one time, computed from data in the model by a
  published rule; it is shown on report pages, on atlas server pages and next to the server name
  in the atlas matrix, never used to sort or rank servers.
- The scanner judges against the current revision only. Older revisions are not re-scanned.
- When the metadata lists several authorization servers, the first is judged in this revision of
  the scanner.
- `partial` is written only for the HTTPS check when some but not all endpoints use HTTPS.
- Evidence strings are deterministic: they contain the URL, the HTTP status, and the field and
  value that decided the status, and never a timestamp or a request id.
- No visitor data exists anywhere in this feature: the pages are static and nothing on them
  sends a request on a visitor's behalf.
