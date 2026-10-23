import { readFileSync } from "node:fs";
import type { Feature, Scenario, Toggle, Vulnerability } from "../schema";
import type { Dataset } from "./data";
import { type FeatureSupport, featureSupport } from "./explorer";

/** Bumps on a breaking change of the export shape (contracts/data-export.md). */
export const BREACHES_EXPORT_VERSION = 1;

export interface Replay {
  scenario: Scenario;
  toggle: Toggle;
}

/** The toggle that replays a vulnerability, or undefined when it has no scenario yet. */
export function replayOf(data: Dataset, vulnerability: Vulnerability): Replay | undefined {
  if (!vulnerability.scenario) return undefined;
  const scenario = data.scenarios.find((s) => s.id === vulnerability.scenario);
  const toggle = scenario?.toggles.find((t) => t.vulnerability === vulnerability.id);
  return scenario && toggle ? { scenario, toggle } : undefined;
}

export interface Breach {
  vulnerability: Vulnerability;
  features: Feature[];
  replay?: Replay;
}

/** Vulnerabilities newest first by disclosure date, then by id, with what the index shows. */
export function breachList(data: Dataset): Breach[] {
  const byId = new Map(data.features.map((f) => [f.id, f]));
  return [...data.vulnerabilities]
    .sort((a, b) => b.disclosed.localeCompare(a.disclosed) || a.id.localeCompare(b.id))
    .map((vulnerability) => ({
      vulnerability,
      features: vulnerability.features.flatMap((id) => {
        const f = byId.get(id);
        return f ? [f] : [];
      }),
      replay: replayOf(data, vulnerability),
    }));
}

/** What the atlas knows today about each requirement the breach turned on. */
export function missingControls(data: Dataset, vulnerability: Vulnerability): FeatureSupport[] {
  return vulnerability.features.map((id) => featureSupport(data, id));
}

function licenseLine(): string {
  try {
    const text = readFileSync(new URL("../../LICENSE-DATA", import.meta.url), "utf8");
    const match = text.match(/Creative Commons [^\n]*?\(([^)]+)\)/);
    return match?.[1] ?? "CC BY 4.0";
  } catch {
    return "CC BY 4.0";
  }
}

export function buildBreachesExport(data: Dataset, generatedAt = new Date().toISOString()) {
  return {
    version: BREACHES_EXPORT_VERSION,
    generatedAt,
    license: licenseLine(),
    source: "https://www.letsauth.eu/breaches/",
    vulnerabilities: breachList(data).map(({ vulnerability, replay }) => ({
      ...vulnerability,
      replay: replay ? `/explorer/${replay.scenario.id}/${replay.toggle.id}/` : null,
    })),
  };
}
