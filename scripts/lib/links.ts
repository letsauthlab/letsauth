import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

/** Validate generated local href targets without a server or any network access. */
export function brokenLinks(directory: string): string[] {
  const root = resolve(directory);
  const broken: string[] = [];
  function visit(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = join(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && entry.name.endsWith(".html")) {
        const route = `/${relative(root, file).split(sep).join("/")}`;
        const base = new URL(route, "https://www.letsauth.eu");
        // Astro emits quoted hrefs; fragments are not file targets and are intentionally ignored.
        for (const match of readFileSync(file, "utf8").matchAll(
          /\bhref\s*=\s*["']([^"']*)["']/gi,
        )) {
          const href = (match[1] ?? "").replaceAll("&amp;", "&");
          if (!href || href.startsWith("#")) continue;
          let target: URL;
          try {
            target = new URL(href, base);
          } catch {
            broken.push(`${route}: invalid href ${href}`);
            continue;
          }
          if (target.origin !== base.origin) continue;
          let path: string;
          try {
            path = resolve(root, `.${decodeURIComponent(target.pathname)}`);
          } catch {
            broken.push(`${route}: invalid path ${href}`);
            continue;
          }
          if (!path.startsWith(`${root}${sep}`) && path !== root) {
            broken.push(`${route}: path outside build ${href}`);
            continue;
          }
          if (existsSync(path) && statSync(path).isDirectory()) path = join(path, "index.html");
          if (!existsSync(path) || !statSync(path).isFile()) broken.push(`${route}: ${href}`);
        }
      }
    }
  }
  visit(root);
  return broken;
}
