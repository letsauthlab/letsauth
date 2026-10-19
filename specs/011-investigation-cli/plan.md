# Implementation plan

1. Add typed recipe/configuration/report contracts and offline planning using existing dataset
   references. Keep run artifacts outside `data/` in ignored `.investigations/`.
2. Add a dedicated active transport under `src/scanner/investigation/`: HTTPS, DNS checked and
   pinned in socket lookup, no redirects, total deadline, response byte cap, JSON/SSE decoding.
   Verify a random, exact endpoint challenge at a fixed well-known path before every run.
3. Implement baseline/negative comparisons and single DCR attempts. Fresh MCP initialization
   per token, negotiated protocol/session headers, operation-level success required. Revocation
   reuses a matching successful baseline report and verifies the same token by digest.
4. Add CLI commands `init`, `list`, `plan`, `challenge`, `run`, `record`; reuse observation validation
   and append machinery. New file writes are exclusive and private by default.
5. Test failure semantics, credential confinement, ownership refusal, request limits, comparison
   prerequisites, revocation pairing, citations and append-only recording. Run existing checks.
6. Document setup, configurations, manual procedures, limits and review workflow; open one PR.

## Constitution check

| Principle | Compliance |
|---|---|
| I | No public entity/schema changes; plans reference existing entities. Evidence reports are local execution artifacts, like scanner reports. |
| II | Feature citations resolved from chosen dataset revision. Revocation has an RFC 7009 reference and no invented feature mapping. |
| III | Active requires endpoint-specific owner proof; offline commands are the default entry. Ambiguity is inconclusive, never a failure verdict. |
| IV | No service, site endpoint or scheduler; only reviewed manual observations enter YAML. |
| V | No UI or shipped browser code changes. |
| VI | Strict TS/Zod, help, JSON output, fixture-based tests. |
| VII | Local evidence, no external telemetry/storage. |

Honesty tests: measurements cannot be replaced by a web summary; evidence improves existing
atlas cells; a small fixed recipe set reuses the shared model and remains maintainable.

The contributor network entry-point documentation is expanded to include this explicitly
owner-controlled CLI. This implements the constitution's existing active-probe allowance;
it does not weaken or amend that principle. The passive scanner is not extended with credentials.

## Protocol references

- MCP Streamable HTTP and lifecycle, revision 2025-11-25:
  https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
- OAuth DCR: https://www.rfc-editor.org/rfc/rfc7591 (sections 2, 3.1, 3.2)
- Revocation: https://www.rfc-editor.org/rfc/rfc7009 (section 2; propagation and token-type limits)
- Authorization claims use the selected revision and section in `data/features/`.
