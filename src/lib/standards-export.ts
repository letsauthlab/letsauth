import { readFileSync } from "node:fs";
import type { Dataset } from "./data";
import { specNodes, withdrawnSpecs } from "./standards";

/** Bumps on a breaking change of the export shape (specs/002-agent-auth-atlas/contracts/data-export.md). */
export const STANDARDS_EXPORT_VERSION = 1;

function licenseLine(): string {
  try {
    const text = readFileSync(new URL("../../LICENSE-DATA", import.meta.url), "utf8");
    const match = text.match(/Creative Commons [^\n]*?\(([^)]+)\)/);
    return match?.[1] ?? "CC BY 4.0";
  } catch {
    return "CC BY 4.0";
  }
}

export function buildStandardsExport(data: Dataset, generatedAt = new Date().toISOString()) {
  return {
    version: STANDARDS_EXPORT_VERSION,
    generatedAt,
    license: licenseLine(),
    source: "https://letsauth.eu/standards/",
    specs: specNodes(data),
    relations: data.relations,
    withdrawn: withdrawnSpecs(data).map((s) => s.id),
  };
}
