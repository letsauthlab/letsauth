import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { parse } from "yaml";
import { type ZodType, z } from "zod";
import {
  type Feature,
  featureSchema,
  isDependency,
  isSymmetric,
  type Observation,
  observationSchema,
  type Relation,
  relationSchema,
  type Scenario,
  type Server,
  type Spec,
  type Step,
  scenarioSchema,
  serverSchema,
  specSchema,
  type Vulnerability,
  vulnerabilitySchema,
} from "../schema";

export interface Dataset {
  specs: Spec[];
  features: Feature[];
  servers: Server[];
  observations: Observation[];
  /** Edges between specs, from `data/relations.yaml`. */
  relations: Relation[];
  /** Explorer scenarios, from `data/scenarios/`. */
  scenarios: Scenario[];
  /** Vulnerabilities, from `data/vulnerabilities/` (rendered by Breach Anatomy, 005). */
  vulnerabilities: Vulnerability[];
  /** Where each loaded observation came from (`data/observations/<id>.yaml[i]`), for messages. */
  locations?: WeakMap<Observation, string>;
}

export interface DataIssue {
  /** `data/observations/stripe.yaml[3].evidence` style location. */
  path: string;
  message: string;
}

export const DATA_ROOT = resolve(process.cwd(), "data");

function listYaml(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
      .sort()
      .map((f) => join(dir, f));
  } catch {
    return [];
  }
}

function relPath(file: string, root: string): string {
  return `data/${file.slice(root.length + 1)}`;
}

function formatPath(file: string, root: string, issuePath: PropertyKey[]): string {
  let out = relPath(file, root);
  for (const seg of issuePath) {
    out += typeof seg === "number" ? `[${seg}]` : `.${String(seg)}`;
  }
  return out;
}

function loadFile<T>(
  file: string,
  root: string,
  schema: ZodType<T>,
  issues: DataIssue[],
): T | undefined {
  let raw: unknown;
  try {
    raw = parse(readFileSync(file, "utf8"));
  } catch (err) {
    issues.push({ path: relPath(file, root), message: `invalid YAML: ${(err as Error).message}` });
    return undefined;
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    for (const issue of result.error.issues) {
      issues.push({ path: formatPath(file, root, issue.path), message: issue.message });
    }
    return undefined;
  }
  return result.data;
}

/**
 * Loads and validates everything under `data/`. Schema errors are collected, not thrown, so a
 * validator can print all of them at once. Cross-reference checks are in `crossCheck`.
 */
export function loadDataset(root = DATA_ROOT): { data: Dataset; issues: DataIssue[] } {
  const issues: DataIssue[] = [];
  const locations = new WeakMap<Observation, string>();
  const specs: Spec[] = [];
  const features: Feature[] = [];
  const servers: Server[] = [];
  const observations: Observation[] = [];
  const relations: Relation[] = [];
  const scenarios: Scenario[] = [];
  const vulnerabilities: Vulnerability[] = [];

  for (const f of listYaml(join(root, "specs"))) {
    const spec = loadFile(f, root, specSchema, issues);
    if (spec) specs.push(spec);
  }
  for (const f of listYaml(join(root, "features"))) {
    const feature = loadFile(f, root, featureSchema, issues);
    if (feature) features.push(feature);
  }
  for (const f of listYaml(join(root, "servers"))) {
    const server = loadFile(f, root, serverSchema, issues);
    if (server) servers.push(server);
  }
  for (const f of listYaml(join(root, "observations"))) {
    // entries are validated one by one so a bad entry does not hide the others from crossCheck
    const list = loadFile(f, root, z.array(z.unknown()), issues);
    if (!list) continue;
    const fileServer = basename(f).replace(/\.ya?ml$/, "");
    for (const [i, raw] of list.entries()) {
      const parsed = observationSchema.safeParse(raw);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          issues.push({ path: formatPath(f, root, [i, ...issue.path]), message: issue.message });
        }
        continue;
      }
      const obs = parsed.data;
      if (obs.server !== fileServer) {
        issues.push({
          path: formatPath(f, root, [i, "server"]),
          message: `must equal the file's server id "${fileServer}", got "${obs.server}"`,
        });
        continue;
      }
      locations.set(obs, formatPath(f, root, [i]));
      observations.push(obs);
    }
  }
  for (const f of listYaml(join(root, "scenarios"))) {
    const scenario = loadFile(f, root, scenarioSchema, issues);
    if (!scenario) continue;
    const fileId = basename(f).replace(/\.ya?ml$/, "");
    if (scenario.id !== fileId) {
      issues.push({
        path: `${relPath(f, root)}.id`,
        message: `must equal the file name "${fileId}", got "${scenario.id}"`,
      });
      continue;
    }
    scenarios.push(scenario);
  }
  for (const f of listYaml(join(root, "vulnerabilities"))) {
    const vulnerability = loadFile(f, root, vulnerabilitySchema, issues);
    if (vulnerability) vulnerabilities.push(vulnerability);
  }
  const relationsFile = join(root, "relations.yaml");
  if (existsSync(relationsFile)) {
    // entries are validated one by one so a bad entry does not hide the others from crossCheck
    const list = loadFile(relationsFile, root, z.array(z.unknown()), issues);
    for (const [i, raw] of (list ?? []).entries()) {
      const parsed = relationSchema.safeParse(raw);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          issues.push({
            path: formatPath(relationsFile, root, [i, ...issue.path]),
            message: issue.message,
          });
        }
        continue;
      }
      relations.push(parsed.data);
    }
  }
  return {
    data: {
      specs,
      features,
      servers,
      observations,
      relations,
      scenarios,
      vulnerabilities,
      locations,
    },
    issues,
  };
}

/** Relation rules the data model states (rule 7) that a per-entry schema cannot express. */
export function crossCheckRelations(data: Dataset): DataIssue[] {
  const issues: DataIssue[] = [];
  const specIds = new Set(data.specs.map((s) => s.id));
  const seen = new Map<string, number>();
  const at = (i: number, field?: string) => `data/relations.yaml[${i}]${field ? `.${field}` : ""}`;

  data.relations.forEach((rel, i) => {
    for (const end of ["from", "to"] as const) {
      if (!specIds.has(rel[end])) {
        issues.push({ path: at(i, end), message: `spec "${rel[end]}" does not exist` });
      }
    }
    const keys = [`${rel.from}>${rel.to}>${rel.type}`];
    if (isSymmetric(rel.type)) keys.push(`${rel.to}>${rel.from}>${rel.type}`);
    const earlier = keys.map((k) => seen.get(k)).find((v) => v !== undefined);
    if (earlier !== undefined) {
      issues.push({
        path: at(i),
        message: `duplicates entry [${earlier}] (${rel.from} ${rel.type} ${rel.to}${
          isSymmetric(rel.type) ? ", a symmetric type stored once per pair" : ""
        })`,
      });
    } else {
      for (const k of keys) seen.set(k, i);
    }
  });

  // dependency edges must form a DAG: the map lays specs out along them
  const out = new Map<string, { to: string; index: number }[]>();
  data.relations.forEach((rel, index) => {
    if (!isDependency(rel.type)) return;
    const list = out.get(rel.from) ?? [];
    list.push({ to: rel.to, index });
    out.set(rel.from, list);
  });
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];
  const reported = new Set<string>();
  const visit = (id: string) => {
    state.set(id, "visiting");
    stack.push(id);
    for (const edge of out.get(id) ?? []) {
      const s = state.get(edge.to);
      if (s === "visiting") {
        const cycle = [...stack.slice(stack.indexOf(edge.to)), edge.to];
        const key = cycle.join(">");
        if (!reported.has(key)) {
          reported.add(key);
          issues.push({
            path: at(edge.index),
            message: `dependency cycle ${cycle.join(" -> ")} (builds-on, profiles and replaces must not loop)`,
          });
        }
      } else if (s === undefined) {
        visit(edge.to);
      }
    }
    stack.pop();
    state.set(id, "done");
  };
  for (const id of out.keys()) if (!state.has(id)) visit(id);
  return issues;
}

/** Scenario rules (data model, rule 2 and specs/003-delegation-explorer/data-model.md). */
export function crossCheckScenarios(data: Dataset): DataIssue[] {
  const issues: DataIssue[] = [];
  const revisionKeys = new Set<string>();
  for (const spec of data.specs) {
    for (const rev of spec.revisions) revisionKeys.add(`${spec.id}@${rev.id}`);
  }
  const featureIds = new Set(data.features.map((f) => f.id));

  for (const scenario of data.scenarios) {
    const file = `data/scenarios/${scenario.id}.yaml`;
    const actorIds = new Set(scenario.actors.map((a) => a.id));
    const stepIds = new Set(scenario.steps.map((s) => s.id));
    const checkStep = (step: Step, at: string) => {
      for (const end of ["from", "to"] as const) {
        if (!actorIds.has(step[end])) {
          issues.push({ path: `${at}.${end}`, message: `actor "${step[end]}" is not declared` });
        }
      }
      const key = `${step.cites.spec}@${step.cites.revision}`;
      if (!revisionKeys.has(key)) {
        issues.push({ path: `${at}.cites`, message: `revision "${key}" does not exist` });
      }
    };
    scenario.features.forEach((id, i) => {
      if (!featureIds.has(id)) {
        issues.push({ path: `${file}.features[${i}]`, message: `feature "${id}" does not exist` });
      }
    });
    scenario.steps.forEach((step, i) => {
      checkStep(step, `${file}.steps[${i}]`);
    });
    scenario.toggles.forEach((toggle, j) => {
      const at = `${file}.toggles[${j}]`;
      const key = `${toggle.cites.spec}@${toggle.cites.revision}`;
      if (!revisionKeys.has(key)) {
        issues.push({ path: `${at}.cites`, message: `revision "${key}" does not exist` });
      }
      // ids over the chain this toggle produces: a replacement may reuse the replaced id only
      const chainIds = new Set<string>();
      for (const step of scenario.steps) {
        if (!(step.id in toggle.replaces)) chainIds.add(step.id);
      }
      for (const [stepId, replacements] of Object.entries(toggle.replaces)) {
        if (!stepIds.has(stepId)) {
          issues.push({
            path: `${at}.replaces.${stepId}`,
            message: `step "${stepId}" does not exist in this scenario`,
          });
        }
        replacements.forEach((step, k) => {
          const stepAt = `${at}.replaces.${stepId}[${k}]`;
          checkStep(step, stepAt);
          if (chainIds.has(step.id)) {
            issues.push({
              path: `${stepAt}.id`,
              message: `step id "${step.id}" collides with another step in the toggled chain`,
            });
          }
          chainIds.add(step.id);
        });
      }
      toggle.violates?.forEach((id, i) => {
        if (!featureIds.has(id)) {
          issues.push({ path: `${at}.violates[${i}]`, message: `feature "${id}" does not exist` });
        }
      });
      if (toggle.vulnerability) {
        const v = data.vulnerabilities.find((x) => x.id === toggle.vulnerability);
        if (!v) {
          issues.push({
            path: `${at}.vulnerability`,
            message: `vulnerability "${toggle.vulnerability}" does not exist`,
          });
        } else if (v.scenario !== scenario.id) {
          issues.push({
            path: `${at}.vulnerability`,
            message: `vulnerability "${toggle.vulnerability}" names scenario "${v.scenario ?? "none"}" as its replay, not "${scenario.id}"`,
          });
        }
      }
    });
  }
  for (const v of data.vulnerabilities) {
    const file = `data/vulnerabilities/${v.id}.yaml`;
    if (v.scenario) {
      const scenario = data.scenarios.find((s) => s.id === v.scenario);
      if (!scenario) {
        issues.push({
          path: `${file}.scenario`,
          message: `scenario "${v.scenario}" does not exist`,
        });
      } else if (!scenario.toggles.some((t) => t.vulnerability === v.id)) {
        issues.push({
          path: `${file}.scenario`,
          message: `no toggle of scenario "${v.scenario}" names vulnerability "${v.id}" as its replay`,
        });
      }
    }
    v.features.forEach((id, i) => {
      if (!featureIds.has(id)) {
        issues.push({ path: `${file}.features[${i}]`, message: `feature "${id}" does not exist` });
      }
    });
  }
  return issues;
}

/** Cross-reference checks from the data model that a per-file schema cannot express. */
export function crossCheck(data: Dataset): DataIssue[] {
  const issues: DataIssue[] = [];
  const revisionKeys = new Set<string>();
  for (const spec of data.specs) {
    for (const rev of spec.revisions) revisionKeys.add(`${spec.id}@${rev.id}`);
  }
  const featureById = new Map(data.features.map((f) => [f.id, f]));
  const serverIds = new Set(data.servers.map((s) => s.id));

  for (const feature of data.features) {
    for (const [i, rev] of feature.revisions.entries()) {
      if (!revisionKeys.has(`${rev.spec}@${rev.revision}`)) {
        issues.push({
          path: `data/features/${feature.id}.yaml.revisions[${i}]`,
          message: `revision "${rev.revision}" of spec "${rev.spec}" does not exist in data/specs`,
        });
      }
    }
    if (feature.supersedes && !featureById.has(feature.supersedes)) {
      issues.push({
        path: `data/features/${feature.id}.yaml.supersedes`,
        message: `feature "${feature.supersedes}" does not exist`,
      });
    }
  }

  const perFile = new Map<string, number>();
  for (const obs of data.observations) {
    const index = perFile.get(obs.server) ?? 0;
    perFile.set(obs.server, index + 1);
    const at = data.locations?.get(obs) ?? `data/observations/${obs.server}.yaml[${index}]`;
    if (!serverIds.has(obs.server)) {
      issues.push({ path: `${at}.server`, message: `server "${obs.server}" does not exist` });
    }
    const feature = featureById.get(obs.feature);
    if (!feature) {
      issues.push({ path: `${at}.feature`, message: `feature "${obs.feature}" does not exist` });
      continue;
    }
    if (feature.party === "client") {
      issues.push({
        path: `${at}.feature`,
        message: `feature "${obs.feature}" is a client-party feature and cannot be observed on a server`,
      });
    }
    const revKey = `${obs.revision.spec}@${obs.revision.revision}`;
    if (!revisionKeys.has(revKey)) {
      issues.push({ path: `${at}.revision`, message: `revision "${revKey}" does not exist` });
    } else if (
      !feature.revisions.some(
        (r) => r.spec === obs.revision.spec && r.revision === obs.revision.revision,
      )
    ) {
      issues.push({
        path: `${at}.revision`,
        message: `feature "${obs.feature}" is not defined in revision "${revKey}"`,
      });
    }
  }
  issues.push(...crossCheckRelations(data));
  issues.push(...crossCheckScenarios(data));
  return issues;
}

let cached: Dataset | undefined;

/** Validated dataset for build-time use. Throws on any issue so a broken dataset never ships. */
export function getDataset(root = DATA_ROOT): Dataset {
  if (cached) return cached;
  const { data, issues } = loadDataset(root);
  const all = [...issues, ...crossCheck(data)];
  if (all.length > 0) {
    throw new Error(
      `data/ has ${all.length} problem(s):\n${all.map((i) => `  ${i.path}: ${i.message}`).join("\n")}`,
    );
  }
  cached = data;
  return data;
}
