# Research: Server access and auth classes

## R1. Where do the two classes live?

**Decision**: Two optional fields on the Server entity, each a Classification
`{ class, method, evidence, observedAt, observedBy }`.

**Rationale**: A class is a fact about the server as a whole, true across revisions. An
observation is `(server, feature, revision)` and append-only; forcing a class into it would need
two pseudo-features without a section to cite (constitution II) and would add non-requirement
columns to the matrix. A bare enum (as `authClaimed` is) carries no evidence, which is what the
roadmap item objects to. The Classification shape borrows `method` and `evidence` from the
observation so a reviewer reads it the same way.

**Alternatives**: observations on two synthetic features (rejected: no citation, matrix noise);
a separate `data/classes/` entity (rejected: one more file per server for two lines).

## R2. Which classes?

**Access**: `public`, `closed`, `unknown`. The line is self-service: a server that needs an
account anyone can create is public; one that needs a contract, a tenant's admin, a sales
process or a private beta is closed. A catalog of approved clients (Figma, Vercel) is not an
obstacle to the person, who connects through any listed client, so it does not make a server
closed; the evidence note records it. Three values keep the filter legible; the evidence note
says which obstacle makes a server closed.

**Auth**: `oauth`, `api-key`, `none`, `unknown`. `oauth` covers every OAuth 2.x grant the server's
authorization server issues, with or without dynamic registration and with or without a user
consent step; the matrix cells carry those distinctions. `api-key` is any static credential the
user pastes into the client. `none` is an endpoint that answers without a credential.

## R3. What may the scanner do with them?

**Decision**: read `auth.class` to decide what to scan and grade; derive an `authSuggestion` from
answers it already has; name it in the run summary; write nothing.

**Rationale**: The scanner reads only what a server publishes to everyone (constitution III). A
401 with a `resource_metadata` pointer, or a protected resource metadata document, is OAuth as
MCP profiles it; a 200 to an unauthenticated step is no authentication. A bare 401 settles
nothing, because a bearer challenge guards API keys too. The vendor page remains the evidence a
person cites; the suggestion tells the maintainer where to look.

## R4. Seeding the 39 servers

Each statement cites the vendor's own documentation page for its MCP server, read on
2026-10-17; `method: manual`. Where no page settles a question the class is `unknown` with the
evidence saying what was looked at, rather than a guess or a copy of the directory's label
(`method: vendor-claim` is reserved for a statement that only repeats a directory). The directory
label (`authClaimed`) is removed; `auth` with evidence replaces it, and the git history keeps
what the directory said.

## R5. Grouping without a second table

**Decision**: the island re-orders the server-rendered rows into groups and inserts one header
row per class present; without JavaScript the alphabetical table stands.

**Rationale**: the table in the DOM is the source of truth (the island's existing rule); a
second rendering per grouping would double the HTML. Rows stay alphabetical within a group, so
nothing ranks servers.
