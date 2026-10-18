# Roadmap

The constitution is the stable meta plan. This roadmap is the part that changes: the order of
features and the review point after each. Each feature gets its own spec under `specs/`.

| # | Feature | Why this order | Status |
|---|---|---|---|
| 001 | **MCP Atlas** | Quickest unique win. A curated matrix of public MCP servers against the features of the current MCP authorization revision forces the data model to be right and is useful on day one. | Implemented, live at letsauth.eu; documentation pass recorded October 2026 |
| 002 | **Agent Auth Atlas** | The standards graph. Mostly data entry on the same model, plus one graph view. | Implemented (pull request open) |
| 003 | **Delegation Chain Explorer** | The flagship. Step-through scenarios with the decoded token at each hop and attack toggles. Reuses features and revisions from 001 and 002. | Implemented (pull request open); three scenarios, eleven toggles (three of them replays for 005), `specs/003-delegation-explorer/` |
| 004 | **Scanner** | Automates what 001 did by hand. Passive checks on public metadata, graded report, nightly PR with observations. First and only backend. | Implemented; nightly scan running on Scaleway since October 2026 |
| 005 | **Breach Anatomy** | Each agent-auth vulnerability as a scenario replay plus a reproducible lab. Cheap once 003 exists. | Implemented; five entries, three replays, `specs/005-breach-anatomy/` (the lab is the explorer replay: a static site ships no exploit recipes) |
| 006 | **Agents under EU rules** | eIDAS 2.0 and EUDI wallet mandates, AI Act oversight, NIS2 duties, as explorer scenarios and long-form pages. | Planned |
| 007 | **Changelog and newsletter** | Generated from merged data and content changes. Runs once there is something to report. | Planned |
| 008 | **Discovery challenge check** | The first nightly run withheld grades for servers that publish no protected resource metadata at a well-known URL (Atlassian, Plaid, Stack Overflow), because the other allowed mechanism, a `resource_metadata` pointer in the 401 `WWW-Authenticate` challenge, needs a request the passive scanner does not make. One unauthenticated request per server to its MCP endpoint, reading only the challenge header, would fill `mcp.prm.www-authenticate` beside `mcp.prm.well-known`, so the atlas shows which mechanism each server offers, or both. It is the first request beyond well-known metadata, so the spec must justify it against the constitution before it runs. | Implemented (pull request open); `specs/008-discovery-challenge/` records why it is still passive |
| 009 | **Server access and auth classes** | Today the atlas mixes servers anyone can connect to with ones that need an account, tenant or enterprise contract, and OAuth servers with API-key and open ones, using only the directory's unverified `authClaimed` label. Make access (public or closed) and auth (OAuth, API key, none) first-class, evidenced fields; let the atlas group and filter by them; and let the scanner and the grade use them; drop the label. | Implemented; `specs/009-access-auth-classes/` |
| 010 | **Composable discovery strategies** | After the first nightly runs, several requirements stayed `unknown` for every server for the same few reasons: streamable HTTP servers answer the scanner's `GET` with 405 before authenticating, listed `/sse` endpoints had moved, metadata documents name no scopes, and the `scope` parameter the endpoint already sends was not read. Make each check an ordered list of strategies over the sources the probe found, make the endpoint request a ladder, read the scope challenge, and let the run summary flag stale URLs. | Implemented; `specs/010-discovery-strategies/` |

Review after each feature: does it still pass the three honesty tests, and did it make the shared
model better or worse?
