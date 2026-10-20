# Maintaining the MCP auth atlas

Everything the atlas shows is derived from YAML under `data/`. This page says how to change
it. The rules come from the constitution and `docs/data-model.md`; the executable form is
`src/schema/` and `scripts/validate-data.ts`.

## Daily commands

```sh
pnpm validate:data        # after every data edit; prints `path[index].field: message`
pnpm check:append-only    # compares data/observations against origin/main
pnpm check                # everything CI runs except the browser tests
pnpm build && pnpm test:e2e
```

## Add a specification revision

1. Append the revision to `data/specs/mcp-authorization.yaml`: `id` (the date as the spec names
   it), `date`, `status: current`, `supersedes` (the previous id), `url`, `changes`.
2. Set the previous revision's `status` to `superseded`. Exactly one revision is `current`.
3. For every feature that the new revision still defines, append an entry to its `revisions`
   list with the new `revision`, the `section` heading as the document names it, the `level`
   and, where the text qualifies it, a `levelNote`. A feature with no entry for the new revision
   is treated as removed in that revision.
4. Add new features (next section) for requirements the revision introduces.
5. `pnpm validate:data`, then `pnpm build`: the changes page for the new pair of revisions and
   the matrix for the new revision are generated from the data. Observations against the old
   revision stay visible under `/mcp/revisions/<old-id>`; cells under the new revision start as
   `unknown` until someone observes them again.

## Add or change a feature

- One file per feature in `data/features/<id>.yaml`. Ids are dotted, lower case, and stable
  once published (`mcp.<party>.<thing>`): `mcp.prm.*` and `mcp.rs.*` for the MCP server,
  `mcp.as.*` for its authorization server, `mcp.client.*` for client-side requirements, which
  never appear in the matrix.
- `revisions` lists every revision that defines the feature, oldest first. The level is what
  the specification says about the party named in `party`; `levelNote` carries qualifiers such
  as "one of two" or "deprecated".
- `observable` is `passive` when published metadata shows it (the well-known documents, and the
  `WWW-Authenticate` challenge, pointer and scope included, that the endpoint returns to a
  request without a token), `active` when a
  token, a scope or a protocol message is needed, `manual` when only documentation or source can
  show it. The atlas itself never sends requests (constitution III); `observable` tells the
  scanner what it may do.
- A feature that replaces another sets `supersedes`. Never delete a feature file that has
  observations; mark it removed by leaving it out of the newer revision.

## Add a specification or a relation (agent auth atlas)

The standards map at `/standards/` is drawn from `data/specs/*.yaml` and
`data/relations.yaml`. Nothing is laid out by hand: a spec is placed one column right of what it
builds on, profiles or replaces, in the row of its publishing body.

- One file per spec in `data/specs/<id>.yaml`. Ids are kebab-case and stable: `rfc8693`,
  `oauth-2-1`, `cimd`, `eidas-2`. Facts (title, dates, URLs) come from the publisher's own page:
  IETF Datatracker and the RFC Editor, openid.net, modelcontextprotocol.io, a2a-protocol.org,
  EUR-Lex, or the vendor's page for a vendor document. A spec whose facts cannot be confirmed
  there is not entered.
- `body` is who publishes it (`other` for CNCF, W3C and anyone the list does not name);
  `family` is what kind of document it is (`guidance` for best current practice and
  architecture documents that define no protocol).
- `maturity` is the publisher's status, not a grade: `individual-draft`, `working-group-draft`,
  `candidate` (implementer's draft, last call, submitted to the IESG), `published` (RFC, final
  specification, shipped revision), `in-force` (law), `expired`, `withdrawn`. Put the
  publisher's own label in `maturityNote` ("Proposed Standard", "Implementer's Draft 2",
  "Regulation (EU) 2024/1183").
- `revisions` lists dated revisions, oldest first, each with the exact document URL. Exactly one
  has `status: current` (the one the map dates the spec by); earlier ones are `superseded`; a
  revision published but not yet the default is `draft`. Use `changes` for what changed and what
  breaks, in the publisher's words where possible.
- A withdrawn or expired document keeps its file; set `maturity` and say why in `maturityNote`.
  A withdrawn spec leaves the map and the export but keeps its page and relations.
- Relations go in `data/relations.yaml`, one entry per edge, `from` → `to`. Types: `builds-on`
  (cannot be used without the other), `profiles` (narrows the other for one setting),
  `references` (cites it for a mechanism), `replaces` (supersedes it), `competes-with` (a
  different answer to the same question) and `solves-same-problem-as` (the same need by another
  route). The last two are judgement calls and need a `note` saying what they are based on; add
  `source` wherever the document itself states the relation. The symmetric types are stored once
  per pair. `builds-on`, `profiles` and `replaces` must not form a cycle.
- `pnpm validate:data` rejects an unknown spec, a self relation, a duplicate, a missing note and
  a cycle, naming `data/relations.yaml[i].field`.

## Add a scenario (delegation chain explorer)

1. Create `data/scenarios/<id>.yaml` (`id` equals the file name). Declare the actors in lane
   order, the features the chain exercises, the steps in order and the toggles. Every step and
   every toggle needs `cites: { spec, revision, section }` with the document's own heading, and
   the revision must already exist in `data/specs/`.
2. A step that carries a token gets `token: { name, header?, claims, note? }` with the claims
   as the specification's example would show them. Do not write change marks; the explorer
   derives them from the previous token in the chain.
3. A toggle maps a baseline step id to the steps that replace it (an empty list removes the
   step). Replacement ids may reuse the replaced step's id and no other. `violates` lists the
   feature ids the toggle defeats, so the page can point at the atlas.
4. `pnpm validate:data`, then open `/explorer/<id>/` and each toggle page in `pnpm dev`. The
   e2e tests count diagram rows against list entries for every page.

## Seed or list a server

- One file per server in `data/servers/<id>.yaml`. `listed` says why it is in the atlas and
  `source` is the public page that lists it (required unless `listed: opt-in`).
- `access` and `auth` are the server's two classes (`docs/data-model.md` › Server): who can
  connect (`public`, `closed`, `unknown`) and how the endpoint authenticates clients (`oauth`,
  `api-key`, `none`, `unknown`). Each is `{ class, method, evidence, observedAt, observedBy }`
  with the vendor's documentation page as evidence; `method` is `manual` when you read the page,
  `vendor-claim` when you only copied a directory's label. Correct a class in place with a newer
  `observedAt` and the page that shows the change; git keeps the history. Leave the field out
  rather than guess: a missing class renders as a dashed "unknown" and the server is still
  scanned. `auth: api-key` or `auth: none` takes the server out of the nightly scan and gives it
  the "No OAuth" grade; when a scan's run summary says the endpoint's answer suggests another
  class, check the page and correct the file, not the observations.
- `transport: stdio-only` makes every cell `not-applicable` without observations.
- The seed list came from `jaw9c/awesome-remote-mcp-servers` (research R4). To re-seed from a
  newer copy of that list, regenerate only servers that do not yet have a file; never overwrite
  files that carry observations.

## Record an observation

For investigation plans, controlled active checks and a preview-before-append workflow, use
`pnpm investigate --help`; [`investigations.md`](investigations.md) covers the recipes and evidence.

Append to `data/observations/<server-id>.yaml`; never edit or remove an entry. The newest
`observedAt` wins; equal timestamps are broken by method strength (`active-scan` over
`passive-scan` over `manual` over `vendor-claim`). Use `unknown` to record that you looked and
could not tell, `not-applicable` when the feature cannot apply to that server.

The quickest way is the command, which validates the entry against the schema and the dataset
before it appends anything:

```sh
pnpm observe figma mcp.as.dcr partial --by jbspeakr \
  --evidence "https://… — registration admits allowlisted client names only; others get HTTP 403"
pnpm validate:data
```

`--method` is `manual` by default, or `vendor-claim`; `--revision` defaults to the current one;
`--at` defaults to now. Then open a pull request. A manual entry stands against the nightly
scanner until the scanner sees something new for that cell (`scanner.md` › Running it); until
then each run summary lists the cell as "held by hand" when the scan disagrees.

## Scanner observations

The passive scanner (`docs/scanner.md`) writes observations with `observedBy: scanner@<version>`
and `method: passive-scan`. They follow the same append-only rule as everything else.

- Prefer `pnpm scan <server-id> --write` over a hand-written `passive-scan` entry: the evidence
  string is then reproducible by anyone who runs the same command.
- Reviewing a scanner pull request: open each evidence URL in the diff (every evidence starts
  with the well-known URL it read) and check that the quoted field still says what the entry
  claims. `unknown` means the scanner could not read a document (timeout, 5xx, a redirect to
  another host, no JSON); it is not a verdict and never turns into `unsupported` on the pages.
- Bump `SCANNER_VERSION` in `src/scanner/version.ts` whenever a check's logic or evidence format
  changes. The next run then re-records every cell once, which is how the history shows which
  scanner produced which observation.

## Withdraw a server

Set `withdrawn: { at: <date>, reason: <text> }` on the server. It leaves the matrix, the feature
pages, the sitemap and `data.json`; its page shows the notice; its observations stay in git.

## Review a data pull request

1. CI is green: schema and cross-reference validation, and the append-only check against the
   base branch.
2. Open every `evidence` URL. It has to show the claimed behaviour for that server and feature
   under that revision. A note instead of a URL is acceptable only for `manual` observations
   and must say what was done.
3. `observedAt` is plausible and `observedBy` identifies the contributor.
4. The status is the right one: `partial` needs a note in `evidence` saying what is missing;
   `unsupported` must not be used for "could not tell" (that is `unknown`).
5. Merge. The deploy workflow publishes on `main`.

## Rename an id

Ids are public URLs and export keys. If a rename is unavoidable, add a redirect (see
`docs/deploy.md`), keep the old id in `supersedes` where the model allows it, and mention it in
the pull request description.

## Refresh screenshot baselines

The Playwright screenshot tests compare against baselines in `tests/e2e/__screenshots__`.
Baselines are only valid for the Chromium build Playwright pins, because another build
rasterises fonts a few percent differently. After an intended visual change, either run
`pnpm exec playwright install chromium && pnpm build && pnpm test:e2e --update-snapshots`
locally with that pinned build, or add the `refresh-screenshots` label to the pull request:
the screenshots workflow regenerates the baselines with CI's browser, commits them to the
branch and removes the label. A push made by that workflow does not start CI, so push any
further commit (or merge the base branch) to get a green run.

Scanner pull requests must not need new baselines. The scanner screenshots set every
`[data-nightly]` element (counts and dates the nightly run changes) to a fixed value and mask the
grades and report rows, so mark any new nightly-changing text on those pages with `data-nightly`.
