# Implementation plan

1. Keep existing measurement recipes and evidence/observation contracts. Remove the domain
   challenge and its flags/model/network round trip from the local CLI.
2. Amend constitution principle III to distinguish passive scheduled scanning from local,
   human-operated investigations of third-party providers. Reflect this in contributor docs.
3. Use the official MCP client SDK for OAuth discovery, client registration, S256 PKCE and
   code exchange. Implement only in-memory provider state, browser opening and loopback callback.
4. Reuse the guarded HTTPS transport through an SDK fetch adapter: pin DNS, bound bodies/time,
   refuse redirects and sanitize provider error bodies before SDK diagnostics can log them.
5. Add `check <server-id|url>` for a configuration-free interactive baseline/invalid-token run,
   and `run --login` for configurations. Reserve output and validate input before login.
6. Test with the real SDK against mocked provider responses; cover callbacks, failed consent,
   PKCE/state/issuer/resource, client registration paths, redaction, and measurement isolation.

## Constitution check

| Principle | Compliance |
|---|---|
| I | Reuses dataset entities; local evidence/configuration artifacts are not new public entities. |
| II | Claims resolve existing feature/revision citations; ambiguous results remain inconclusive. |
| III | Amended to allow local operator-authorized third-party testing without domain proof. Scheduled scans remain passive. |
| IV | No service or scheduler; reviewed observations enter repository YAML only explicitly. |
| V | No website/UI changes. |
| VI | Strict TS/Zod, official SDK, help, deterministic tests and useful exit codes. |
| VII | Local credentials/evidence with no telemetry or remote credential storage. |

Honesty tests: measurements cannot be replaced by summaries; evidence improves existing atlas
cells; the fixed recipe set and standard OAuth SDK remain maintainable by one maintainer.

## Protocol references

- MCP authorization and Streamable HTTP, revision 2025-11-25:
  https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
  https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
- Official SDK OAuth integration: https://ts.sdk.modelcontextprotocol.io/v2/clients/oauth
- DCR: RFC 7591; revocation interpretation: RFC 7009.
