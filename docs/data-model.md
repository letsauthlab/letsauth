# Shared Data Model

This is the one model every letsauth.eu product reads and writes (Constitution, Principle I).
The normative version is the Zod schema that implements it; until that exists, this document is
the contract. Data lives as YAML under `data/`, one entity per file, and is validated at build
time.

```text
data/
├── specs/          # one file per spec (spec.yaml) with its revisions
├── features/       # one file per feature
├── relations.yaml  # edges between specs
├── servers/        # one file per public MCP server (or other agent endpoint)
├── observations/   # append-only, one file per server, a list of observations
├── scenarios/      # explorer scenarios
└── vulnerabilities/
```

## Entities

### Spec

A standard, draft or protocol document family. Example: the MCP authorization specification,
OAuth 2.0 Token Exchange, draft-hardt-oauth-aauth-protocol.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable kebab-case id, e.g. `mcp-authorization`, `rfc8693`, `aauth` |
| `name` | string | Display name |
| `body` | enum | `ietf-oauth`, `ietf-wimse`, `ietf-other`, `openid`, `mcp`, `a2a`, `vendor`, `eu`, `other` (CNCF, W3C and any body the list does not name) |
| `family` | enum | `protocol`, `profile`, `discovery`, `credential-format`, `regulation`, `guidance` (best current practice, architecture and threat-model documents that define no protocol) |
| `maturity` | enum | The publisher's status for the spec as a whole: `individual-draft`, `working-group-draft`, `candidate` (implementer's draft, last call), `published` (RFC, final specification, shipped revision), `in-force` (regulation), `expired`, `withdrawn`. Revision `status` keeps meaning which revision is shown by default. |
| `maturityNote` | string? | The publisher's own label, shown verbatim: "Proposed Standard", "Informational", "Implementer's Draft 2", "Regulation (EU) 2024/1183" |
| `summary` | string | One or two sentences |
| `url` | url | Canonical home |
| `revisions` | Revision[] | At least one; exactly one has `status: current` |

### Revision

A dated version of a spec. Features and citations point at revisions, never at bare specs.

| Field | Type | Notes |
|---|---|---|
| `id` | string | e.g. `2026-07-28`, `draft-09`, `rfc` |
| `date` | date | Publication date |
| `status` | enum | `draft`, `current`, `superseded`, `withdrawn`, `final` |
| `url` | url | Exact document for this revision |
| `supersedes` | string? | Previous revision id |
| `changes` | string? | Implementer-facing summary of what changed and what breaks |

### Feature

A discrete, testable capability or requirement defined by a revision. Example: "Client ID
Metadata Documents", "RFC 9207 `iss` validation", "Resource indicators (RFC 8707)".

| Field | Type | Notes |
|---|---|---|
| `id` | string | e.g. `mcp.cimd`, `mcp.iss-validation`, `oauth.pkce-s256` |
| `name` | string | |
| `revisions` | list | One entry per revision that defines the feature: `{ spec, revision, section, level, levelNote? }`; `section` is the document's own heading or anchor; `level` is `MUST`, `SHOULD`, `MAY`, `DEPRECATED` or `REMOVED`. The first entry is the revision that introduced the feature. |
| `category` | enum | `discovery`, `registration`, `authorization`, `token`, `session`, `transport`, `delegation`, `consent` |
| `description` | string | |
| `supersedes` | string? | Feature id this replaces (e.g. CIMD supersedes DCR as the default) |
| `observable` | enum | `passive`, `active`, `manual` — how support can be verified |
| `party` | enum | `mcp-server`, `authorization-server`, `client` — who the requirement is on |
| | | (`levelNote` lives inside each `revisions` entry) |

### Relation

An edge between two specs, for the standards atlas.

| Field | Type | Notes |
|---|---|---|
| `from`, `to` | spec id | |
| `type` | enum | `builds-on`, `profiles`, `competes-with`, `solves-same-problem-as`, `references`, `replaces` |
| `note` | string? | One line; required for `competes-with` and `solves-same-problem-as`, which are judgement calls |
| `source` | url? | Where the relation is stated |

Relations live in one list, `data/relations.yaml`. `competes-with` and `solves-same-problem-as`
are symmetric and are stored once per pair; the other types are directed from `from` to `to`.

### Server

A public MCP server (or, later, another agent endpoint) that the MCP Atlas tracks.

| Field | Type | Notes |
|---|---|---|
| `id` | string | kebab-case |
| `name` | string | |
| `vendor` | string? | |
| `url` | url | MCP endpoint |
| `homepage` | url? | |
| `transport` | enum | `streamable-http`, `sse`, `stdio-only` |
| `listed` | enum | `opt-in`, `public-directory`, `maintainer-added` — why it is in the atlas |
| `source` | url | Where the listing came from; required unless `opt-in` |
| `access` | Classification? | Who can connect: `public` (anyone; where an account is needed, anyone can create one by self-service), `closed` (an existing contract, a tenant an admin must enable, a sales process or a private beta stands in the way; a catalog of approved clients is not an obstacle to the person and stays in the evidence note), `unknown` |
| `auth` | Classification? | How the endpoint authenticates clients: `oauth` (an OAuth 2.x authorization through the server's authorization server), `api-key` (a static credential the user pastes into the client), `none`, `unknown` |
| `withdrawn` | object? | `{ at, reason }`; a withdrawn server is excluded from pages and exports |
| `notes` | string? | |

A **Classification** is a dated, evidenced statement about the server as a whole, where an
observation is one about a feature: `{ class, method, evidence, observedAt, observedBy }`, with
`method` and `evidence` as on an observation. It is written by a person or recorded from a vendor
page and corrected in place by pull request; git keeps the history. A server without one is
rendered as a *derived* `unknown`, like a cell without an observation, never as a verdict. The
atlas filters and groups by both classes; the scanner scans a server unless its `auth` is
`api-key` or `none`, grades none of those ("No OAuth"), and reports in its run summary when what
an endpoint answered does not sit with the stated class. The scanner never writes a
classification.

### Observation

One dated statement that a server does or does not support a feature. Append-only; the newest
observation per `(server, feature)` is the current one, older ones are history.

| Field | Type | Notes |
|---|---|---|
| `server` | server id | |
| `feature` | feature id | |
| `status` | enum | `supported`, `partial`, `unsupported`, `unknown`, `not-applicable` |
| `method` | enum | `manual`, `vendor-claim`, `passive-scan`, `active-scan` |
| `observedAt` | datetime | |
| `observedBy` | string | handle or `scanner@<version>` |
| `evidence` | url or string | Metadata URL, doc link, or a short note |
| `revision` | ref | Spec revision the feature was judged against |

### Scenario

A Delegation Chain Explorer scenario: actors, steps, tokens at each hop, attack toggles. One
file per scenario under `data/scenarios/`; the explorer renders the diagram, the step list and
the token views from this one definition.

| Field | Type | Notes |
|---|---|---|
| `id` | string | kebab-case, equals the file name |
| `title` | string | |
| `summary` | string | One or two sentences |
| `actors` | Actor[] | At least two; `{ id, kind, name }` with `kind` one of `user`, `agent`, `mcp-client`, `mcp-server`, `authorization-server`, `resource`, `idp`; the order is the diagram's lane order |
| `features` | feature id[] | Features the scenario exercises |
| `steps` | Step[] | At least one, ids unique within the scenario |
| `toggles` | Toggle[] | May be empty, ids unique within the scenario |

A **Step** is `{ id, from, to, message, note?, cites, token? }`: `from` and `to` are actor ids
(equal for a self-message such as a server validating a token), `message` is one line, `note` a
sentence or two of context, `cites` a Citation, `token` the TokenView the message carries.

A **Citation** is `{ spec, revision, section }`: a revision reference plus the document's own
heading or anchor. Every step and every toggle carries one.

A **TokenView** is a decoded token: `{ name, header?, claims, note? }`, with `header` and
`claims` as maps of claim name to value (string, number, boolean, list of strings, or a nested
map for `act`). The marks on claims that changed since the previous hop are derived by the
explorer, never stored.

A **Toggle** is `{ id, name, kind, summary, cites, replaces, violates?, vulnerability? }`: `kind`
is `attack` or `misconfiguration`; `replaces` maps a step id of this scenario to the list of
steps that take its place (an empty list removes the step); `violates` lists the feature ids the
toggle defeats, so the explorer can point at the atlas; `vulnerability` names a replay.

### Vulnerability

A published vulnerability or incident in how an agent system was authorized, written from its
advisory or the vendor's notice. Breach Anatomy renders one page per entry.

| Field | Type | Notes |
|---|---|---|
| `id` | string | CVE id (`cve-2025-4144`) or advisory slug |
| `title` | string | What failed, in one line |
| `class` | enum | `confused-deputy`, `token-passthrough`, `audience-missing`, `scope-accumulation`, `consent-bypass`, `issuer-confusion`, `redirect-uri`, `pkce-bypass`, `untrusted-metadata`, `tenant-isolation`, `token-theft`, `other` |
| `summary` | string | What failed and which control would have stopped it, in the atlas vocabulary; nothing beyond what the advisory states |
| `disclosed` | date | Date of the public advisory or notice the entry is written from |
| `fixed` | string? | The fixed version or the remediation, as the advisory states it |
| `affects` | string[] | Products, versions or servers; at least one |
| `features` | feature id[] | Requirements whose absence or misuse caused it; may be empty when the atlas has none, and the page says so |
| `scenario` | scenario id? | The scenario whose toggle replays it; that toggle names this id back (rule 8) |
| `sources` | url[] | At least one; the advisory first |

## Rules

1. Ids are stable. Renaming an id is a migration with a redirect.
2. Every `cites` or `revisions[]` reference must resolve to a revision that exists in `data/specs`.
   The build fails otherwise. A scenario's actors, features, toggled steps and vulnerabilities
   must resolve the same way: a step names a declared actor, a toggle replaces a step that exists,
   and ids stay unique across the chain a toggle produces.
3. Observations are never edited or deleted, only appended. Corrections are new observations.
4. `unknown` is written explicitly and rendered as unknown, never as unsupported.
5. A feature's `level` belongs to the revision that defines it. When a new revision changes the
   level (for example DCR moving to `DEPRECATED`), a new entry is appended to that feature's
   `revisions` list; the id stays the same, and the revision diff is derived from the list.
6. A spec is never deleted. A withdrawn or expired document keeps its file with `maturity`
   set to `withdrawn` or `expired`; a withdrawn spec leaves the map and the export's `specs`
   list but keeps its page, its relations and its history.
7. A relation names two existing, distinct specs. `(from, to, type)` is unique, and for the
   symmetric types `(to, from, type)` counts as the same relation. `competes-with` and
   `solves-same-problem-as` carry a `note`. The directed dependency types (`builds-on`,
   `profiles`, `replaces`) form no cycle, because the standards map lays specs out along them.
8. A vulnerability's `scenario` and a toggle's `vulnerability` point at each other: the scenario
   has a toggle naming the vulnerability, and that vulnerability names the scenario. A replay is
   never a dangling link in either direction.

## Examples

```yaml
# data/specs/mcp-authorization.yaml
id: mcp-authorization
name: MCP Authorization
body: mcp
family: profile
maturity: published
maturityNote: Specification revision 2026-07-28
summary: OAuth 2.1 profile for MCP clients obtaining access to MCP servers.
url: https://modelcontextprotocol.io/specification/
revisions:
  - id: "2025-11-25"
    date: 2025-11-25
    status: superseded
    url: https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
  - id: "2026-07-28"
    date: 2026-07-28
    status: current
    supersedes: "2025-11-25"
    url: https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization
    changes: >
      Deprecates Dynamic Client Registration in favour of Client ID Metadata Documents,
      requires RFC 9207 iss validation, keys stored credentials by issuer, removes sessions.
```

```yaml
# data/features/mcp.cimd.yaml
id: mcp.cimd
name: Client ID Metadata Documents
revisions:
  - { spec: mcp-authorization, revision: "2025-11-25", section: "Client Registration", level: SHOULD }
  - { spec: mcp-authorization, revision: "2026-07-28", section: "Client Registration › Client ID Metadata Documents", level: SHOULD }
category: registration
observable: passive
description: >
  Clients identify themselves with a URL that serves their metadata instead of registering
  dynamically. Preferred over Dynamic Client Registration from this revision on.
supersedes: mcp.dcr
```

```yaml
# data/servers/example-mcp.yaml (the two classes)
access:
  class: public
  method: manual
  evidence: "https://example.com/docs/mcp — any account can connect; sign-up is self-service"
  observedAt: 2026-10-17T00:00:00Z
  observedBy: jbspeakr
auth:
  class: oauth
  method: manual
  evidence: "https://example.com/docs/mcp — the client is sent through the OAuth sign-in"
  observedAt: 2026-10-17T00:00:00Z
  observedBy: jbspeakr
```

```yaml
# data/observations/example-mcp.yaml
- server: example-mcp
  feature: mcp.cimd
  status: unknown
  method: manual
  observedAt: 2026-10-13T00:00:00Z
  observedBy: jbspeakr
  evidence: "No public statement; passive scan not yet run."
  revision: { spec: mcp-authorization, revision: "2026-07-28" }
```
