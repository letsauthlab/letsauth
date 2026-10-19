import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { publish } from "./lib/storage";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
const host = required("BUNNY_STORAGE_HOST")
  .replace(/^https?:\/\//, "")
  .split("/")[0];
if (!host || !/^[a-z0-9.-]+$/i.test(host)) throw new Error("Invalid storage hostname");
const zone = required("BUNNY_STORAGE_ZONE");
if (!/^[a-z0-9-]+$/i.test(zone)) throw new Error("Invalid storage zone");
const files = new Map<string, Uint8Array>();
function collect(dir: string, prefix = ""): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (entry.isDirectory()) collect(join(dir, entry.name), `${path}/`);
    else if (entry.isFile()) files.set(path, readFileSync(join(dir, entry.name)));
    else throw new Error(`Unsupported deployment entry: ${path}`);
  }
}
collect("dist");
if (!files.has("index.html")) throw new Error("Missing built homepage; refusing deployment");
const result = await publish({
  files,
  base: `https://${host}/${zone}`,
  key: required("BUNNY_STORAGE_KEY"),
});
console.log(`Published ${result.uploaded} files; removed ${result.deleted} obsolete files.`);
