<!--
Sync Impact Report
- Version change: 1.0.1 → 2.0.0 (MAJOR: principles rewritten as verifiable laws; product list,
  technology and changelog rules removed)
- Modified principles: all seven keep their number and subject, so existing citations such as
  "constitution VII" still point at the right rule.
  - I. One Model, Many Views → I. One Shared Model (same rule, no list of products)
  - II. Every Claim Cites a Revision (unchanged in substance)
  - III. Neutral and Passive by Default (drops the owner-proven-control rule for active probes;
    any request beyond public metadata is instead justified in its spec before it runs)
  - IV. Static First, Open Data → IV. Open, Reviewed, Append-Only Data (append-only and
    evidence move here from Development Workflow; no file format named)
  - V. Craft and Budgets → V. Accessible and Within Budget (budget numbers move to tech-stack.md)
  - VI. Agent-Legible Repository (tool names move to tech-stack.md)
  - VII. European by Default (European regulation is no longer required content)
- Added sections: none. New file .specify/memory/tech-stack.md holds the former Technology
  Constraints, the budget numbers and the agent tooling.
- Removed sections: Technology Constraints (moved to tech-stack.md); the product list in the
  preamble (products live in docs/roadmap.md); the changelog and newsletter rule.
- Templates: plan, spec and tasks templates need no change; plan-template derives its
  Constitution Check gates from this file.
- Follow-up TODOs: none. Remove this comment when the amendment is merged.
-->
# letsauth.eu Constitution

These are the laws of the letsauth.eu repository. Every spec, plan, task and pull request MUST
comply with them, and a reviewer can check each one with a yes or no.

The constitution names no products and no technologies. What gets built, and in what order, is in
`docs/roadmap.md`. The tools and budget numbers in use today are in
`.specify/memory/tech-stack.md`. Both can change without amending this file.

## Core Principles

### I. One Shared Model

Every product reads from and writes to one data model, described in `docs/data-model.md`. No
product keeps a private copy of its entities. A product that needs a field the model lacks amends
the model first, in its own pull request, and every view of that entity picks the field up.

### II. Every Claim Cites a Revision

Every status, feature, scenario step and scan result MUST link to the specification revision and
section it rests on. A claim without a citation does not ship, and the build fails on a dangling
one. A claim is read against the revision it cites; when a newer revision appears, affected pages
say so and nothing is silently re-read against it.

### III. Neutral and Passive by Default

Nothing is ranked or scored by anything other than the data, and no vendor pays for placement or
wording. Missing data is shown as unknown, never as a failure. Contact with third-party systems is
passive by default: public information only, no credentials, no authorization flows. Any
request beyond public metadata is justified in its spec before it runs, and only the scheduled
scanner or a contributor may start one; a visitor and the site build never do.

### IV. Open, Reviewed, Append-Only Data

The site is pre-rendered from data that lives in the public repository and is validated against
the schema. Data, code and automated output all change only through reviewed pull requests with
passing CI. Every observation carries a date, a method and evidence a reviewer can open or verify.
An observation is never edited or removed: a correction is a newer entry, and history stays
visible.

### V. Accessible and Within Budget

Every page meets the accessibility level set in the tech stack, renders in light and dark,
respects reduced motion, works at phone width without horizontal scroll and reads fully without
JavaScript. One design token system is defined once and used everywhere. Performance budgets are
enforced in CI; a page over budget needs a documented exception.

### VI. Agent-Legible Repository

The repository is built to be worked on by coding agents as much as by people. Every check runs
headless with one command and prints actionable output. A visual change can be verified by an
agent through screenshot comparison. Agent instruction files point at this constitution and
contain nothing that contradicts it.

### VII. European by Default

Hosting, storage, analytics and the scanner run with EU providers in the EU; any exception is
named publicly with its reason. No personal data is collected beyond what privacy-preserving
analytics needs, no cookie requires consent, and no third-party script runs other than that
analytics.

## Honesty Tests

Any new product, page or series MUST pass all three before it is specified:

1. **Not summarisable.** A language model cannot produce it by summarising the public web.
2. **Compounding.** Each addition makes the existing site more useful, not just longer.
3. **Maintainable by one person.** It can be kept correct by one maintainer with agent support.

## Development Workflow

- Work follows Spec Kit: constitution → feature spec → plan → tasks → implement, one spec per
  feature under `specs/NNN-name/`. A spec that violates a principle is changed, or the
  constitution is amended first.
- A specification revision is added as data before any page cites it.
- Releases are continuous: every merge to `main` deploys.

## Governance

This constitution supersedes every other practice document in the repository. Amendments are
made by pull request that updates this file, bumps the version below, and carries a Sync Impact
Report in the PR description. MAJOR for a changed or removed principle, MINOR for a new
principle or section, PATCH for wording. Every plan's Constitution Check lists each principle and
states how the feature complies or justifies the deviation in its Complexity Tracking table.

**Version**: 2.0.0 | **Ratified**: 2026-10-13 | **Last Amended**: 2026-11-04
