# 015-navigation-integrity

Remediates main-branch review findings 11 at f9bccfd.

## Required behavior

Repair historical revision links and check every generated internal link.

Existing observations remain append-only. Failure paths must preserve evidence and fail safely.

## Acceptance criteria

1. Point historical revision links at /mcp/revisions/<id>/ and the scanner listing link at /mcp/.
2. Check local href file targets in generated HTML, including relative and absolute same-origin links.
3. Run the checker after pnpm build and pnpm check; perform no network requests.
4. Keep fragment validation and visual changes outside this package.

The generated-link check also found the 404 canonical URL pointing at `/404/`; use the actual
`/404.html` output path. This changes metadata only, not rendering.
