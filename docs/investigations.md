# Investigating authorization behavior

`pnpm investigate` runs local, human-operated checks and records reviewed atlas findings.
Use Node 22+ and `pnpm install` in the repository root. The scheduled `pnpm scan` stays passive.

## Start with one command

```sh
pnpm investigate check figma --recipe invalid-token --out .investigations/figma.json
# Or a server that is not in the atlas yet:
pnpm investigate check https://provider.example/mcp --recipe invalid-token \
  --out .investigations/provider.json
```

The CLI discovers the provider's OAuth metadata, uses supplied client information or registers
a client where supported, and opens your browser. **You log in and consent.** The CLI receives
the redirect on `http://127.0.0.1:8765/callback`, validates state and issuer, exchanges the code
using S256 PKCE, and uses the access token to run the check. No copying a token is needed.
The terminal also prints the authorization URL if opening the browser fails.

For `invalid-token`, the CLI first verifies an authenticated `tools/list`, then repeats the
operation without a token and with an invalid token. The default recipe is `baseline`, which
only establishes authenticated access. `check` supports these two recipes; configurations
below expose other operations and comparisons. Review each report before recording a finding.

No domain proof, hosted challenge file, investigation plan or provider-domain access is
required. Run checks only against accounts/endpoints you are permitted to test. The CLI stays
local; it does not schedule investigations or publish results.

## Provider-specific client setup

The CLI uses the official `@modelcontextprotocol/client` OAuth helpers. It supports a
preregistered client, a supplied Client ID Metadata Document URL when the AS supports it,
or Dynamic Client Registration when advertised. A provider may require client approval or
preregistration; an ordinary user account does not remove that provider requirement.

```sh
pnpm investigate check https://provider.example/mcp --client-id YOUR_CLIENT_ID \
  --scope 'tools:read' --out .investigations/baseline.json
```

Configure the client with redirect URI `http://127.0.0.1:8765/callback`. Use
`--callback-port 8766` to select another local port (and register that redirect URI). A
confidential client can use `--client-secret-env LETSAUTH_CLIENT_SECRET`; the value comes from
your environment, never a command-line argument. Alternatively, supply
`--client-metadata-url https://your-client.example/oauth.json`; its metadata must authorize the
same callback. This is your OAuth client's metadata, not a file on the MCP provider's domain.

Explicit `--scope` overrides the challenge scope; otherwise the SDK uses the advertised scope
selection. The browser shows the requested consent. The callback listener binds only to
127.0.0.1, times out after five minutes, and closes after success or failure. Run the CLI on the
machine with your browser, or arrange a local port forward for a remote development environment.

Tokens, client secrets, PKCE verifier and registration details stay in process memory and are
not written to reports or a credential store. A later run logs in again (the browser/provider
may reuse its existing session). DCR creates a test client; the CLI prints its unique name for
cleanup through the provider UI. Supply a preregistered client to avoid creating one per run.

## Configure other checks

For a different MCP operation or a token comparison, start with an editable configuration:

```sh
pnpm investigate init figma --out .investigations/check.json
pnpm investigate run .investigations/check.json --login --out .investigations/report.json
```

`init` accepts a server ID or any supported HTTPS URL. Edit `recipe`, `context` and `request`.
Optional `oauth` fields configure the login: `clientId`, `clientSecretEnv`, `clientMetadataUrl`,
`scope`, and `callbackPort`. `--login` obtains the baseline token and uses it in memory for
`tokenEnv`; it never sets or overwrites your shell environment.

```json
{
  "version": 1,
  "recipe": "invalid-token",
  "target": "https://provider.example/mcp",
  "context": "Test account authorized to list tools; investigating invalid bearer handling.",
  "tokenEnv": "LETSAUTH_TOKEN",
  "oauth": { "scope": "tools:read" },
  "request": { "method": "tools/list", "params": {} }
}
```

For scope/audience comparisons you currently supply the second, deliberately different token
through `comparisonTokenEnv`. `--login` acquires only the baseline token. Choose the baseline's
OAuth client/scopes to match the controlled comparison; do not let two different client
registrations confound the comparison. Revocation testing reuses a previously supplied token,
so `--login` is rejected for that recipe. DCR tests have their own registration configuration.

If you already have a token, omit `--login` and supply the named environment variable. In Bash:

```sh
read -r -s -p 'Test access token: ' LETSAUTH_TOKEN; printf '\n'
export LETSAUTH_TOKEN
pnpm investigate run .investigations/check.json --out .investigations/report.json
```

The generated configuration includes `server` for a listed ID; a new URL has no server ID.
Add `revision` when assessing a specific recorded authorization revision. The measurement
transport is pinned to MCP Streamable HTTP **2025-11-25**, with JSON and SSE responses. Legacy
SSE/stdio and a different negotiated protocol remain inconclusive/unsupported by this runner.

Requests use public HTTPS/443 endpoints, pinned DNS resolution, no redirects, a 10-second
request deadline and a 256 KiB response limit. OAuth discovery/registration/token endpoints may
be on the provider's separate authorization-server origin; resource tokens are sent only to
the configured MCP endpoint. Measurements never silently reauthenticate or refresh a rejected
token, because doing so would change the condition being tested. No bulk active mode.

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

For a standalone DCR measurement, use a separate configuration:

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

## Add findings for a server that is not listed yet

You can run against an explicit URL before adding it to the atlas. Before recording findings,
create `data/servers/new-server.yaml` using the existing server schema, for example:

```yaml
id: new-server
name: New server
url: https://lab.example.com/mcp
transport: streamable-http
listed: maintainer-added
source: https://lab.example.com/docs
```

Use the actual endpoint and listing/documentation source, then run `pnpm validate:data`. Record
against `new-server` as usual. A `--report` from an earlier URL-based MCP investigation can be
attached when its target exactly matches the new server URL and its feature/revision matches
the finding. A DCR report targets an authorization server instead: include the intended listed
`server` in its configuration before running, or record a reviewed note explaining the mapping.
Submit the new server and its observations together in the data PR. `init` does not invent a
public listing or infer access/auth classifications from a single successful operation.

Exit codes: **0** completed (including behavior needing review), **1** invalid input or failed
login, **2** inconclusive measurement. `--json` on list/plan/check/run supports structured output;
interactive login instructions go to stderr.
Use a new output filename for each run, retain paired reports for revocation, unset token
environment variables when finished, and clean up created clients/test state.

## Optional recipe checklist

`pnpm investigate list` lists the built-in recipes. `pnpm investigate plan <server-id|url>`
combines those recipes with the repository's feature definitions and specification citations.
It is just a checklist: no network access, no generated test logic, and no prerequisite for
`check` or `run`. Use it when you want guidance for a broader manual investigation.
