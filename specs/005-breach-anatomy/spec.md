# Feature Specification: Breach Anatomy

**Feature Branch**: `claude/breach-anatomy-6g6j4l`

**Created**: 2026-10-17

**Status**: Implemented (pull request open)

**Input**: Roadmap item 005: "Each agent-auth vulnerability as a scenario replay plus a
reproducible lab. Cheap once 003 exists."

## What a breach anatomy is

A reader opens an entry and sees, in this order: what failed, in the vocabulary the atlas and
the explorer already use; the facts the advisory states (class, disclosure date, the fix, what
was affected, the sources); the requirements in the MCP auth atlas that stand for the control
that was missing, each with its level, its citation and how many listed servers support it
today; and the toggle in the delegation chain explorer that turns the same pattern on in a
baseline chain. The index lists every entry newest first.

An entry is written from a public advisory or a vendor's own notice and says nothing beyond
it. The site is static, cites everything, and ranks nobody (constitution II, III, IV); it ships
no exploit recipes. The "reproducible lab" the roadmap names is therefore the explorer replay:
a reader can step through the chain with the control removed and read the token at each hop.
A runnable lab is out of scope for this feature and for the site as it is constituted.

Entries are data (`data/vulnerabilities/`, one file each) on the shared model's Vulnerability
entity, which 003 added to the schema but did not render. The model gains what a page needs
(a summary, dates, a fix) and a rule that a replay points both ways.

## Honesty tests

- **Not summarisable**: the value is the trace from a specific advisory to a specific atlas
  requirement and a specific explorer toggle, with today's support counts from the dataset. A
  language model can summarise the advisory; it cannot say which listed servers meet the
  control it names.
- **Compounding**: every entry links feature pages and toggle pages that already exist, and
  makes them more useful (a feature page now has a reason to exist beyond the matrix). A breach
  class that no requirement covers is itself a finding about the atlas.
- **One maintainer**: an entry is one YAML file with a handful of fields; the build fails on a
  feature or scenario that does not exist and on a replay that does not point back. The three
  replays are toggles on an existing scenario.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read what broke, newest first (Priority: P1)

A reader opens `/breaches/` and sees every entry as a card, newest disclosure first: its class
as a pill, the disclosure date, its id, its title, the product it affected, the atlas
requirements it names (or a line saying none covers it yet) and, where one exists, a link to the
replay. The page reads fully without JavaScript; it has none.

**Why this priority**: The list is the product's front door and the roadmap's promise.

**Independent Test**: Open `/breaches/`; confirm one card per file under `data/vulnerabilities/`
in disclosure order, each linking to its page, with the replay link where the data names a
scenario.

**Acceptance Scenarios**:

1. **Given** five entries, **When** the index renders, **Then** five cards appear newest first
   (ties by id), each with class, date, title and the first affected product.
2. **Given** an entry with a scenario, **When** its card renders, **Then** the card links to
   `/explorer/<scenario>/<toggle>/` for the toggle that names the entry.
3. **Given** an entry with no features, **When** its card renders, **Then** it says no atlas
   requirement covers the control yet, never an empty list.

---

### User Story 2 - Trace one breach to the missing control (Priority: P1)

A reader opens `/breaches/<id>/` and reads the summary, the facts, every source as a link, then
"The control that was missing": one card per named requirement with its name, party, level,
citation and the atlas counts under the current MCP Authorization revision (or the reason the
atlas does not observe it). Then "Replay in the explorer": the scenario and toggle, the toggle's
summary, how many baseline steps change, its citation and the requirements it defeats; or a
sentence saying no replay exists yet.

**Independent Test**: Open the page of an entry with features and a replay; confirm each
feature card links to its atlas page and cites a resolved document, the counts line is present,
and the replay link resolves to a toggle page whose notice names the same requirements. Open an
entry without a replay; confirm the plain sentence.

**Acceptance Scenarios**:

1. **Given** an entry naming an authorization-server requirement, **When** the page renders,
   **Then** its card shows the counts of listed servers that support, partially support, do not
   support or are unknown for it.
2. **Given** an entry naming a client requirement, **When** the page renders, **Then** its card
   says the atlas does not observe clients, not a count of zero.
3. **Given** an entry with a scenario, **When** the page renders, **Then** the replay section
   links the toggle page and that toggle's `vulnerability` is this entry's id.
4. **Given** an entry without a scenario, **When** the page renders, **Then** the replay section
   says so in one sentence and shows no link.

---

### User Story 3 - Open the data (Priority: P2)

A consumer fetches `/breaches/data.json` and gets every entry as validated, in index order, with
the replay path or null, under CC BY 4.0.

**Acceptance Scenarios**:

1. **Given** the build, **When** `/breaches/data.json` is fetched, **Then** `version` is 1,
   `license` is the data licence, and `vulnerabilities[]` matches the index order with a
   `replay` field per entry.

---

### Edge Cases

- An entry names a scenario but no toggle of that scenario names it back: the build fails and
  names the file and field (data model rule 8). The reverse (a toggle naming an entry that
  points at another scenario, or none) fails the same way.
- An entry names no feature: allowed; the page says no atlas requirement stands for the control
  yet. The atlas gains a requirement when a specification revision states one, not because a
  breach needs a hook.
- Two entries disclosed on the same day: ordered by id, so the list is stable.
- An incident with no CVE (Asana, Salesloft): the id is a slug, the date is the vendor's or the
  first authoritative notice, and the class says what kind of control failed; the summary says
  what the vendor published and no more.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Vulnerability entity MUST gain `summary` (string), `disclosed` (date) and
  `fixed` (string, optional); `affects` and `sources` MUST have at least one entry; the class
  enum MUST cover the recorded breaches (`redirect-uri`, `pkce-bypass`, `untrusted-metadata`,
  `tenant-isolation`, `token-theft` added).
- **FR-002**: `/breaches/` MUST list every entry newest first (ties by id) with class, date,
  title, first affected product, named requirements and the replay link where one exists.
- **FR-003**: A replay MUST be a toggle of the named scenario whose `vulnerability` is the
  entry's id; the validator MUST fail when either side does not point back.
- **FR-004**: `/breaches/<id>/` MUST show the summary, class, dates, fix, affected products and
  sources; one card per named requirement with level, citation and atlas counts or the reason
  none exist; and the replay or a sentence that none exists.
- **FR-005**: The three replays MUST be toggles on `mcp-authorization` citing a revision and
  section, naming the entry, and (where the atlas has one) the requirements they defeat.
- **FR-006**: `/breaches/data.json` MUST carry every entry as validated plus a `replay` path.
- **FR-007**: The product MUST be in the primary navigation and the footer, on the about page,
  in the README and in the Lighthouse budget list.

### Key Entities

- **Vulnerability** (amended): see `data-model.md`.
- **Toggle** (unchanged): `vulnerability` now must point back.

## Success Criteria *(mandatory)*

- **SC-001**: Five entries ship, three with a replay, each written from a linked advisory.
- **SC-002**: Every page reads without JavaScript, passes the axe checks and has no horizontal
  scroll at phone width; the two new URLs meet the Lighthouse budgets.
- **SC-003**: The validator names file and field for a replay that does not point back (unit
  test over the bad-data fixture).

## Assumptions

- The lab is the replay. A static site that cites and ranks nothing ships no exploit recipes; the
  roadmap row says so now. If the owner wants runnable labs, that is a new feature with its own
  spec and a backend decision, not a field on this entity.
- Classes are added as the recorded breaches need them, one each, rather than forcing five
  entries into `other`. A class names the kind of control that failed; it does not rank
  severity.
- Entries are corrected in place by pull request (git keeps history); they are not append-only
  observations.
