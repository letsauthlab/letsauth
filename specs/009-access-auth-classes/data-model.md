# Data Model: Server access and auth classes

## Server (amended)

| Field | Type | Notes |
|---|---|---|
| `access` | Classification? | `class`: `public`, `closed`, `unknown` |
| `auth` | Classification? | `class`: `oauth`, `api-key`, `none`, `unknown` |
| `authClaimed` | — | removed: the directory's label, replaced by `auth` with evidence |

## Classification (new shape)

| Field | Type | Notes |
|---|---|---|
| `class` | enum | per field above |
| `method` | enum | `manual`, `vendor-claim`, `passive-scan`, `active-scan` (the observation enum) |
| `evidence` | string | URL or note; starts with the vendor page where one exists |
| `observedAt` | datetime | |
| `observedBy` | string | handle |

Rules:

1. A missing statement is a *derived* `unknown`: rendered faint and dashed, matched by the filter
   value `unknown`, never read as a class.
2. A statement is corrected in place by pull request with a newer `observedAt` and the page that
   shows the change. Git keeps the history. Observations stay append-only; a class is not one.
3. `auth.class` of `api-key` or `none` takes the server out of the scan targets and gives it the
   grade "No OAuth" with the class in the reason. `oauth`, `unknown` and a missing statement are
   scanned.
4. `access` changes nothing the scanner does.

## Report (scanner, additive; `version` stays 1)

`discovered.authSuggestion`: `"oauth"` when the probe found a 401 challenge with
`resource_metadata` or a protected resource metadata document by either route; `"none"` when a
step of the endpoint ladder answered 200; `null` otherwise. A recorded report has `discovered`
null, as before.

## Run summary

The Notes column gains, per server, `auth class <stated or "not stated">; the endpoint's answer
suggests <oauth|no authentication>` when the class is not stated or differs from the suggestion.
