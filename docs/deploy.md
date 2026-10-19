# Deployment

letsauth.eu is a static Astro site on Bunny Storage (EU) behind a Bunny CDN pull zone.
The workflow builds with the existing pinned Node/pnpm toolchain and passes `dist/` to
[Bunny's official deploy-site action](https://github.com/BunnyWay/actions/tree/deploy-site_0.1.1/deploy-site).
No repository-owned uploader, manifest, pruning engine or separate purge step is needed.

## Trust and publication

Only successful push CI from this repository's `main`, or manual dispatch on current `main`,
can deploy. Both production workflows serialize deployments and reject stale candidates before
checkout or secret-bearing steps. The scanner builds every eligible main snapshot.

The action is pinned to the commit for deploy-site 0.1.1, and its CLI to **0.20.0**.
That CLI includes `.well-known` files and supports importing existing zones. Update both pins
deliberately and rerun the migration smoke checks below. Do not accept the action's default
CLI range: it selects an older generation of Sites.

The existing protected `production` job environment remains in place. Action-created deployment
records are disabled: the action records `github.sha`, which on `workflow_run` need not be the
tested `head_sha` checked out by this workflow. No additional `deployments: write` permission
is granted.

## Required setup before merging the action migration

This is an operator-run migration, not CI provisioning. No live Bunny settings are changed by
opening the PR. Merge the workflow-hardening PR first.

1. Review/export the existing pull-zone settings and edge rules, and retain a known-good build.
   Confirm the storage zone and all replicas are in the EU. Identify its exact name or ID.
2. Install `@bunny.net/cli@0.20.0` and authenticate locally with `bunny login`.
3. Import the existing zone, reviewing the CLI's confirmation:
   `bunny sites create letsauth --from-zone <existing-zone-name-or-id> --no-link`.
   This preserves the storage region, pull zone and hostnames. Import requires exactly one
   attached pull zone, no attached middleware script, and no conflicting reserved root entries
   (`_bunny` or `deploys`). Stop and review any conflict; do not delete or detach resources
   just to satisfy import. Existing unrelated edge rules remain and need conflict review.
4. Import writes Sites metadata and blocks internal paths immediately. Existing root content
   remains served until the first Sites deploy. That first deploy changes routing and caching,
   including a 30-day edge cache and browser revalidation for HTML; review this change.
5. Set the production-environment variable `BUNNY_SITE` to `letsauth` (or the actual imported
   site name). Keep `BUNNY_API_KEY`: it must be the Bunny account API key, not a storage password.
   The action now uses it for Sites operations, not only cache purge. Keep environment approval
   and main-only deployment restrictions enabled. `PLAUSIBLE_DOMAIN=letsauth.eu` is unchanged.
6. Merge this PR only after import and configuration are complete. The first successful main CI
   run publishes through Sites. Never run the old root uploader after this cutover: it no longer
   updates the release served by Sites.

The workflow no longer reads `BUNNY_STORAGE_KEY`, `BUNNY_STORAGE_ZONE`,
`BUNNY_STORAGE_HOST` or `BUNNY_PULL_ZONE_ID`. Remove those environment secrets after a successful
cutover and recovery review, not as part of this code change. No secrets belong in the repository.

## Verify the first deployment

Check the production hostname and its b-cdn.net alias:
- Home, `/mcp/`, `/standards/`, nested pages and their assets work.
- `/.well-known/security.txt` and other generated discovery files are served.
- A nonexistent URL returns the custom 404 with a 404 status, not an SPA fallback.
- Existing redirect rules, JSON exports and Pagefind search still work.
- A known removed page/export returns 404 after publication and purge.
- `/deploys/<id>/` and `/_bunny/` cannot expose historical releases or metadata.

## Release history and recovery

Sites uploads each release into an immutable directory, switches its routing rules and purges
the cache. Files absent from the new build are no longer served at their old public paths;
historical files remain in storage. This is withdrawal from serving, not physical data erasure.
CDN changes still propagate; verify the public endpoints rather than assuming zero propagation time.

Use `bunny sites deployments list letsauth` to inspect history. After there are two Sites releases,
`bunny sites deployments publish --previous letsauth` rolls back through the vendor CLI.
A rollback can re-expose withdrawn content: choose its target deliberately.

The original pre-import root is not a Sites release and cannot be selected with `--previous`.
If the first cutover fails, use the retained known-good build with
`bunny sites deploy <known-good-build-directory> --site letsauth`.
Reverting the workflow alone is not an infrastructure rollback.

Old releases accumulate. Review `bunny sites deployments prune letsauth --keep 10` manually
when needed; no automated deletion policy is introduced here.

## Manual deploy

Use the Actions tab on current `main`. Local deployment, when explicitly intended, is
`pnpm build` followed by `bunny sites deploy dist --site letsauth`; it publishes immediately.

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

## Vendor references

- [Action inputs and behavior](https://github.com/BunnyWay/actions/blob/deploy-site_0.1.1/deploy-site/README.md)
- [CLI 0.20.0 import implementation](https://github.com/BunnyWay/cli/blob/v0.20.0/packages/cli/src/commands/sites/create.ts)
- [CLI 0.20.0 file selection](https://github.com/BunnyWay/cli/blob/v0.20.0/packages/cli/src/commands/sites/uploader.ts)
