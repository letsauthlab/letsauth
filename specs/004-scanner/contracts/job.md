# Contract: The nightly job and its deployment

The scanner runs in exactly one place: a Scaleway Serverless Job in an EU region, on a cron
schedule, from the image the repository's `Dockerfile` builds. It produces nothing but a pull
request against this repository. There is no HTTP endpoint, no on-demand scan and no scanning
triggered by visitors (owner decision, 2026-10-14).

## The job

| Item | Value |
|---|---|
| Image | `rg.<region>.scw.cloud/<namespace>/letsauth-scanner:<commit>` built from `Dockerfile` |
| Command | `pnpm scan:nightly` (`scripts/scan-nightly.ts`) |
| Schedule | `17 3 * * *` (03:17 UTC, once a night) |
| Resources | 1 vCPU, 1 GB memory, timeout 30 minutes; no network listener; nothing persisted |
| Environment | `SCANNER_REPO` (`letsauthlab/letsauth`), `SCANNER_BASE` (`main`) |
| Secret | Preferred: `SCANNER_APP_ID` and `SCANNER_APP_PRIVATE_KEY` of the scanner's GitHub App; each run mints an installation token valid for one hour, limited to this repository with *Contents: write* and *Pull requests: write*, and commits and pull requests carry the App's bot identity. Fallback: `SCANNER_TOKEN`, a fine-grained token with the same scope. Stored as the job's secrets, never in the image or the repository |

What one run does, in order:

1. Shallow-clones the base branch of `SCANNER_REPO` with the token (sent as an `Authorization`
   header, never placed in a remote URL) and installs dependencies.
2. Runs `pnpm scan --all --write --summary scan-summary.md`: every listed server that is not
   withdrawn, has an HTTP transport and is not listed as open or API-key, sequentially, at most five `GET` requests each to the
   well-known metadata locations, the authorization server metadata cached per issuer. A server
   that fails is recorded as `unknown` and does not stop the run.
3. Runs `pnpm validate:data` and `pnpm check:append-only HEAD`; a failure aborts the run with
   exit 1 and nothing is pushed.
4. When nothing under `data/observations/` changed: logs `nothing to append`, exit 0.
5. Otherwise commits the appended entries to a new branch `scanner/<date>-<hhmm>` (UTC, unique per
   run) with the summary as the commit body, pushes it without force, and opens one pull request
   `Scanner: <date> <hh:mm> UTC` against the base branch with the summary as its description and
   the label `data`. Earlier scanner pull requests stay open (014). Exit 0.

Since 018, between steps 1 and 2 the run lays the observations of every open scanner pull
request over the clone, so the append rule compares with pending evidence too, and before step 3
it takes that overlay back out: step 4 then finds nothing when the scan saw nothing beyond `main`
and the pending pull requests, and step 5 carries only what is new. The pull request's
description names the pending pull requests it was compared with.
6. The token is never part of an argument list, a remote URL, the clone's config or any printed
   message: git reads the `Authorization` header from `GIT_CONFIG_*` environment variables, other
   commands run without the token in their environment, child output is captured rather than
   inherited, and everything the job writes to stdout and stderr is redacted.

The pull request is opened with a personal token, so CI runs on it like on any other pull
request. Nothing is merged without review.

## The run summary (pull request description)

A Markdown table with one row per scanned server: name, grade (letter, "withheld" or "not
graded"), cells appended, checks `unknown`, and the first failure reason when one exists;
followed by the scanner version, the revision judged and the start time.

## The deployment workflow

`.github/workflows/scanner-deploy.yml` is the only path by which the image reaches Scaleway. It
runs after CI has passed on `main`, for a commit that touches the scanner (`Dockerfile`, `src/scanner/`, the two scripts,
the lockfile) and on `workflow_dispatch`, in the `production` environment:

1. Builds the image and pushes it to the Scaleway Container Registry as `<commit>` and `latest`.
2. Updates the Serverless Job definition so its next run uses `<commit>`.

| Configuration | Where | Meaning |
|---|---|---|
| `SCW_ACCESS_KEY`, `SCW_SECRET_KEY` | repository secrets | an API key of the Scaleway project, with registry push and Serverless Jobs write |
| `SCW_DEFAULT_PROJECT_ID`, `SCW_DEFAULT_ORGANIZATION_ID` | repository secrets | the project and organisation the job lives in |
| `SCW_REGION` | repository variable | an EU region, default `fr-par` |
| `SCW_REGISTRY_NAMESPACE` | repository variable | the Container Registry namespace |
| `SCW_JOB_DEFINITION_ID` | repository variable | the Serverless Job definition created once by the owner (`docs/scanner.md`) |

The job definition (schedule, resources, environment, the `SCANNER_TOKEN` secret) is created once
by the owner; the workflow only ever changes its image. The scan never runs on GitHub's runners.
