# Implementation plan

Validate resource identity, compare issuers exactly, and avoid unsupported inference about scopes.

Implement within the existing architecture, with regression coverage for the reviewed failure cases.
Stack this package on scanner transport safety (012), retaining its 0.3.1 release before 0.4.0. Run data validation, append-only checks, lint, typecheck, unit tests and the production build. Browser checks apply only where rendering changes.

## Constitution check

- I — Uses the existing dataset and shared schema; no alternate data source.
- II — Metadata behavior cites RFC 9728 and RFC 8414 where applicable; rendered citations remain revision-bound.
- III — Scanner activity remains unauthenticated and passive; unavailable evidence remains unknown.
- IV — Site rendering stays static; observations remain append-only and flow through reviewed PRs.
- V — No new styles, scripts in the browser, or visual changes; existing budgets apply.
- VI — Spec, plan, tasks and regression tests accompany the implementation.
- VII — Existing Bunny/Scaleway EU infrastructure remains in place; no new service or collection.

No constitutional deviations.
