# Contract: Report

One shape for the command's output and the per-server JSON on
the site. Produced by `scan()` in `src/scanner/` and, for recorded reports, by `latestScan()` in
`src/lib/scanner.ts` (which fills `checks[]` and `summary` from observations and leaves
`requests` and `discovered` empty, since the site never contacts a server).

```jsonc
{
  "version": 2,                           // 2 since spec 017: `summary` replaced `grade`
  "scanner": "letsauth-scanner/0.1.0",
  "generatedAt": "2026-10-15T03:17:04Z",
  "recorded": false,                       // true when built from the repository's observations
  "target": {
    "url": "https://mcp.example.com/mcp",  // the URL scanned
    "server": "example"                    // listed server id, or null
  },
  "revision": { "spec": "mcp-authorization", "revision": "2026-07-28" },
  "method": "passive-scan",
  "requests": [                            // every request the scanner made, in order
    { "url": "https://mcp.example.com/.well-known/oauth-protected-resource/mcp",
      "status": 200, "ok": true, "contentType": "application/json" },
    { "url": "https://auth.example.com/.well-known/oauth-authorization-server",
      "status": null, "ok": false, "error": "timeout" }
  ],
  "discovered": {
    "protectedResource": {                 // or null
      "url": "https://mcp.example.com/.well-known/oauth-protected-resource/mcp",
      "location": "path-aware",            // "path-aware" | "root" | "challenge" (008)
      // "challenge": { url, status, method, step, header, resourceMetadata, scope } (008, 010)
      // "endpointNote": null | "the listed URL answered HTTP 410 and 410 …" (010)
      "resource": "https://mcp.example.com/mcp",
      "authorizationServers": ["https://auth.example.com"],
      "scopesSupported": ["read", "write"]
    },
    "authorizationServer": {               // or null
      "issuer": "https://auth.example.com",
      "url": "https://auth.example.com/.well-known/oauth-authorization-server",
      "endpoints": { "authorization_endpoint": "https://…", "token_endpoint": "https://…" },
      "codeChallengeMethodsSupported": ["S256"],
      "clientIdMetadataDocumentSupported": true,
      "registrationEndpoint": null,
      "authorizationResponseIssParameterSupported": true
    },
    "challenge": {                         // the endpoint's answer (008), or null when it gave none
      "url": "https://mcp.example.com/mcp", "status": 401,
      "header": "Bearer realm=\"mcp\", resource_metadata=\"https://…\"",
      "resourceMetadata": "https://…"      // or null
    },
    "othersNotChecked": ["https://auth2.example.com"]   // further issuers in the PRM
  },
  "checks": [                              // one per passive feature, server party first
    { "feature": "mcp.prm.well-known", "name": "PRM reachable at a well-known URI",
      "party": "mcp-server", "level": "MUST", "levelNote": "One of two discovery mechanisms…",
      "section": "Authorization Server Discovery › Protected Resource Metadata Discovery Requirements",
      "citation": "https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization",
      "status": "supported",
      "evidence": "https://mcp.example.com/.well-known/oauth-protected-resource/mcp — HTTP 200; found at the path-aware location",
      "observedAt": "2026-10-15T03:17:04Z" }
  ],
  "summary": {                             // spec 017: counts only, no grade or score
    "state": "scanned",                    // or "not-scanned" / "no-oauth"
    "label": "MUST 8 supported · SHOULD 3 supported, 1 unsupported",
    "tallies": [                           // one per level present, MUST first
      { "level": "MUST", "total": 8, "counts": [{ "status": "supported", "n": 8 }] }
    ],
    "open": [                              // checks not supported, in report order
      { "feature": "mcp.as.cimd", "name": "Client ID Metadata Documents supported",
        "level": "SHOULD", "status": "unsupported" }
    ],
    "notes": []                            // the either-or rule in words, or why there are no counts
  },
  "observations": [                        // the same checks as data-model observations;
    { "server": "example", "feature": "mcp.prm.well-known", "revision": { … },
      "status": "supported", "method": "passive-scan", "observedAt": "…",
      "observedBy": "scanner@0.1.0", "evidence": "…" }
  ]                                        // empty when `target.server` is null
}
```

- `checks[]` is ordered by `CATEGORY_ORDER` then feature id, MCP server party before
  authorization server party, the same order as the report page.
- `observations[]` validates against `observationSchema`; `evidence` is deterministic
  (`data-model.md`).
- For a recorded report `observedAt` on a check is the date of the newest scanner observation
  for that cell; a check without one has `status: "unknown"` and no `observedAt`.
- `version` bumps on a breaking change of the shape. Adding fields is not breaking.
