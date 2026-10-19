# Data Model: Composable discovery strategies

No entity or field changes. `data/features/mcp.rs.scope-challenge.yaml`: `observable: active` →
`passive`. Five server files: `url` to the vendor's documented endpoint, `transport` to
`streamable-http`.

## Probe (inputs the strategies read)

| Field | Meaning |
|---|---|
| `endpointRequests` | every request of the endpoint ladder, in order; `method` set on a POST |
| `challenge.method`, `challenge.step` | the request and ladder step that got the decisive answer |
| `challenge.scope` | the `scope` parameter of the challenge, split on spaces; absent without one |
| `as.scopesSupported` | RFC 8414 `scopes_supported` of the authorization server, when an array of strings |
| `endpointNote` | set when every step answered 404/410 or every step was a refused redirect |

## Endpoint ladder (`src/scanner/discovery.ts`)

| Step | Request | Taken when |
|---|---|---|
| `get` | `GET`, `Accept: application/json, text/event-stream` | always |
| `post-empty` | `POST`, same `Accept`, `Content-Type: application/json`, `Content-Length: 0`, no body | the previous answer was a definite status other than 401, or a redirect the scanner would not follow |

The ladder stops at the first 401. `MAX_REQUESTS` = 2 + ladder length + 1 + 3 = 8.

## Decision table rows (added to or changed in `specs/004-scanner/data-model.md`)

| Feature | Strategies, in order | Supported when | Unsupported when | Unknown when |
|---|---|---|---|---|
| `mcp.prm.www-authenticate` | `challenge.resource-metadata`, `challenge.missing` | the decisive 401 carries `resource_metadata` | a 401 without it | no step got a 401 (every step and status named) or the ladder ended in a failure |
| `mcp.rs.scope-challenge` | `challenge.scope`, `challenge.missing` | the decisive 401 carries a non-empty `scope` | a 401 without one (header quoted) | as above |
| `mcp.prm.no-offline-access` | `prm.scopes`, `challenge.scope`, `as.scopes`, `prm.silent`, `prm.missing` | the first source that names scopes lacks `offline_access`; or only the AS names scopes and lacks it | the first of the metadata and the challenge that names scopes contains it | nothing names scopes; or only the AS does and offers it; or no PRM |

Every other row keeps its 004 meaning, as a one-strategy list plus the `prm.missing` or
`as.missing` fallback.

## Report (additive; `version` stays 1)

`checks[].via`: the deciding strategy's id (absent on recorded reports).
`discovered.challenge` gains `method`, `step`, `scope`. `discovered.endpointNote`: string or null.

> Superseded by 013-scanner-conformance: the `as.scopes` positive fallback is removed.
> When only the AS advertises scopes, the resource check is `unknown` via `prm.silent`.
