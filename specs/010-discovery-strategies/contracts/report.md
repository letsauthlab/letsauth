# Contract: Report (additions)

Additive to `specs/004-scanner/contracts/report.md` and 008's additions; `version` stays 1.

```jsonc
{
  "requests": [
    { "url": "https://mcp.example.com/mcp", "status": 405, "ok": false },                   // the GET
    { "url": "https://mcp.example.com/mcp", "method": "POST", "status": 401, "ok": false }  // the empty POST
  ],
  "discovered": {
    "challenge": {
      "url": "https://mcp.example.com/mcp",
      "status": 401,
      "method": "POST",                    // "GET" | "POST": the request that got the answer
      "step": "post-empty",                // the ladder step (discovery.ts)
      "header": "Bearer realm=\"mcp\", resource_metadata=\"…\", scope=\"read\"",
      "resourceMetadata": "https://mcp.example.com/oauth/prm.json",
      "scope": ["read"]                    // or null
    },
    "endpointNote": null                   // or a sentence when the listed URL looks stale
  },
  "checks": [
    { "feature": "mcp.prm.no-offline-access", "status": "supported", "via": "as.scopes", "…": "…" }
  ]
}
```

A recorded report (`recorded: true`) has no `via`, empty `requests` and `discovered: null`.

> Superseded by 013-scanner-conformance: the `as.scopes` positive fallback is removed.
> When only the AS advertises scopes, the resource check is `unknown` via `prm.silent`.
