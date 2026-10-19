# Investigating authorization behavior

`pnpm investigate` helps a contributor plan a manual investigation, run a small set of controlled
probes, save evidence and record a reviewed observation. Run it from the repository root with
Node 22+ and `pnpm install`. `pnpm investigate --help` is the command reference.

The existing `pnpm scan` remains the passive metadata scanner. The new command never runs in
the nightly job, is not exposed by the website, and never publishes findings automatically.

## Start with an offline plan

```sh
pnpm investigate list
pnpm investigate plan figma --out .investigations/figma-plan.json
pnpm investigate plan https://lab.example.com/mcp --json
pnpm scan figma --json
```

Plans resolve server IDs and requirement citations from the shared dataset. They include active
recipes, prerequisites and questions for documentation/source review. `--revision` selects a
recorded MCP authorization revision; the default is the dataset's current revision. A plan is
a checklist, not an executable configuration. `list`, `plan`, `challenge` and `record` are offline.

If you do not control a public vendor endpoint, use the plan to inspect its documentation or
source and record your findings. A directory claim is not observed behavior. Leave a requirement
`unknown` when there is insufficient evidence. There is no ownership-bypass switch.

## Prove control of the endpoint

The constitution requires owner control for active probes. Generate a random challenge:

```sh
pnpm investigate challenge https://lab.example.com/mcp \
  --out .investigations/proof.json
```

Serve that exact JSON at `https://lab.example.com/.well-known/letsauth-investigation.json` with
HTTP 200 and `Content-Type: application/json`. The proof binds the exact endpoint URL and expires
in one hour. Keep the local file for `--proof`, and remove the hosted file after testing. Hosting
the file authorizes the local operator's configured probes on that endpoint for that interval.
Use a dedicated test account/tenant and inspect the operation before running it.

Each run checks the proof before sending credentials or protocol messages. DCR requires a new
proof for the registration endpoint **on the authorization server's origin**. Control of an MCP
server does not establish control of its third-party identity provider. This is an operator
guardrail, not identity certification or a public authorization service.

Only public DNS names over HTTPS/443 are supported. Credentials, query strings and fragments in
endpoint URLs are rejected. DNS is checked in socket lookup and pinned to the returned public
address. Private, loopback and translation/tunnelling addresses are refused. Redirects are never
followed, even within an origin. Each request has a 10-second total deadline and 256 KiB response
limit; no retries or bulk active mode. Oversized streams and network failures stay inconclusive.

## Obtain credentials and establish a baseline

Use the provider's existing OAuth client to log in and consent. Check its authorization-code
flow uses S256 PKCE, state, the correct issuer, redirect URI and resource. If investigating the
flow itself, record the client version, requested/granted scopes, issuer and resource, and a
redacted sequence of outcomes. The CLI does not open a browser, redeem authorization codes,
store refresh tokens or implement a separate OAuth client. Opaque tokens are supported.

Load a short-lived test access token into an environment variable through your local secret
manager or a hidden shell prompt (Bash example):

```sh
read -r -s -p 'Test access token: ' LETSAUTH_TOKEN; printf '\n'
export LETSAUTH_TOKEN
```

Do not put the token in a configuration file, shell argument, evidence note or Git. Configure
the **name** of the environment variable. Save `.investigations/baseline.json`:

```json
{
  "version": 1,
  "recipe": "baseline",
  "target": "https://lab.example.com/mcp",
  "context": "Test tenant, normal OAuth login; this account may list tools.",
  "tokenEnv": "LETSAUTH_TOKEN",
  "request": { "method": "tools/list", "params": {} }
}
```

```sh
pnpm investigate run .investigations/baseline.json \
  --proof .investigations/proof.json --out .investigations/before.json
```

Add `"server": "<listed-id>"` only when testing that exact listed endpoint; omit it for a lab.
Add `"revision": "2025-11-25"` if you need a particular authorization revision. Network protocol
support is separately pinned to MCP Streamable HTTP **2025-11-25**. A different negotiated
protocol is inconclusive; legacy SSE and stdio are not supported. JSON and SSE responses to
Streamable HTTP POSTs are supported, with matching JSON-RPC IDs. Interrupted SSE is not retried.

Each token gets a fresh initialization, initialized notification and the configured operation.
Session and protocol headers are carried only within that session; an assigned session is
closed with DELETE afterwards (405 means the server does not offer explicit termination).
HTTP 200 by itself is not success: a matching JSON-RPC result with the operation's result shape
is required. Tool `isError: true` is a tool error. A failed baseline stops negative tests.

Supported operations are `tools/list`, `resources/list`, `resources/read` (requires `params.uri`)
and `tools/call` (requires `params.name`). For a scope test, select a known scope-protected,
harmless operation; a public tools list says nothing about tool execution. An explicit tool call
may change state or incur charges: the CLI cannot infer its effects from its name. For example:

```json
"request": {
  "method": "tools/call",
  "params": { "name": "read_test_document", "arguments": { "id": "test-document" } }
}
```

## Investigate specific questions

| Recipe | Configuration beyond the baseline | What it measures |
|---|---|---|
| `invalid-token` | Change `recipe`; keep a valid `tokenEnv` | Baseline, then requests without a token and with a randomly generated invalid token. |
| `audience` | `comparisonTokenEnv` naming a second token; `context` explains the controlled difference | Baseline and wrong-audience token on the same operation. Both tokens must otherwise be valid, with the same issuer/user and equivalent scopes. |
| `scope` | `comparisonTokenEnv`; scope-protected `request`; `context` names granted/missing scopes | Baseline and reduced-scope token. Records status plus presence of the `insufficient_scope` error and scope challenge. |
| `revocation` | `baseline` report path and `revokedAt` UTC timestamp | Access using the same token/operation after an operator revokes it or its grant. |
| `dcr` | Explicit registration endpoint and `registration` object; no MCP `request` | One registration attempt and whether HTTP 201 returned a client ID. |

For audience/scope, acquire a second token through a real issuer flow and load it into another
environment variable. Keep all other properties controlled; changing a JWT payload invalidates
its signature and does not test audience/scope enforcement. The runner requires distinct token
values but cannot verify the operator's claims about how opaque tokens were issued.

An audience configuration, for example:

```json
{
  "version": 1,
  "recipe": "audience",
  "target": "https://lab.example.com/mcp",
  "tokenEnv": "LETSAUTH_TOKEN",
  "comparisonTokenEnv": "LETSAUTH_OTHER_RESOURCE_TOKEN",
  "context": "Both tokens use the same test user, issuer and scopes. Comparison token was issued for resource B; baseline for this MCP resource. Both remain unexpired.",
  "request": { "method": "tools/list", "params": {} }
}
```

For revocation, run the baseline first, then revoke through the provider's supported client/UI.
Copy its configuration, change `recipe` to `revocation` and add:

```json
"baseline": "before.json",
"revokedAt": "2026-10-19T18:00:00Z"
```

Use your actual revocation time, and describe the action, token type and expected propagation in
`context`. Baseline paths resolve relative to the configuration file. The baseline must be
successful, less than 24 hours old, and match the endpoint, server, operation and token digest.
Its completion must precede `revokedAt`. A fresh session is tested; existing-session access and
refresh-token reuse are separate manual investigations. Continued access can reflect token
lifetime or propagation rather than a violation. See [RFC 7009](https://www.rfc-editor.org/rfc/rfc7009).
There is currently no dedicated atlas feature for this recipe, so no automatic feature mapping.

For DCR, use a separate configuration and proof:

```json
{
  "version": 1,
  "recipe": "dcr",
  "target": "https://issuer.example.com/register",
  "context": "Register one public test client; delete it afterwards in the AS administration UI by its unique name.",
  "registration": {
    "client_name": "letsauth-investigation-20261019-unique-id",
    "redirect_uris": ["https://lab.example.com/callback"],
    "grant_types": ["authorization_code"],
    "response_types": ["code"],
    "token_endpoint_auth_method": "none"
  }
}
```

Optional `tokenEnv` supplies an initial registration access token if policy requires it.
Optional registration fields are `application_type` and `scope`. Unknown fields are rejected.
Use a callback you control. DCR creates state: delete the test client through the provider's UI;
returned client IDs, secrets and management tokens are not retained. A rejected attempt may
reflect invalid metadata or policy, not lack of DCR support. Compare with the documented policy
or a separately configured permitted attempt before recording `partial`.

## Review evidence and record a finding

`run` always saves a JSON report to `--out`. It records runner version, timestamps, citations,
configuration/operation digests, operator context, request stages, HTTP statuses and bounded
outcomes. Baselines include a SHA-256 token fingerprint for pairing; there are no token values,
raw response bodies, raw headers, session IDs or returned client secrets. Operator context is
redacted for supplied token values and common credential patterns. This is intentionally a
minimal evidence summary, not a raw packet capture. Keep the configuration and relevant source
links alongside it so the procedure can be repeated.

Reports are `review-required` or `inconclusive`, never automatic atlas pass/fail. A rejection
does not identify its cause; success is specific to the sampled token, account and operation.
Some servers filter list results instead of denying a request. The runner does not compare
result contents and cannot establish object-level authorization from a successful list call.

Write a **redacted** evidence note containing the procedure, exact endpoint/client version,
controlled token differences, outcome, limitations and source/report link if published. Review
all free text before sharing: arbitrary notes and resource paths may still contain private
information. Keep raw credentials and captures out of Git. Local `.investigations/` is ignored;
new output files use mode 0600, and existing files are never overwritten.

```sh
# Preview only; note.txt describes a finding you have actually established.
pnpm investigate record figma mcp.as.dcr partial \
  --by jbspeakr --evidence-file .investigations/note.txt

# After reviewing the preview, append the same finding.
pnpm investigate record figma mcp.as.dcr partial \
  --by jbspeakr --evidence-file .investigations/note.txt --write
pnpm validate:data
pnpm check:append-only
git diff -- data/observations/
```

Use `--out draft.yaml` instead of `--write` to save a preview. Optional `--report report.json`
adds its digest and measurement times to the note and requires matching server/feature/revision.
The observation then defaults to the report's completion time; `--at` can state the actual
observation time explicitly. Without a report, the default is now. If the report used another
revision, also pass `--revision`. All entries are `manual`: the operator chooses and justifies
the atlas status. No existing observation is edited. Unknown IDs, client-party features and
invalid references are rejected. Open a data PR after review; this CLI does not open one for you.

Exit codes: **0** completed (including behavior needing review), **1** invalid input or failed
owner control, **2** inconclusive measurement. `--json` on list/plan/run supports agent use.
Use a new output filename for each run, retain paired reports for revocation, unset token
environment variables when finished, remove owner proof and clean up created clients/test state.
