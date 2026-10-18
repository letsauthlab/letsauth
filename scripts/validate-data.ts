import { resolve } from "node:path";
import { crossCheck, loadDataset } from "../src/lib/data";

const root = resolve(process.argv[2] ?? "data");
const { data, issues } = loadDataset(root);
const all = [...issues, ...crossCheck(data)];

if (all.length > 0) {
  console.error(`data validation failed with ${all.length} problem(s):`);
  for (const issue of all) console.error(`  ${issue.path}: ${issue.message}`);
  process.exit(1);
}

console.log(
  `data ok: ${data.specs.length} spec(s), ${data.relations.length} relation(s), ${data.features.length} feature(s), ${data.servers.length} server(s), ${data.observations.length} observation(s), ${data.scenarios.length} scenario(s), ${data.vulnerabilities.length} vulnerability(ies)`,
);
