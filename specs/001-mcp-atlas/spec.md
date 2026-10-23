# Feature Specification: MCP Atlas

**Feature Branch**: `001-mcp-atlas`

**Created**: 2026-10-13

**Status**: Draft

**Input**: User description: "MCP Atlas: a matrix of public MCP servers against the features of the current MCP authorization spec revision"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse the support matrix (Priority: P1)

An engineer choosing or integrating an MCP server opens the atlas and sees a matrix: one row per
public MCP server, one column per feature of the current MCP authorization revision (for example
Client ID Metadata Documents, PKCE S256, resource indicators, issuer validation, protected
resource metadata). Each cell shows a status (supported, partial, unsupported, unknown, not
applicable), how that status was established, and when. Opening a cell shows the evidence.

**Why this priority**: This is the product. Without the matrix nothing else on the page has a
reason to exist, and the matrix alone answers the question people come with.

**Independent Test**: Load the atlas with a seeded set of servers and observations, confirm every
server and every feature of the current revision appears, and confirm each cell's status, method
and date match the underlying observation and link to its evidence.

**Acceptance Scenarios**:

1. **Given** at least one server and the current revision's features exist, **When** a visitor
   opens the atlas, **Then** they see the full matrix with a status in every cell and the revision
   it is judged against named at the top.
2. **Given** a cell has an observation, **When** the visitor opens the cell, **Then** they see the
   status, the method (manual, vendor claim, passive scan, active scan), the date, who observed it
   and the evidence link or note. *(Amended 2026-10-23: the cell is a link to that feature's row on
   the server's page, which shows all of these; the matrix no longer carries an inline copy of
   each record, which made up most of its weight.)*
3. **Given** a server has no observation for a feature, **When** the matrix renders, **Then** the
   cell reads "unknown" and is visually distinct from "unsupported".
4. **Given** the visitor filters by feature level or category, or searches by server name,
   **When** they apply the filter, **Then** the matrix narrows accordingly and the filter state is
   shareable by link.

---

### User Story 2 - Read one server's profile (Priority: P2)

A visitor opens a server's page and sees everything known about it: its endpoint and transport,
every feature with its current status, and the history of observations for each feature in
date order, so they can see how support changed over time.

**Why this priority**: Server pages are the pages people link to and search engines index. They
turn the matrix into a reference.

**Independent Test**: Open a server page for a server with several observations per feature and
confirm the current status matches the newest observation and the history lists the older ones.

**Acceptance Scenarios**:

1. **Given** a server with multiple observations for one feature, **When** the visitor opens the
   server page, **Then** the current status is the newest observation and all earlier ones are
   listed with their dates and methods.
2. **Given** a server page, **When** the visitor wants to correct something, **Then** they find a
   clear path to contribute a correction (see User Story 4).

---

### User Story 3 - Read one feature's definition and adoption (Priority: P3)

A visitor opens a feature page and sees the plain-language definition, the requirement level
(MUST, SHOULD, MAY, deprecated), a link to the exact section of the spec revision that defines
it, and which servers support it, including the share of servers with a known status.

**Why this priority**: Feature pages are where the atlas teaches. They connect a matrix column to
the spec text, which is what makes the atlas trustworthy.

**Independent Test**: Open a feature page and confirm the citation resolves to the named revision
and section, and the server list and share match the matrix column.

**Acceptance Scenarios**:

1. **Given** a feature defined by a revision and section, **When** the visitor opens its page,
   **Then** the citation links to that revision's document and names the section.
2. **Given** some servers have unknown status for the feature, **When** the share is shown,
   **Then** unknowns are excluded from the denominator and the count of unknowns is shown.

---

### User Story 4 - Contribute or correct an observation (Priority: P4)

A contributor (a server maintainer, a vendor, or any reader) submits a new or corrected
observation with evidence. The submission is reviewed before it appears. If the submission is
incomplete (missing evidence, unknown server or feature, invalid status), the contributor is told
exactly what is missing before review.

**Why this priority**: The atlas stays correct only if correction is easier than complaining.
Contributions also seed the opt-in list for later active scanning.

**Independent Test**: Submit an observation with a missing evidence field and confirm it is
rejected with a message naming the field; submit a complete one and confirm it appears after
review as the newest observation for that cell.

**Acceptance Scenarios**:

1. **Given** a contributor submits an observation without evidence, **When** it is checked,
   **Then** it is rejected and the message names the missing field.
2. **Given** a complete observation is accepted, **When** the atlas is next published, **Then** the
   cell shows the new status and the previous observation moves to history.
3. **Given** a server maintainer asks for their server to be removed, **When** the request is
   accepted, **Then** the server no longer appears in the matrix and its page says it was
   withdrawn at the maintainer's request.

---

### User Story 5 - View the matrix against another revision (Priority: P5)

A visitor switches the atlas to a previous revision of the authorization spec and sees the
matrix as judged against that revision, plus which features changed level between the two
revisions (for example Dynamic Client Registration moving from recommended to deprecated).

**Why this priority**: Spec revisions are the main cause of confusion in this field. The switcher
turns a snapshot into a record of change, but the atlas is useful without it.

**Independent Test**: With two revisions and observations against each, switch between them and
confirm the feature columns and cell statuses change accordingly and the changed-level features
are listed.

**Acceptance Scenarios**:

1. **Given** two revisions exist, **When** the visitor selects the older one, **Then** the matrix
   shows that revision's features and the observations judged against it.
2. **Given** a feature changed level between revisions, **When** the visitor views the newer
   revision, **Then** the feature column is marked as changed with the old and new levels.

---

### Edge Cases

- A server becomes unreachable or is shut down: its row stays, its page states the last date it
  was reachable, and no observation is silently changed.
- A feature is deprecated or removed in a new revision: it remains in the older revision's
  matrix and is marked deprecated or removed in the newer one, never deleted.
- Two observations for the same server and feature carry the same timestamp: the one with the
  stronger method wins (active scan over passive scan over manual over vendor claim), and both
  remain in history.
- A server only offers a local transport and the feature concerns remote authorization: the
  cell reads "not applicable", not "unsupported".
- A server has no observations at all: it appears with every cell "unknown" and the page invites
  contributions.
- A vendor claim contradicts a scan: the newer observation is current, whichever method it has,
  and the other stays in history with its method visible, so a reader can always see that the
  two disagree.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The atlas MUST render one row per listed server and one column per feature of the
  selected revision, with a status in every cell.
- **FR-002**: Every cell MUST expose its status, method, observation date, observer and evidence.
- **FR-003**: Status values MUST be exactly: supported, partial, unsupported, unknown, not
  applicable. "Unknown" MUST be rendered distinctly from "unsupported".
- **FR-004**: The current status of a cell MUST be the newest observation for that server and
  feature against the selected revision; all older observations MUST remain available as history.
- **FR-005**: Every feature MUST cite the revision and section that defines it, and the citation
  MUST resolve to the revision's document.
- **FR-006**: The atlas MUST name the revision it is judged against and MUST allow switching to
  any other revision that has features defined.
- **FR-007**: The atlas MUST list, for the selected revision, which features changed level from
  the previous revision.
- **FR-008**: Visitors MUST be able to filter by feature category and level and search by server
  name, and the resulting view MUST be shareable by link.
- **FR-009**: Each server MUST have its own page, and each feature MUST have its own page, each
  reachable by a stable address.
- **FR-010**: Contributions MUST be checked for a known server, a known feature, a valid status,
  a method, a date and evidence before review, and a failed check MUST name the missing or invalid
  field.
- **FR-011**: Observations MUST be append-only. Corrections are new observations; nothing is
  edited or deleted except on a maintainer's withdrawal request.
- **FR-012**: A server MUST record why it is listed (opted in, taken from a public directory, or
  added by the maintainer), and this MUST be visible on its page.
- **FR-013**: The atlas MUST publish its underlying data in a machine-readable form at a stable
  address so others can reuse it.
- **FR-014**: Nothing in the atlas MUST rank servers by anything other than the data shown, and
  the atlas MUST NOT display any vendor-supplied scoring.

### Key Entities

Defined in the shared data model (`docs/data-model.md`); the atlas reads and writes these and
adds none of its own.

- **Spec / Revision**: the MCP authorization specification and its dated revisions, one of which
  is current.
- **Feature**: a capability or requirement defined by a revision and section, with a level and a
  category.
- **Server**: a public MCP server listed in the atlas, with why it is listed.
- **Observation**: a dated, attributed, evidenced statement about one server and one feature
  against one revision.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At launch, the atlas lists at least 30 public MCP servers against every feature of
  the current revision, and no cell is empty.
- **SC-002**: 100% of features carry a citation that resolves to the named revision and section.
- **SC-003**: A first-time visitor can find a named server's status for a named feature within
  30 seconds without instructions.
- **SC-004**: The matrix page is usable within 2 seconds on a mid-range phone over a slow mobile
  connection.
- **SC-005**: A contributor can submit a correction without contacting the maintainer, and an
  incomplete submission is rejected with a message naming the problem before any human reviews
  it.
- **SC-006**: No cell ever renders a missing observation as "unsupported" (verified by a test
  that seeds a server with no observations).
- **SC-007**: Every change to the data is attributable to a person or a named automated
  process, with a date and evidence.

## Assumptions

- The initial server list is curated by the maintainer from public MCP server directories and
  vendor documentation, with an opt-out path for maintainers of listed servers. Opt-in listing is
  available from day one and becomes the preferred path once the scanner exists.
- Initial observations are entered by hand from public metadata and documentation ("manual" and
  "vendor-claim" methods). Automated observation is a separate feature (the scanner) and is out of
  scope here.
- Only the MCP authorization specification is covered. Other agent protocols are out of scope for
  this feature; the standards atlas is a separate feature.
- Visitors are not identified. Contributors are identified by the public handle attached to their
  contribution.
- The atlas is read-only for visitors; contributions go through review before publication.
- No server is ever contacted by the atlas itself in this feature.
