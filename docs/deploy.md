# Deployment

letsauth.eu is a static site served by a Bunny CDN pull zone whose origin is a Bunny Storage
Zone in an EU region (constitution VII). `.github/workflows/deploy.yml` runs after the CI workflow
has passed for a push to this repository's `main`, builds that commit, uploads `dist/` with
the existing Bunny Storage API uploader and purges the pull zone. Fork and pull-request CI runs cannot deploy.
Both production workflows serialize deployments and compare the triggering SHA with current
`main` before checkout or secret-bearing steps, so delayed CI cannot roll production back.
The scanner builds each eligible main snapshot; a per-commit path filter could miss changes
from a skipped older deployment.

## One-time setup in Bunny

1. Create a **Storage Zone** in an EU region (for example Falkenstein, `DE`). Note its name and
   the region host shown in its FTP & API Access panel (for example `storage.bunnycdn.com` for
   Falkenstein, `uk.storage.bunnycdn.com` for London).
2. Create a **Pull Zone** with the storage zone as origin and attach the `letsauth.eu` hostname
   with a free SSL certificate. Note the pull zone id (in the URL of its dashboard page).
3. In the pull zone, enable **Optimizer** only if wanted; enable **Brotli** and set the default
   cache time to one day. No URL rewriting is needed: the build writes every page as
   `<path>/index.html` and links with a trailing slash, which the storage zone serves as is.
   Optional: add an edge rule that redirects a request without an extension and without a
   trailing slash to `{{path}}/`, so hand-typed URLs like `/mcp` land on the page too.
4. In the storage zone, set the **custom 404 file path** to `/404.html`, so a missing page shows
   the site's own not-found page (built from `src/pages/404.astro`) with a 404 status.

## GitHub secrets and variables

Set these in the repository's `production` environment (Settings → Environments → production):

| Name | Kind | Value |
|---|---|---|
| `BUNNY_STORAGE_KEY` | secret | The storage zone's password (API access key). |
| `BUNNY_STORAGE_ZONE` | secret | The storage zone name. |
| `BUNNY_STORAGE_HOST` | secret | The region host, for example `storage.bunnycdn.com`. |
| `BUNNY_PULL_ZONE_ID` | secret | Numeric id of the pull zone. |
| `BUNNY_API_KEY` | secret | Account API key (Account → API), used only for the purge call. |
| `PLAUSIBLE_DOMAIN` | variable | `letsauth.eu`. When unset, no analytics script is emitted. |
| `BUNNY_SYNC_EDGE_RULES` | variable | `true` to sync the managed edge rules on every deploy. Required when `PLAUSIBLE_DOMAIN` is set. |

The storage key only grants access to that one zone; the account API key is used for the purge
call alone. Rotate both from the Bunny dashboard and update the secrets.

## Plausible through letsauth.eu

Pages load the site's personal Plausible script from `/r/s.js` and it sends events to
`/r/e.json`, both on letsauth.eu. Two pull zone edge rules forward them to plausible.io: the
script to `https://plausible.io/js/<personal script>` (cached for an hour), the events to
`https://plausible.io/api/event` with the visitor's IP in `X-Forwarded-For` (without it,
Plausible sees every visit come from the CDN and its bot filter drops them). The paths are
neutral on purpose: blocklists match `/js/script.js` and `/analytics/`, and they have an
extension because Bunny answers an extensionless path with a 301 before an edge rule applies
([Plausible's proxy guide](https://plausible.io/docs/proxy/introduction)). The personal script
name is `PLAUSIBLE_SCRIPT` in `src/lib/reach.ts` (Plausible, site settings, "Site
installation"); change it there if Plausible issues a new one.

The rules live in `scripts/lib/bunny-edge-rules.ts`. `pnpm edge-rules` prints them;
`pnpm edge-rules --apply` (with `BUNNY_API_KEY` and `BUNNY_PULL_ZONE_ID`) syncs them. The deploy
workflow runs the sync before the upload once `BUNNY_SYNC_EDGE_RULES` is `true`, and fails while
`PLAUSIBLE_DOMAIN` is set without it, because the pages would load a path nothing forwards.
Only rules whose description starts with `[repo] ` are created, updated or deleted; rules made
by hand in the dashboard, such as the redirects below, are left alone.

Outbound link clicks and file downloads are the script's own, switched on in the Plausible site
settings; the init snippet adds `json` to the download extensions so the exports count.
Pageviews are sent by `src/lib/reach.ts` (a neutral name, because bundles are named after
their modules and blocklists match "analytics" in a path) (`autoCapturePageviews: false`), only on
letsauth.eu or www.letsauth.eu and never under automation (Playwright, Lighthouse): a page
prerendered by speculation rules waits for `prerenderingchange`, so it counts once if opened and
never if not. A back/forward cache restore and an island's in-place navigation count again. A
404 also sends a `404` event with a `path` property; add it as a custom event goal to see it.

## Manual deploy

`workflow_dispatch` runs the same workflow from the Actions tab, restricted to the current
`main` commit.

## Known limitation: withdrawals

The upload-and-purge deployment does not delete files absent from the new build. Removed pages
and withdrawn JSON exports can therefore remain accessible at their old URLs. Cache purging
alone does not remove origin files. Until the separate official Bunny Sites migration is complete,
withdrawals require operator removal of the exact obsolete origin files followed by cache purge.
Uploads remain non-atomic; this workflow hardening does not claim to fix publication semantics.

## Moved pages and renamed ids

A server or feature id is stable once published (data-model.md). If one must change, keep the
old page as a redirect: add a Bunny edge rule (Redirect, 301) from the old path to the new one.

When a page moves, add the old path to `redirects` in `astro.config.mjs`: the build writes a
small forwarding page there, so the old link works with no change in Bunny. A JSON export cannot
be forwarded that way (the forwarding page is HTML), so a moved export needs an edge rule. The
page tree was flattened in October 2026 (`architecture.md`, "Pages"); these exports moved and
want a 301 edge rule each, old path to new path, with the id wildcarded:

| Old | New |
|---|---|
| `/atlas/mcp/data.json` | `/mcp/data.json` |
| `/atlas/mcp/servers/<id>.json` | `/mcp/servers/<id>.json` |
| `/atlas/standards/data.json` | `/standards/data.json` |
| `/scanner/<id>.json` | `/mcp/servers/<id>/scan.json` |

The page redirects for that move live in `astro.config.mjs` as well; a 301 edge rule for each of
those prefixes (`/atlas/mcp/`, `/atlas/standards/`, `/scanner/`) is optional and only makes the
forward faster and keeps the status code honest.
