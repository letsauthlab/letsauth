import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { brokenLinks } from "../../scripts/lib/links";

it("checks relative and absolute local links while allowing fragments, assets and external URLs", () => {
  const root = mkdtempSync(join(tmpdir(), "site-links-"));
  try {
    mkdirSync(join(root, "mcp/revisions/2025-11-25"), { recursive: true });
    writeFileSync(
      join(root, "mcp/revisions/2025-11-25/index.html"),
      '<a href="../../../">home</a>',
    );
    writeFileSync(join(root, "favicon.svg"), "<svg/>");
    writeFileSync(
      join(root, "index.html"),
      `
      <a href="/mcp/revisions/2025-11-25/?a=1&amp;b=2#section">revision</a>
      <link href="/favicon.svg"><a href="#here">here</a>
      <a href="https://example.org/missing">external</a><a href="mailto:test@example.org">mail</a>
      <a href="/mcp/2025-11-25/">broken revision</a>
      <a href="https://www.letsauth.eu/mcp/servers/">broken index</a>`,
    );
    expect(brokenLinks(root)).toEqual([
      "/index.html: /mcp/2025-11-25/",
      "/index.html: https://www.letsauth.eu/mcp/servers/",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
