// @ts-check

import sitemap from "@astrojs/sitemap";
import svelte from "@astrojs/svelte";
import { defineConfig } from "astro/config";
import pagefind from "astro-pagefind";

export default defineConfig({
  site: "https://letsauth.eu",
  trailingSlash: "always",
  // Bunny Storage serves <folder>/index.html for "/folder/" but has nothing to match "/folder"
  // or an extensionless page, so pages are folders and every internal link ends in a slash.
  build: { format: "directory" },
  // Old addresses from before the page tree was flattened (docs/architecture.md, "Pages"). Each
  // becomes a small page that forwards to the new address; the JSON exports moved too but a
  // forwarding page is HTML, so those need the edge rules listed in docs/deploy.md.
  redirects: {
    "/atlas/mcp": "/mcp",
    "/atlas/mcp/contribute": "/contribute",
    "/atlas/mcp/servers/[id]": "/mcp/servers/[id]",
    "/atlas/mcp/features/[id]": "/mcp/features/[id]",
    "/atlas/mcp/changes/[from]/[to]": "/mcp/changes/[from]/[to]",
    "/atlas/mcp/[revision]": "/mcp/revisions/[revision]",
    "/atlas/standards": "/standards",
    "/atlas/standards/[id]": "/standards/[id]",
    "/scanner": "/mcp/scanner",
    "/scanner/[id]": "/mcp/servers/[id]",
    // the scan report was folded into the server page
    "/mcp/servers/[id]/scan": "/mcp/servers/[id]",
  },
  integrations: [svelte(), sitemap(), pagefind()],
});
