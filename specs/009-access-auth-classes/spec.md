# Feature Specification: Server access and auth classes

**Feature Branch**: `claude/project-thread-89arw2`

**Created**: 2026-10-17

**Status**: Implemented (pull request open)

**Input**: Roadmap item 009: "Today the atlas mixes servers anyone can connect to with ones that
need an account, tenant or enterprise contract, and OAuth servers with API-key and open ones,
using only the directory's unverified `authClaimed`. Make access (public or closed) and auth
(OAuth, API key, none) first-class, evidenced fields; let the atlas group and filter by them; and
let the scanner and the grade use them instead of the claim."

## What the atlas mixes today

Every listed server carries one word copied from the directory it was seeded from
(`authClaimed`: `oauth2.1`, `oauth2.1-no-dcr`, `api-key`, `open`). That word decides, today,
which servers the nightly scanner skips and which read "No OAuth" in the atlas. Nobody checked
it, it says nothing about who may connect, and it mixes two questions:

- **Access**: can anyone connect? Most servers need an account, but a GitHub or Notion account is
  a sign-up form, while a Stack Overflow for Teams, Ramp or Zoom connection needs an existing
  customer relationship, an admin, or a plan. A reader comparing servers wants to know which ones
  they could try this afternoon.
- **Auth**: how does the endpoint authenticate the client? OAuth as the MCP specification
  profiles it, a pasted API key or token, or nothing at all. Only the first is what the
  authorization matrix measures; the other two have nothing for the scanner to grade, and
  showing their rows as a wall of `unknown` reads as a failure to measure rather than as nothing
  to measure.

Both are facts about the server as a whole, not about one requirement of one revision, so they
do not fit an observation. Both have to carry evidence, a date and a method like every other
statement the site makes (constitution III), so they do not fit a bare enum either.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A reader filters the atlas to servers they could connect to (Priority: P1)

A reader opens the MCP auth atlas, picks "Access: public" and "Auth: OAuth", and sees only the
servers anyone can connect to with an OAuth authorization. Each server row shows its two classes
as small pills; a class nobody has stated yet is drawn dashed, as an unknown. The reader can also
group the rows by access or by auth, with a header per group and a count, and the rows stay
alphabetical inside each group. The filters, the grouping and the search are in the URL, so the
view can be shared.

**Why this priority**: This is the roadmap's reason for the feature: a reader cannot tell today
which listed servers they could reach.

**Independent Test**: Open `/atlas/mcp/?access=public&auth=oauth`; confirm every visible row
carries those two classes and the count line says how many of the listed servers remain. Open
`/atlas/mcp/?group=auth`; confirm one header row per class present, rows alphabetical within
each. Disable JavaScript; confirm the full alphabetical matrix renders with the pills.

**Acceptance Scenarios**:

1. **Given** the atlas with servers of several classes, **When** the reader selects an access
   class, **Then** only rows of that class remain and the count line reflects it; selecting an
   auth class narrows further; "Reset" restores everything.
2. **Given** a server file without an `access` or `auth` statement, **When** its row renders,
   **Then** the pill reads "unknown", is drawn dashed, and the row matches the filter value
   `unknown`, never a stated class.
3. **Given** the reader picks "Group rows: by access", **When** the table updates, **Then** a
   header row names each class present with its count, rows inside a group are alphabetical, and
   hidden rows (filtered out) do not count.
4. **Given** the same URL opened again, **When** the page loads, **Then** the controls and the
   view are restored from the query string.
5. **Given** JavaScript is off, **When** the page renders, **Then** every row is present in
   alphabetical order with its two pills, and the form submits as a plain GET.

---

### User Story 2 - A server page says who can connect and how, with evidence (Priority: P1)

A reader opens a server page and sees, next to the endpoint and transport, an "Access" and an
"Auth" line: the class, one sentence saying what the class means, and the statement behind it
(method, who recorded it, when, and the vendor page as evidence). The directory's own label stays
as what it is, a claim, below. A server nobody has classified says so.

**Independent Test**: Open the page of a classified server and confirm both lines, the evidence
link and the date; open the page of an unclassified server and confirm the "nobody has stated
this yet" wording and a dashed unknown.

**Acceptance Scenarios**:

1. **Given** a server with both statements, **When** the page renders, **Then** each line shows
   the class, the method, the handle, the date and a link to the evidence URL.
2. **Given** a server with no statement, **When** the page renders, **Then** the class reads
   "Unknown", marked as derived, with a sentence saying nobody has stated it yet.
3. **Given** the JSON export of the atlas or of a server, **When** a consumer reads a server,
   **Then** the two statements are present as written in the data, and absent when not written.

---

### User Story 3 - The scanner and the grade use the auth class, not the claim (Priority: P2)

The nightly run skips servers whose auth class is API key or no authentication and grades none
of them ("No OAuth", with the class in the reason). A server whose class is not yet stated is
scanned, and the run summary says what the endpoint's answer suggests (a 401 with a
`resource_metadata` pointer or a metadata document found: OAuth; a 200 to an unauthenticated
step: no authentication), so the maintainer can state the class with the scan as a pointer to
the vendor page. When the stated class and the suggestion disagree, the summary says so too. The
scanner never writes a class.

**Independent Test**: Over recorded responses, a server with `auth: api-key` is not in the
`--all` target list and reads "No OAuth" in the view; a server with no class is scanned and its
summary row carries the suggestion; a server with `auth: api-key` whose fixture answers a 401
with a pointer carries a disagreement note.

**Acceptance Scenarios**:

1. **Given** a server with `auth.class: api-key` or `none`, **When** the atlas and the report
   page render, **Then** the grade reads "No OAuth" and the reason names the class.
2. **Given** a server with `auth.class: oauth` or `unknown`, or no `auth` statement, **When**
   `pnpm scan --all` builds its target list, **Then** the server is included.
3. **Given** a scan whose endpoint answered 401 with a `resource_metadata` pointer, **When** the
   summary is written for a server whose class is not stated, **Then** the Notes column reads
   that the endpoint's answer suggests OAuth.
4. **Given** a scan whose endpoint accepted an unauthenticated request with 200, **When** the
   server's stated class is `oauth`, **Then** the Notes column names the disagreement; nothing is
   written to the server file or the observations.
5. **Given** a server file, **When** it is read, **Then** nothing about authentication comes from a
   directory label: `auth` with evidence is the only statement, and `authClaimed` is not in the model.

---

### Edge Cases

- A server offers OAuth and also accepts an API key (Stripe, GitHub): the class is `oauth`,
  because that is what the matrix measures, and the evidence note says the key is also accepted.
- A server uses an OAuth grant without user consent (Plaid's client credentials): the class is
  `oauth` and the server's `notes` field keeps saying what kind; the matrix cells say what the
  authorization server supports.
- A server admits only clients from a catalog it approves (Figma, Vercel): the person still
  connects with any account through a listed client, so access is `public` and the evidence note
  carries the catalog restriction; it is a fact about client authors, not about who can connect.
- A server is `closed` for access but `oauth` for auth (Box, Zoom): both are
  shown; access never changes what the scanner does, since the scanner reads only what the server
  publishes to everyone.
- A class statement cites a page that later changes: the statement is corrected in place by pull
  request with a newer `observedAt`; git is the history. Observations stay append-only; a class
  is not an observation.
- The scan suggests `none` because a landing page answered 200 to the `GET`: the ladder's second
  step still runs when the `GET` was routed elsewhere, and the suggestion is a note the maintainer
  checks against the vendor page, never a status.
- A server with `transport: stdio-only` or `withdrawn`: unchanged; its classes render on its page
  like any other field.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Server entity MUST gain two optional fields, `access` and `auth`, each a
  Classification `{ class, method, evidence, observedAt, observedBy }` with `method` and
  `evidence` as on an observation; `access.class` is one of `public`, `closed`, `unknown`;
  `auth.class` one of `oauth`, `api-key`, `none`, `unknown`. The schema MUST reject a statement
  missing any of its five fields.
- **FR-002**: A server without a statement MUST render as a derived `unknown`, visibly distinct
  from a stated `unknown`, on the matrix and the server page, and MUST match the filter value
  `unknown`.
- **FR-003**: The matrix MUST let a reader filter rows by access class and by auth class, and
  group rows by either, with the state in the URL; rows MUST stay alphabetical within a group,
  and the page MUST render the full alphabetical matrix with the classes without JavaScript.
- **FR-004**: The server page MUST show each class with its meaning, method, handle, date and
  evidence; a server nobody classified MUST read as a derived unknown.
- **FR-005**: The scanner's target list and the grade MUST use `auth.class`:
  `api-key` and `none` are not scanned and read "No OAuth" with the class in the reason; `oauth`,
  `unknown` and a missing statement are scanned.
- **FR-006**: The scan report MUST carry an `authSuggestion` derived from the probe (`oauth`,
  `none` or null), and the run summary MUST name it when the server's class is not stated or
  disagrees with it. The scanner MUST NOT write a class.
- **FR-007**: The seeded statements MUST each cite a vendor page (or, where none settles the
  question, say so and state `unknown`), carry a date and a handle, and MUST NOT be copied from
  the directory's label under `method: manual`. The label (`authClaimed`) is removed from the
  schema and from every server file; git history keeps what the directory said.
- **FR-008**: The JSON exports MUST carry the two fields as written; `docs/data-model.md`,
  `docs/atlas-maintenance.md` and `docs/scanner.md` MUST describe them and the scanner's use of
  them.

### Key Entities

- **Server** gains `access` and `auth` (FR-001) and loses `authClaimed` (FR-007).
- **Classification**: a dated, evidenced statement about the server as a whole. Not an
  observation; corrected in place.
- **Report** (scanner) gains `discovered.authSuggestion`; the run summary gains a note.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every listed server renders two class pills on the matrix and two lines on its
  page; a reader can reach a view of only public OAuth servers in two selections.
- **SC-002**: After seeding, at least 30 of the 39 listed servers carry a stated `auth` with a
  vendor page as evidence; every server without one reads as derived unknown, never as a class.
- **SC-003**: Scanning and grading decide on `auth.class` alone; a missing or `unknown` class is
  scanned and graded like OAuth (verified by unit tests over `latestScan` and `hasNoOAuth`).
- **SC-004**: Over recorded responses, `authSuggestion` is `oauth` for every fixture with a
  challenge pointer or a metadata document, `none` for a fixture answering 200, and null for a
  bare 401 or a failure (verified by unit tests).
- **SC-005**: The matrix and server pages keep their accessibility and performance budgets; the
  matrix island stays under the JavaScript budget.

## Assumptions

- Two classes, not three: the roadmap names access (public or closed) and auth (OAuth, API key,
  none). "Needs an account you can create yourself" is `public`; the line is self-service.
- The classes live on the server file, not as observations, because they are about the server as
  a whole and are not tied to a revision or a requirement; the constitution's demand for method,
  evidence and date is met by the Classification shape.
- The scanner suggests but never writes a class: a 401 is not proof of OAuth (a bearer challenge
  may guard an API key), so the vendor page stays the evidence and a person states the class.
- `authClaimed` goes. Once `auth` carries an evidenced class, a second, unevidenced word about
  authentication is one field too many; the owner asked to keep the model simple.
