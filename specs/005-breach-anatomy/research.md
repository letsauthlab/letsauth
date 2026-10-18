# Research: Breach Anatomy

## R1. What is the "reproducible lab"?

**Decision**: the explorer replay. An entry links the toggle that turns its pattern on in a
baseline chain; the reader steps through it and reads the token at each hop.

**Rationale**: the constitution allows a backend for the scanner only (IV) and the site cites
and ranks nothing (II, III). A page that tells a reader how to exploit a named product would
be neither neutral nor something one maintainer should keep correct. The roadmap row now says
the lab is the replay. A runnable lab, if ever wanted, is its own feature and its own decision.

## R2. Which breaches first?

Five, each from a public advisory or an authoritative report, chosen because each turns on a
control the atlas or the explorer already names, or shows a gap in them:

| Entry | Source of record | Control |
|---|---|---|
| `cve-2025-4143` | Cloudflare advisory GHSA-4pc9-x2fx-p7vj, 2025-05-01 | Redirect URI checked at the authorization endpoint (no atlas row; RFC 9700 §4.1 cited by the replay) |
| `cve-2025-4144` | Cloudflare advisory GHSA-qgp8-v765-qxx9, 2025-05-01 | PKCE verifier compared with the challenge (`mcp.as.pkce-s256`, `mcp.client.pkce`) |
| `cve-2025-6514` | NVD and JFrog, 2025-07-09 | Every authorization server endpoint https, checked by the client (`mcp.as.https`) |
| `asana-mcp-cross-tenant` | UpGuard, BleepingComputer, The Register, June 2025 | Tenant isolation on every answer (no atlas row) |
| `salesloft-drift-oauth-tokens` | Google Threat Intelligence, Cloudflare, Unit 42, August 2025 | Short-lived, sender-constrained, narrowly scoped integration tokens (no atlas row) |

Two of the five have no atlas requirement, and the page says so. That is a finding about the
atlas (redirect URI validation and tenant isolation are not MCP Authorization requirements the
atlas observes), not a reason to invent a row.

## R3. Replays on which scenario?

All three replays are toggles on `mcp-authorization`, because each breaks a step of the
baseline OAuth flow that scenario already shows (consent and the authorization response; the
token request and response; the discovery answers and the opening of the authorization
endpoint). The two incidents without a CVE have no replay: Asana published no mechanism, and
the Drift theft happened outside any protocol step the explorer models. Each entry says so.

## R4. Model fields

`summary`, `disclosed` and `fixed` are what a page needs and an advisory gives. Nothing about
severity: a CVSS score would rank, and the two incidents have none. `affects` and `sources`
need at least one entry; an entry with no source is not an entry.

## R5. The back-link rule

A vulnerability's `scenario` and a toggle's `vulnerability` must point at each other (data model
rule 8). One direction alone lets a page link a toggle that replays something else, or a toggle
claim a replay the entry does not acknowledge. The validator checks both and names the field.
