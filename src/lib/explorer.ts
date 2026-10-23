import { readFileSync } from "node:fs";
import type { Feature, Scenario, Step, Toggle, TokenValue, TokenView } from "../schema";
import {
  ATLAS_SPEC,
  currentRevision,
  type FeatureShare,
  featureInRevision,
  featureShare,
} from "./atlas";
import type { Dataset } from "./data";

/** Bumps on a breaking change of the export shape (contracts/data-export.md). */
export const EXPLORER_EXPORT_VERSION = 1;

export interface ClaimDiff {
  added: string[];
  changed: string[];
  removed: string[];
}

export interface ResolvedToken extends TokenView {
  diff: ClaimDiff;
  headerDiff: ClaimDiff;
}

export interface ResolvedStep extends Omit<Step, "token"> {
  /** 1-based position in the rendered chain, removed steps included. */
  index: number;
  /** True when the toggle introduced this step. */
  toggled: boolean;
  /** The baseline step this one replaces; set on the first replacement only. */
  replaces?: string;
  /** True for a baseline step the toggle maps to an empty list; kept in place, skipped by the diff. */
  removed: boolean;
  token?: ResolvedToken;
}

export interface Chain {
  scenario: Scenario;
  toggle?: Toggle;
  steps: ResolvedStep[];
}

const same = (a: TokenValue | undefined, b: TokenValue | undefined) =>
  JSON.stringify(a) === JSON.stringify(b);

/** Added, changed and removed names between two claim maps; no previous map marks nothing. */
export function diffClaims(
  previous: Record<string, TokenValue> | undefined,
  next: Record<string, TokenValue>,
): ClaimDiff {
  const diff: ClaimDiff = { added: [], changed: [], removed: [] };
  if (!previous) return diff;
  for (const name of Object.keys(next)) {
    if (!(name in previous)) diff.added.push(name);
    else if (!same(previous[name], next[name])) diff.changed.push(name);
  }
  for (const name of Object.keys(previous)) if (!(name in next)) diff.removed.push(name);
  return diff;
}

/** The chain of a scenario with at most one toggle applied (research R1, R2, R4). */
export function resolveChain(scenario: Scenario, toggleId?: string): Chain {
  const toggle = toggleId ? scenario.toggles.find((t) => t.id === toggleId) : undefined;
  if (toggleId && !toggle) {
    throw new Error(`scenario "${scenario.id}" has no toggle "${toggleId}"`);
  }
  const ordered: Omit<ResolvedStep, "index" | "token">[] = [];
  const tokens: (TokenView | undefined)[] = [];
  for (const step of scenario.steps) {
    const replacements = toggle?.replaces[step.id];
    if (!replacements) {
      ordered.push({ ...step, toggled: false, removed: false });
      tokens.push(step.token);
    } else if (replacements.length === 0) {
      ordered.push({ ...step, toggled: true, removed: true });
      tokens.push(step.token);
    } else {
      replacements.forEach((r, i) => {
        ordered.push({
          ...r,
          toggled: true,
          removed: false,
          replaces: i === 0 ? step.id : undefined,
        });
        tokens.push(r.token);
      });
    }
  }
  let previous: TokenView | undefined;
  const steps = ordered.map((step, i) => {
    const token = tokens[i];
    const resolved: ResolvedStep = { ...step, index: i + 1 };
    if (token && !step.removed) {
      resolved.token = {
        ...token,
        diff: diffClaims(previous?.claims, token.claims),
        headerDiff: diffClaims(previous?.header, token.header ?? {}),
      };
      previous = token;
    } else if (token) {
      resolved.token = {
        ...token,
        diff: { added: [], changed: [], removed: [] },
        headerDiff: { added: [], changed: [], removed: [] },
      };
    }
    return resolved;
  });
  return { scenario, toggle, steps };
}

export interface ScenarioSummary {
  scenario: Scenario;
  stepCount: number;
  toggles: Toggle[];
  features: Feature[];
}

/** Scenarios ordered by id with what the index card shows. */
export function scenarioList(data: Dataset): ScenarioSummary[] {
  const byId = new Map(data.features.map((f) => [f.id, f]));
  return [...data.scenarios]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((scenario) => ({
      scenario,
      stepCount: scenario.steps.length,
      toggles: scenario.toggles,
      features: scenario.features.flatMap((id) => {
        const f = byId.get(id);
        return f ? [f] : [];
      }),
    }));
}

export type FeatureSupport =
  | { feature: Feature; observed: true; revisionId: string; counts: FeatureShare }
  | { feature: Feature; observed: false; reason: string };

/** What the atlas knows about a requirement a toggle defeats (research R5). */
export function featureSupport(data: Dataset, featureId: string): FeatureSupport {
  const feature = data.features.find((f) => f.id === featureId);
  if (!feature) throw new Error(`feature "${featureId}" not found`);
  if (feature.party === "client") {
    return {
      feature,
      observed: false,
      reason: "a client requirement; the atlas does not observe clients",
    };
  }
  const revision = currentRevision(data);
  if (!featureInRevision(feature, revision.id, ATLAS_SPEC)) {
    return {
      feature,
      observed: false,
      reason: `not defined by MCP Authorization ${revision.id}, the revision the atlas observes`,
    };
  }
  return {
    feature,
    observed: true,
    revisionId: revision.id,
    counts: featureShare(data, featureId, revision.id),
  };
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

export function buildExplorerExport(data: Dataset, generatedAt = new Date().toISOString()) {
  return {
    version: EXPLORER_EXPORT_VERSION,
    generatedAt,
    license: licenseLine(),
    source: "https://www.letsauth.eu/explorer/",
    scenarios: scenarioList(data).map((s) => s.scenario),
  };
}
