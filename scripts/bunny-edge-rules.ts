// Prints the Bunny pull zone edge rules this repository owns and, with --apply, syncs them through
// the Bunny API (scripts/lib/bunny-edge-rules.ts, docs/deploy.md).
//
//   pnpm edge-rules [--apply]
//
// --apply needs BUNNY_API_KEY and BUNNY_PULL_ZONE_ID; the deploy workflow runs it after upload.
import { edgeRules, syncEdgeRules } from "./lib/bunny-edge-rules";

const rules = edgeRules();
if (!process.argv.includes("--apply")) {
  console.log(JSON.stringify(rules, null, 2));
} else {
  const key = process.env.BUNNY_API_KEY;
  const zone = process.env.BUNNY_PULL_ZONE_ID;
  if (!key || !zone)
    throw new Error("BUNNY_API_KEY and BUNNY_PULL_ZONE_ID are required with --apply");
  const api = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`https://api.bunny.net${path}`, {
      method,
      headers: { AccessKey: key, "Content-Type": "application/json", Accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
    return res.status === 204 ? null : res.json().catch(() => null);
  };
  for (const line of await syncEdgeRules(api, zone, rules)) console.log(line);
}
