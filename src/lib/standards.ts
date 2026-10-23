import {
  type Feature,
  type FeatureRevision,
  isSymmetric,
  type Relation,
  type RelationType,
  type Revision,
  type Spec,
  type SpecBody,
} from "../schema";
import { CATEGORY_ORDER } from "./atlas";
import type { Dataset } from "./data";

/** Row order on the map and in the list: foundations first, agent protocols, then vendors and law. */
export const BODY_ORDER: SpecBody[] = [
  "ietf-oauth",
  "openid",
  "ietf-wimse",
  "ietf-other",
  "other",
  "mcp",
  "a2a",
  "vendor",
  "eu",
];

export const RELATION_TYPES: RelationType[] = [
  "builds-on",
  "profiles",
  "replaces",
  "references",
  "competes-with",
  "solves-same-problem-as",
];

export function getSpecById(data: Dataset, id: string): Spec {
  const spec = data.specs.find((s) => s.id === id);
  if (!spec) throw new Error(`spec "${id}" not found`);
  return spec;
}

/** The revision shown by default; the schema guarantees exactly one. */
export function currentRevisionOf(spec: Spec): Revision {
  const rev = spec.revisions.find((r) => r.status === "current");
  if (!rev) throw new Error(`spec "${spec.id}" has no current revision`);
  return rev;
}

export function firstRevisionDate(spec: Spec): string {
  return [...spec.revisions].sort((a, b) => a.date.localeCompare(b.date))[0]?.date ?? "";
}

export function specRevisionsNewestFirst(spec: Spec): Revision[] {
  return [...spec.revisions].sort((a, b) => b.date.localeCompare(a.date));
}

/** Adjacent (older, newer) pairs of a spec's revisions, oldest pair first. */
export function adjacentRevisionPairs(spec: Spec): [Revision, Revision][] {
  const asc = [...spec.revisions].sort((a, b) => a.date.localeCompare(b.date));
  const pairs: [Revision, Revision][] = [];
  for (let i = 1; i < asc.length; i += 1) {
    const older = asc[i - 1];
    const newer = asc[i];
    if (older && newer) pairs.push([older, newer]);
  }
  return pairs;
}

export function compareSpecs(a: Spec, b: Spec): number {
  return (
    BODY_ORDER.indexOf(a.body) - BODY_ORDER.indexOf(b.body) ||
    firstRevisionDate(a).localeCompare(firstRevisionDate(b)) ||
    a.name.localeCompare(b.name)
  );
}

/** Specs shown on the map: everything that is not withdrawn, in body order. */
export function specNodes(data: Dataset): Spec[] {
  return data.specs.filter((s) => s.maturity !== "withdrawn").sort(compareSpecs);
}

/** Withdrawn specs keep their files and pages but leave the map (data model rule 6). */
export function withdrawnSpecs(data: Dataset): Spec[] {
  return data.specs.filter((s) => s.maturity === "withdrawn").sort(compareSpecs);
}

/** Relations whose two ends are both on the map. */
export function mapRelations(data: Dataset): Relation[] {
  const ids = new Set(specNodes(data).map((s) => s.id));
  return data.relations.filter((r) => ids.has(r.from) && ids.has(r.to));
}

export function specsByBody(specs: Spec[]): { body: SpecBody; specs: Spec[] }[] {
  const groups = new Map<SpecBody, Spec[]>();
  for (const spec of specs) {
    const list = groups.get(spec.body) ?? [];
    list.push(spec);
    groups.set(spec.body, list);
  }
  return BODY_ORDER.filter((b) => groups.has(b)).map((body) => ({
    body,
    specs: groups.get(body) ?? [],
  }));
}

export interface RelationEntry {
  relation: Relation;
  /** The spec at the other end. */
  other: Spec;
}

export interface RelationGroups {
  /** Directed relations where this spec is `from`, keyed by type. */
  outgoing: Map<RelationType, RelationEntry[]>;
  /** Directed relations where this spec is `to`, keyed by type. */
  incoming: Map<RelationType, RelationEntry[]>;
  /** Symmetric relations, whichever end stored this spec, keyed by type. */
  related: Map<RelationType, RelationEntry[]>;
  total: number;
}

export function relationsOf(data: Dataset, specId: string): RelationGroups {
  const byId = new Map(data.specs.map((s) => [s.id, s]));
  const groups: RelationGroups = {
    outgoing: new Map(),
    incoming: new Map(),
    related: new Map(),
    total: 0,
  };
  const push = (map: Map<RelationType, RelationEntry[]>, relation: Relation, otherId: string) => {
    const other = byId.get(otherId);
    if (!other) return;
    const list = map.get(relation.type) ?? [];
    list.push({ relation, other });
    map.set(relation.type, list);
    groups.total += 1;
  };
  for (const relation of data.relations) {
    if (relation.from !== specId && relation.to !== specId) continue;
    const otherId = relation.from === specId ? relation.to : relation.from;
    if (isSymmetric(relation.type)) push(groups.related, relation, otherId);
    else if (relation.from === specId) push(groups.outgoing, relation, otherId);
    else push(groups.incoming, relation, otherId);
  }
  for (const map of [groups.outgoing, groups.incoming, groups.related]) {
    for (const list of map.values()) list.sort((a, b) => compareSpecs(a.other, b.other));
  }
  return groups;
}

export interface DefinedFeature {
  feature: Feature;
  /** The entry for the spec's current revision. */
  entry: FeatureRevision;
}

/** Features the spec's current revision defines, in matrix column order. */
export function featuresDefinedBy(data: Dataset, specId: string): DefinedFeature[] {
  const spec = getSpecById(data, specId);
  const current = currentRevisionOf(spec);
  const out: DefinedFeature[] = [];
  for (const feature of data.features) {
    const entry = feature.revisions.find((r) => r.spec === specId && r.revision === current.id);
    if (entry) out.push({ feature, entry });
  }
  return out.sort(
    (a, b) =>
      CATEGORY_ORDER.indexOf(a.feature.category) - CATEGORY_ORDER.indexOf(b.feature.category) ||
      a.feature.id.localeCompare(b.feature.id),
  );
}

/** Specs whose current revision is newest, for the "recently revised" line. */
export function recentlyRevised(data: Dataset, n = 5): { spec: Spec; revision: Revision }[] {
  return specNodes(data)
    .map((spec) => ({ spec, revision: currentRevisionOf(spec) }))
    .sort((a, b) => b.revision.date.localeCompare(a.revision.date) || compareSpecs(a.spec, b.spec))
    .slice(0, n);
}

/**
 * The `builds-on` spine of the map: the longest chain of builds-on relations, ordered from the
 * oldest document (the one everything else builds on) to the newest. Ties go to the chain whose
 * documents come first in `compareSpecs` order, so the result is stable across builds. The map
 * draws this chain bold, in full colour.
 */
export function buildsOnSpine(specs: Spec[], relations: Relation[]): Relation[] {
  const byId = new Map(specs.map((s) => [s.id, s]));
  // `from` builds on `to`, so the chain runs from `to` to `from`: index the edges by `to`
  const next = new Map<string, Relation[]>();
  for (const r of relations) {
    if (r.type !== "builds-on" || !byId.has(r.from) || !byId.has(r.to)) continue;
    const list = next.get(r.to) ?? [];
    list.push(r);
    next.set(r.to, list);
  }
  const best = new Map<string, Relation[]>();
  const visiting = new Set<string>();
  const longestFrom = (id: string): Relation[] => {
    const known = best.get(id);
    if (known) return known;
    if (visiting.has(id)) return [];
    visiting.add(id);
    let chain: Relation[] = [];
    const out = [...(next.get(id) ?? [])].sort((a, b) =>
      compareSpecs(byId.get(a.from) as Spec, byId.get(b.from) as Spec),
    );
    for (const r of out) {
      const candidate = [r, ...longestFrom(r.from)];
      if (candidate.length > chain.length) chain = candidate;
    }
    visiting.delete(id);
    best.set(id, chain);
    return chain;
  };
  let spine: Relation[] = [];
  for (const spec of [...specs].sort(compareSpecs)) {
    const chain = longestFrom(spec.id);
    if (chain.length > spine.length) spine = chain;
  }
  return spine;
}
