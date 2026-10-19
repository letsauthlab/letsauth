# The scanner

The scanner (roadmap 004, `specs/004-scanner/`; the discovery challenge check is roadmap 008,
`specs/008-discovery-challenge/`; the composable discovery strategies are roadmap 010,
`specs/010-discovery-strategies/`) automates what the MCP auth atlas did by hand: it reads the
public authorization metadata of every listed server, judges the passively observable
requirements of the current MCP Authorization revision, and writes the result as observations,
each with the URL it read as evidence. It is the one piece of the project
that contacts other servers, and it runs in exactly one place: a scheduled job on the project's
own backend (Scaleway, EU region). Nothing on the site triggers a scan, and the only output of a
run is a pull request against this repository.

## What it reads, and never does

For a server URL `https://h/p` it fetches, with `GET` over HTTPS and no credentials:

1. `https://h/.well-known/oauth-protected-resource/p` (RFC 9728, path-aware), then
   `https://h/.well-known/oauth-protected-resource` (root);
2. `https://h/p` itself, in a ladder of unauthenticated requests that stops at the first 401
   (`src/scanner/discovery.ts`): a `GET` with the `Accept` header an MCP client sends; then, only
   when the `GET` got a definite status other than 401 or a redirect off the host, a `POST` with
   an empty body and the JSON content type, which carries no JSON-RPC message (a streamable HTTP
   server may answer `GET` with 405 before authenticating, as the transport allows, and
   authenticates the `POST` like a client's first call). Only the status and the
   `WWW-Authenticate` header are read, and the body is cancelled before a byte of it is
   consumed. A `registration_endpoint` in the metadata says that registration is offered, not
   that it is open to any client; the atlas carries that distinction as a manual `partial`.
   A 401 with a `resource_metadata` parameter is the other discovery mechanism the
   specification allows (`mcp.prm.www-authenticate`); its `scope` parameter is the scope
   challenge (`mcp.rs.scope-challenge`); any other status on every step is `unknown`, never a
   failure. A failure to connect ends the ladder;
3. when step 1 found nothing and step 2 named a `resource_metadata` URL: that document, under
   the same rules as every other metadata URL (it is guarded like an issuer, so a non-public
   host or a plain-http pointer is refused and recorded);
4. for the first issuer in `authorization_servers`:
   `/.well-known/oauth-authorization-server<path>`, `/.well-known/openid-configuration<path>` and
   `<path>/.well-known/openid-configuration` (the three locations the MCP specification names).

That is all: at most eight requests, never with a token, never a body sent, never a protocol
message, never an authorization flow. The request to the endpoint reads what the specification requires
the server to tell every client without a token; `specs/008-discovery-challenge/spec.md` says
why that is still a passive scan under the constitution. Redirects are followed only to the same
host over HTTPS. URLs that are not
HTTPS, carry credentials or a port, name an IP address or a local name, or resolve to a private
address are refused, whether they are a listed server's URL or an issuer found in metadata. The
`User-Agent` is `letsauth-scanner/<version> (+https://letsauth.eu/mcp/scanner/)`.

Every status is decided by the table in `specs/004-scanner/data-model.md` (the challenge row is
in `specs/008-discovery-challenge/data-model.md`). A document that could
not be fetched (timeout, connection, TLS, 429, 5xx, refused redirect) makes every check that depends
on it `unknown`; `unsupported` is written only when a document was fetched and the field is
absent or wrong. `partial` is written only when some but not all authorization server endpoints
use HTTPS.

## Strategies: how a cell is decided

A check is an ordered list of strategies (`src/scanner/strategies.ts`, the lists in
`src/scanner/checks.ts`). Each strategy reads one source the probe discovered and either decides
the cell or passes to the next; the last one always decides, usually `unknown` with the reason.
The report's JSON names the strategy that decided (`via`), and the evidence names its URL. For
example `mcp.prm.no-offline-access` reads, in order:

1. `scopes_supported` in the protected resource metadata (`prm.scopes`);
2. the `scope` parameter of the 401 challenge, when the metadata names no scopes
   (`challenge.scope`);
3. otherwise `unknown`, with the reason (`prm.silent`). RFC 8414 §2 allows the authorization
   server to omit supported scopes; its list cannot establish which scopes this resource requests.

Before metadata drives a check or issuer discovery, its required `resource` must be a valid
HTTPS identifier bound to its discovery route (RFC 9728 §3.3). Path metadata identifies the
endpoint path; root metadata identifies the origin; challenge metadata identifies the challenged
endpoint. An invalid candidate is retained as evidence while discovery tries the remaining
locations. Without a valid candidate, `mcp.prm` is unsupported and dependent metadata is not used.
Issuer matching is exact, including trailing slashes (RFC 8414 §3.3).

Adding a way to judge a requirement is adding a strategy to its list; adding a way to reach a
source is adding a step to the ladder in `discovery.ts`. Both are tables a reader can check
against the decision table in `specs/004-scanner/data-model.md`.

When every step of the endpoint ladder answers 404 or 410, or every step is a redirect the
scanner would not follow, the report carries an `endpointNote` and the run summary shows it in
the Notes column: the listed URL is probably stale (servers that retired an `/sse` path usually
answer at `/mcp`). The fix is to the server file, by pull request; nothing is written to the
observations for it.

The report also carries an `authSuggestion` (009): `oauth` when a 401 challenge named a
`resource_metadata` pointer or a protected resource metadata document was found by either route,
`none` when a step of the ladder was accepted with 200, otherwise null (a bare 401 settles
nothing: a bearer challenge may guard an API key as well as an OAuth token). When the suggestion
differs from the server's stated `auth` class, or the class is not stated, the run summary's Notes
column says so. Like the stale-URL note, it is a hint for the maintainer, fixed in the server
file; the scanner never writes a class.

## Running it

```sh
pnpm scan https://mcp.example.com/mcp     # a report in the terminal, nothing written
pnpm scan notion                          # a listed server by id
pnpm scan notion --write                  # append the observations the nightly rule would
pnpm scan --all --write --summary out.md  # what the nightly job runs
pnpm scan notion --json                   # the report as JSON (contracts/report.md)
```

`--write` appends only what the append rule says. The scanner compares with its own last
observation of a cell, never with a person's: it writes when it has none, when its last one came
from an older scanner version, or when the status or the evidence differ from what it sees now.
A newer `manual` or `vendor-claim` observation therefore stands until the scanner sees something
new; when such an observation disagrees with the scan (Figma advertises a registration endpoint
that only admits allowlisted client names, recorded by hand as `partial`), the run summary names
the cell as "held by hand" instead of writing over it. Nothing is edited;
`pnpm check:append-only` passes by construction. A contributor who runs `--write` opens a pull
request with the result like any other data change.

## The nightly job

A Scaleway Serverless Job runs `pnpm scan:nightly` (`scripts/scan-nightly.ts`) every night at
03:17 UTC from the image `Dockerfile` builds. One run:

1. shallow-clones `main` with the job's GitHub token and installs dependencies;
2. runs `pnpm scan --all --write --summary scan-summary.md` over every listed server that is not
   withdrawn, has an HTTP transport and whose `auth` class is not `api-key` or `none` (a server
   that fails is recorded as `unknown`; one whose class is not yet stated is scanned, and the
   summary says what its endpoint's answer suggests);
3. runs `pnpm validate:data` and `pnpm check:append-only`; a failure aborts the run and nothing
   is pushed;
4. when nothing under `data/observations/` changed, logs "nothing to append" and stops;
5. otherwise commits to a new branch `scanner/<date>-<hhmm>` (UTC), pushes it, and opens one pull
   request `Scanner: <date> <hh:mm> UTC` whose description is the run summary (per server the
   grade, the cells appended and the checks that could not be judged);
6. keeps earlier scanner pull requests and branches open: each run compares against `main`,
   and later results do not include every earlier unmerged observation. Review and merge pending
   evidence in chronological order, resolving append-only list conflicts by retaining both runs.

The token never appears in a command line, a remote URL or a log: git reads the auth header from
`GIT_CONFIG_*` environment variables, pnpm and the scanner run without it, every child process's
output is captured rather than inherited, and everything the job prints passes through a redactor
that removes the token, its basic-auth form and the App's private key. If a credential ever does
reach a log or a chat, revoke it on GitHub (the App's private key, or the personal token) and
replace the secret in Scaleway.

The pull request is opened by the scanner's own identity, so CI runs on it like on any other.
Nothing is merged without review. `specs/004-scanner/contracts/job.md` is the contract.

**Environment of the job**: `SCANNER_REPO` (`letsauthlab/letsauth`), `SCANNER_BASE` (`main`), and
the scanner's credentials, which live in the job definition on Scaleway, never in the image or
the repository:

- **GitHub App (preferred)**: `SCANNER_APP_ID` and the secret `SCANNER_APP_PRIVATE_KEY`. Each run
  signs a JWT with the key and exchanges it for an installation token valid for one hour, limited
  to this repository and to *Contents: write* and *Pull requests: write*. Commits and pull
  requests show up as `<app-slug>[bot]`.
- **Personal token (fallback)**: the secret `SCANNER_TOKEN`, a fine-grained token for this
  repository with the same two permissions. Used only when no App is configured.

### The scanner's GitHub App

Set up once, by the owner:

1. The `letsauthlab` organisation → Settings → Developer settings → GitHub Apps → New GitHub App
   (`https://github.com/organizations/letsauthlab/settings/apps/new`). Name it, for example,
   `letsauth-scanner` (the name becomes the bot's name). Homepage: `https://letsauth.eu/mcp/scanner/`.
   Untick *Webhook → Active*. Repository permissions: *Contents: Read and write*, *Pull requests:
   Read and write* (*Metadata: Read-only* is added automatically); nothing else. *Where can this
   GitHub App be installed?* Only on this account (the organisation).
2. On the App's page note the *App ID*, then *Generate a private key*; a `.pem` file downloads.
3. *Install App* → only `letsauthlab/letsauth`.
4. In the Scaleway job definition set `SCANNER_APP_ID` to the App ID and the secret
   `SCANNER_APP_PRIVATE_KEY` to the `.pem` contents (as is, with `\n` escapes, or
   base64-encoded on one line: all three are accepted).
5. Run the job once by hand; its log starts with `authenticated as GitHub App <slug>[bot]`. Then
   delete `SCANNER_TOKEN` from the job and revoke that personal token on GitHub.

To rotate, generate a new private key on the App's page, replace the secret, delete the old key.

**Reviewing a scanner pull request.** Open each evidence URL in the diff; it is the metadata
document that decided the status. `unknown` means the scanner could not tell (the evidence names
the failure), not that the feature is missing. A wrong status is never fixed by editing the
entry: fix the check in `src/scanner/checks.ts`, bump `SCANNER_VERSION`, and the next run
re-observes every cell.

**When to bump `SCANNER_VERSION`** (`src/scanner/version.ts`): whenever a check's logic or its
evidence text changes (0.3.0: the endpoint ladder, the scope challenge and the scope fallbacks). The append rule treats cells written by an older version as not yet
measured, so the next run rewrites them all.

## Deploying to Scaleway

The image reaches Scaleway only through `.github/workflows/scanner-deploy.yml`, which runs after
CI has passed on `main` for a commit that touches the scanner (`Dockerfile`, `src/scanner/`, the
scan scripts, the lockfile), never on a red commit, or by hand from the Actions tab. It builds the image, pushes it to the project's
Scaleway Container Registry as `letsauth-scanner:<commit>` and `:latest`, and points the job
definition at the new tag. The scan itself never runs on GitHub.

Set up once, by the owner:

1. Create a Scaleway project in an EU region (`fr-par` or `nl-ams`) and a Container Registry
   namespace in it. Create an API key for the project with permissions to push to the registry
   and to manage Serverless Jobs.
2. Create the Serverless Job definition (console: Serverless → Jobs → Create job definition, or
   `scw jobs definition create`; check `scw jobs definition create --help` for the exact option
   names of your CLI version):
   - image: `rg.<region>.scw.cloud/<namespace>/letsauth-scanner:latest` (the first deploy run
     pushes it; the definition can be created before or after that),
   - command: `pnpm scan:nightly`,
   - cron schedule: `17 3 * * *` (UTC),
   - resources: 1 vCPU, 1 GB memory, timeout 30 minutes, no private network,
   - environment variables: `SCANNER_REPO=letsauthlab/letsauth`, `SCANNER_BASE=main`,
   - secrets: `SCANNER_APP_ID` and `SCANNER_APP_PRIVATE_KEY` (see "The scanner's GitHub App"), or
     the fallback `SCANNER_TOKEN`, as secret references (Secret Manager) or, where the
     definition offers no secret field, as environment variables.
3. In the repository's `production` environment, set the secrets `SCW_ACCESS_KEY`,
   `SCW_SECRET_KEY`, `SCW_DEFAULT_PROJECT_ID`, `SCW_DEFAULT_ORGANIZATION_ID` and the variables
   `SCW_REGION` (if not `fr-par`), `SCW_REGISTRY_NAMESPACE` and `SCW_JOB_DEFINITION_ID` (the id
   of the definition from step 2).
4. Run the "Scanner deploy" workflow once by hand. From then on every merge that touches the
   scanner redeploys, and the job's next run uses the new image. Start the job once from the
   console to get the first scanner pull request without waiting for the night.

The workflow never creates or changes the job's schedule, resources or secret; it only moves
the image forward, so those settings stay where the owner put them.

## The grade

Shown on report pages, on atlas server pages and next to each server name in the atlas matrix,
never used to sort or rank:

1. F when a MUST-level check is unsupported or partial.
2. Withheld (no letter) when a MUST-level check is unknown.
3. C when every MUST-level check is supported and a SHOULD-level check is unsupported or partial.
4. B when every MUST-level check is supported, no SHOULD-level check fails, and a SHOULD-level
   check is unknown.
5. A when every MUST-level and SHOULD-level check is supported.

A MUST the server may meet in either of two ways is met when either way is supported, and counts
as unknown while the other way is unknown. Protected resource metadata may be served at a
well-known location or announced in the `WWW-Authenticate` challenge; the scanner reads both, so
a server that offers only the challenge is graded, one where the challenge could not be judged
and the well-known document is missing is withheld, and only a server that offers neither fails
on discovery. MAY-level and deprecated requirements are listed and never change
the grade. Servers whose `auth` class (`docs/data-model.md` › Server, roadmap 009) is `api-key`
or `none` are neither scanned nor graded ("No OAuth"); the class is an evidenced statement on the
server file.

## What there is not

There is no on-demand scanning. The site has no endpoint that accepts a URL, the scanner pages
ship no JavaScript, and no visitor can cause a request to any server. A server owner who wants
to see their server's report asks for it to be listed; a contributor who wants fresh cells runs
`pnpm scan <id> --write` and opens a pull request.

## Opting out

A server owner who does not want their server scanned withdraws it from the atlas through the
[issue form](https://github.com/letsauthlab/letsauth/issues/new?template=observation.yml) ("withdraw
my server"); a withdrawn server is never contacted again. The scanner only ever reads what a
server publishes for every client, the well-known documents and the challenge it sends to anyone
without a token, and identifies itself in every request.

### Transport safety

Each HTTPS connection uses the public DNS addresses validated for that request, through a pinned
lookup. The original hostname remains the HTTP host and TLS identity. Redirects repeat validation;
no pooled connection can bypass it. HTTP 429 is uncertainty, not missing metadata, in every fetch
mode. Timeouts and connection errors while consuming a response body are recorded as errors so
discovery can continue to its next candidate.
