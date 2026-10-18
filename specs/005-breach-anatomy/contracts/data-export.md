# Contract: `/breaches/data.json`

```jsonc
{
  "version": 1,
  "generatedAt": "2026-10-17T22:00:00.000Z",
  "license": "CC BY 4.0",
  "source": "https://letsauth.eu/breaches/",
  "vulnerabilities": [
    {
      "id": "cve-2025-4144",
      "title": "PKCE verification skipped at the token endpoint",
      "class": "pkce-bypass",
      "summary": "…",
      "disclosed": "2025-05-01",
      "fixed": "@cloudflare/workers-oauth-provider 0.0.5",
      "affects": ["…"],
      "features": ["mcp.as.pkce-s256", "mcp.client.pkce"],
      "scenario": "mcp-authorization",
      "sources": ["https://…"],
      "replay": "/explorer/mcp-authorization/pkce-skipped/"   // or null
    }
  ]
}
```

Entries are in index order (newest `disclosed` first, then id). `replay` is derived and is the
only field not in the YAML. `version` bumps on a breaking change of this shape.
