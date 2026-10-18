# Data Model: Breach Anatomy

## Vulnerability (amended)

| Field | Type | Change |
|---|---|---|
| `class` | enum | adds `redirect-uri`, `pkce-bypass`, `untrusted-metadata`, `tenant-isolation`, `token-theft` |
| `summary` | string | new, required: what failed and which control would have stopped it |
| `disclosed` | date | new, required: the advisory's or notice's date |
| `fixed` | string? | new: fixed version or remediation, as stated |
| `affects` | string[] | now at least one |
| `sources` | url[] | unchanged, at least one; the advisory first |

Rules:

1. Rule 8 (data model): `scenario` and the toggle's `vulnerability` point at each other.
2. Entries are corrected in place by pull request; git keeps the history.
3. `features` may be empty; the page then says no atlas requirement covers the control.

## Toggle (unchanged shape)

`vulnerability` must name an entry whose `scenario` is this toggle's scenario.
