# 016 — Official Bunny Sites deployment

Replace the static site's shell upload/purge with the vendor's deploy-site action after #38.
Keep production trust, tested-SHA checkout, serialization and stale-run protection unchanged.
No custom storage reconciliation code, live infrastructure changes or scanner hosting migration.

## Acceptance criteria

- Pin the action by SHA and the CLI to an exact version supporting .well-known and zone import.
- Use the existing production environment and account key with an explicit BUNNY_SITE variable.
- Do not grant deployment-record write access or record the wrong workflow_run SHA.
- Document import prerequisites, changed caching, smoke checks, withdrawals and first-cutover recovery.
- Require operator setup before merge; no automatic provisioning or pruning.
