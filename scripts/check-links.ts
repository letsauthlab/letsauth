import { brokenLinks } from "./lib/links";

const broken = brokenLinks(process.argv[2] ?? "dist");
if (broken.length) {
  console.error(`Broken local links (${broken.length}):\n${broken.join("\n")}`);
  process.exitCode = 1;
} else console.log("Generated local links OK");
