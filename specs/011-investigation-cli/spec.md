# Manual investigation CLI

Help a maintainer turn unknown atlas cells into reproducible, reviewed observations.
`pnpm investigate` is a local contributor tool; it is never imported by the site or nightly job.

## User stories and acceptance criteria

1. Initialize an editable baseline configuration from a server ID or any HTTPS endpoint.
   List recipes and optionally generate a checklist for a listed server or explicit HTTPS endpoint.
   Plans resolve feature references and citations from the shared dataset, identify prerequisites,
   and include manual procedures for OAuth acquisition and documentation/source review.
2. Run bounded, explicit active probes: authenticated baseline, missing/invalid token, wrong
   audience, insufficient scope, access after manual revocation, and one DCR attempt.
   Token comparisons require a successful baseline. Reports describe observations, never infer
   full conformance from one sample. Transport errors, malformed responses and protocol errors
   remain inconclusive. No automatic atlas status is assigned.
3. Before sending credentials or protocol messages, verify an expiring, endpoint-bound owner
   challenge at the endpoint's origin. Registration requires control of the AS origin itself.
   Never follow redirects, discover additional active targets, retry, or run active probes nightly.
4. Capture a versioned JSON evidence report with timestamps, recipe, citations, configuration
   digest, request stages, HTTP status and bounded semantic outcomes. Never persist response
   bodies, credential values, session IDs, raw headers or DCR client secrets.
5. Preview a manual observation from a reviewed evidence note; writing requires `--write`.
   Validate schema and cross-references before appending. Explicit feature, revision, status,
   observer and evidence are required/resolved. Reports do not automatically become verdicts.
6. Provide machine-readable output, strict arguments, useful help, deterministic network-free
   tests and exit codes (0 completed, 1 invalid input/control failure, 2 inconclusive probe).

## Scope boundaries

Streamable HTTP with JSON and SSE responses; no legacy SSE or stdio client. OAuth login, consent,
token acquisition and revocation are guided manual steps with an existing client/provider UI.
The CLI never stores a login session or implements a second OAuth client. Scope and audience
tokens must be acquired with controlled differences; decoding a JWT is not verification.
Revocation has a separate before/after workflow and measures access after an operator action;
it does not assert universal immediate revocation or automatically map to an atlas feature.
Operations may create state (DCR, initialization, explicitly configured tool calls); plans and
documentation identify cleanup. No bulk active mode. Existing passive scanner behavior is intact.

URL-based MCP reports remain usable after the exact endpoint is added as a server. Recording
requires that server entry and matching feature/revision; unrelated endpoints and unbound AS
registration reports cannot be attached. Plans are optional, not a prerequisite for execution.
