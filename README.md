<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/readme/hero-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="docs/assets/readme/hero-light.svg">
  <img alt="letsauth: authentication for agents, measured instead of asserted. Beside the wordmark, a thumbnail of the MCP auth atlas: 39 public MCP servers across, 23 requirements down, each observed cell coloured by status." src="docs/assets/readme/hero-light.svg" width="100%">
</picture>

<br>

**[letsauth.eu](https://letsauth.eu/)** is an open, vendor-neutral lab for seeing, testing and breaking how AI agents are authorized.
MCP, A2A and agent delegation meet OAuth, OpenID Connect and workload identity, with a European lens.

<br>

[![CI](https://img.shields.io/github/actions/workflow/status/letsauthlab/letsauth/ci.yml?branch=main&style=flat-square&logo=githubactions&logoColor=white&label=CI)](https://github.com/letsauthlab/letsauth/actions/workflows/ci.yml)
[![Deploy](https://img.shields.io/github/actions/workflow/status/letsauthlab/letsauth/deploy.yml?branch=main&style=flat-square&label=deploy)](https://github.com/letsauthlab/letsauth/actions/workflows/deploy.yml)
[![Scanner](https://img.shields.io/github/actions/workflow/status/letsauthlab/letsauth/scanner-deploy.yml?branch=main&style=flat-square&logo=scaleway&logoColor=white&label=scanner)](https://github.com/letsauthlab/letsauth/actions/workflows/scanner-deploy.yml)
[![Site](https://img.shields.io/website?url=https%3A%2F%2Fletsauth.eu%2F&style=flat-square&label=letsauth.eu&up_message=live&down_message=down)](https://letsauth.eu/)
<br>
[![Code: MIT](https://img.shields.io/badge/code-MIT-006b5d?style=flat-square)](LICENSE)
[![Data: CC BY 4.0](https://img.shields.io/badge/data-CC_BY_4.0-006b5d?style=flat-square&logo=creativecommons&logoColor=white)](LICENSE-DATA)
[![Hosted in the EU](https://img.shields.io/badge/hosted-in_the_EU-ad472e?style=flat-square)](https://letsauth.eu/made-in-europe/)
[![Built with Astro](https://img.shields.io/badge/built_with-Astro-BC52EE?style=flat-square&logo=astro&logoColor=white)](https://astro.build/)
[![Node 22](https://img.shields.io/badge/node-22-5FA04E?style=flat-square&logo=nodedotjs&logoColor=white)](.nvmrc)
[![pnpm](https://img.shields.io/badge/pnpm-10-F69220?style=flat-square&logo=pnpm&logoColor=white)](package.json)

<br>

[**Open the MCP auth atlas**](https://letsauth.eu/mcp/) ·
[**See the standards map**](https://letsauth.eu/standards/) ·
[**Step through a delegation chain**](https://letsauth.eu/explorer/) ·
[**Read a scanner report**](https://letsauth.eu/mcp/scanner/) ·
[**Get the data**](https://letsauth.eu/mcp/data.json)

</div>

---

## Why this lab exists

Vendors explain agent authorization through their own product. Conformance testers run against one
server, by its owner, pinned to an older revision of the spec. Nobody shows, over time and for
everyone, which public MCP servers validate the issuer, bind the audience, or still lean on dynamic
client registration. Nobody draws WIMSE, AAuth, ID-JAG, A2A and the EU acts on one map.

letsauth measures instead of asserting. It keeps one open dataset of what the agent protocols
require and what real servers do:

- **Every claim cites a revision.** Each requirement links to the section of the specification
  revision it comes from. When the spec moves, the atlas says what changed and keeps the old
  reading intact.
- **Every status cites an observation.** A cell is only ever a dated observation with a method and
  evidence a reviewer can open. Nothing is inferred from silence: an empty cell reads *unknown*,
  never failure.
- **Open, append-only data.** The dataset is YAML in this repository under CC BY 4.0. Observations
  are never edited, so the atlas is also a record of how the ecosystem moved.
- **Neutral and passive.** Rows are alphabetical, nothing is ranked, and the site contacts no server
  at build time. The scanner reads public metadata only, never with a token.
- **European by default.** Hosting, storage and analytics run in the EU. eIDAS 2.0, the AI Act and
  NIS2 are first-class content wherever they touch agent delegation.

## What is live

| | | |
|---|---|---|
| 🗺️ | **[MCP auth atlas](https://letsauth.eu/mcp/)** | Which public MCP servers support which features of the MCP Authorization specification: one matrix of servers against requirements, with a page per server, per feature and per revision. Export: [`data.json`](https://letsauth.eu/mcp/data.json). |
| 🕸️ | **[Agent auth atlas](https://letsauth.eu/standards/)** | The specifications, drafts and EU acts behind agent authorization as one map of what builds on, profiles, competes with and replaces what, with maturity and dated revisions per document. Export: [`data.json`](https://letsauth.eu/standards/data.json). |
| 🔗 | **[Delegation chain explorer](https://letsauth.eu/explorer/)** | Scenarios of how authority travels from a person to an agent to an API, step by step, with the decoded token at each hop and toggles for the attacks and misconfigurations that break the chain. Every step cites a specification revision. Export: [`data.json`](https://letsauth.eu/explorer/data.json). |
| 🔍 | **[Scanner](https://letsauth.eu/mcp/scanner/)** | A passive scanner that reads each listed server's public OAuth metadata every night, grades it against the MCP Authorization specification and opens one pull request of observations. The grade shows next to each server in the atlas; one report per server at `/mcp/servers/<id>/scan/` and `/mcp/servers/<id>/scan.json`. |

Next on the [roadmap](docs/roadmap.md): breach anatomies, agents under EU rules, and a changelog
generated from the data.

## How it works

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/readme/how-it-works-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="docs/assets/readme/how-it-works-light.svg">
  <img alt="Specifications and dated observations from vendor documentation and the passive scanner flow as pull requests into one YAML dataset, which the static build renders as the atlases, the scanner reports and the JSON exports." src="docs/assets/readme/how-it-works-light.svg" width="100%">
</picture>

One shared model, many views. Specifications, features, servers, observations and the relations
between standards live as YAML under [`data/`](data/), validated by a Zod schema at build time and
changed only through reviewed pull requests. The site is pre-rendered from that data; the scanner
is the one backend, and its output flows back into the repository as data. The full picture is in
[`docs/architecture.md`](docs/architecture.md).

## Use the data

Everything the site shows is yours to download under CC BY 4.0:

```sh
curl -s https://letsauth.eu/mcp/data.json | jq '.servers | length'
curl -s https://letsauth.eu/standards/data.json | jq '.relations[0]'
curl -s https://letsauth.eu/explorer/data.json | jq '.scenarios[0].toggles | length'
curl -s https://letsauth.eu/mcp/servers/notion/scan.json | jq '.grade'
```

Or read the YAML directly: one file per entity under [`data/`](data/), with the schema in
[`src/schema/`](src/schema/) and the model explained in [`docs/data-model.md`](docs/data-model.md).

## Contribute

The most useful contribution is an observation: what a server you know does, with evidence a
reviewer can open. Code, specs and relations are welcome too.

- [`CONTRIBUTING.md`](CONTRIBUTING.md): how to add data, specs, relations and code, and what a
  pull request needs.
- [`docs/development.md`](docs/development.md): local setup, commands, tests and screenshots.
- [`docs/architecture.md`](docs/architecture.md): the stack, the repository layout and the data
  flow.
- [`.specify/memory/constitution.md`](.specify/memory/constitution.md): the principles every
  change is checked against.

Security problems go to the private channels in [`SECURITY.md`](SECURITY.md), never to a public
issue.

## Licences

Code is [MIT](LICENSE). Data under `data/` and the JSON exports are
[CC BY 4.0](LICENSE-DATA). Operated by [Jan Brennenstuhl](https://www.janbrennenstuhl.eu/) in
Berlin as Let's Auth Labs; see the [imprint](https://letsauth.eu/imprint/).
