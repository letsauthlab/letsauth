import {
  type Feature,
  type FeatureCategory,
  type FeatureLevel,
  type FeatureRevision,
  methodStrength,
  type Observation,
  type ObservationStatus,
  type Revision,
  type Server,
  type Spec,
} from "../schema";
import type { Dataset } from "./data";

/** The spec the MCP Atlas is about. */
export const ATLAS_SPEC = "mcp-authorization";

export interface Cell {
  server: string;
  feature: string;
  revision: string;
  status: ObservationStatus;
  /** True when no observation exists and the status was derived (unknown / not-applicable). */
  derived: boolean;
  observation?: Observation;
}

export interface Matrix {
  spec: Spec;
  revision: Revision;
  columns: Feature[];
  rows: Server[];
  /** Keyed by `${server}|${feature}`. */
  cells: Map<string, Cell>;
}

export const cellKey = (server: string, feature: string) => `${server}|${feature}`;

export function getSpec(data: Dataset, specId = ATLAS_SPEC): Spec {
  const spec = data.specs.find((s) => s.id === specId);
  if (!spec) throw new Error(`spec "${specId}" not found`);
  return spec;
}

export function getRevision(data: Dataset, revisionId: string, specId = ATLAS_SPEC): Revision {
  const rev = getSpec(data, specId).revisions.find((r) => r.id === revisionId);
  if (!rev) throw new Error(`revision "${revisionId}" of "${specId}" not found`);
  return rev;
}

export function currentRevision(data: Dataset, specId = ATLAS_SPEC): Revision {
  const rev = getSpec(data, specId).revisions.find((r) => r.status === "current");
  if (!rev) throw new Error(`spec "${specId}" has no current revision`);
  return rev;
}

/** Revisions of the atlas spec, newest first. */
export function revisionsNewestFirst(data: Dataset, specId = ATLAS_SPEC): Revision[] {
  return [...getSpec(data, specId).revisions].sort((a, b) => b.date.localeCompare(a.date));
}

export function featureInRevision(
  feature: Feature,
  revisionId: string,
  specId = ATLAS_SPEC,
): FeatureRevision | undefined {
  return feature.revisions.find((r) => r.spec === specId && r.revision === revisionId);
}

/** Column order follows the flow a client goes through: discovery first, consent last. */
export const CATEGORY_ORDER: FeatureCategory[] = [
  "discovery",
  "registration",
  "authorization",
  "token",
  "transport",
  "session",
  "delegation",
  "consent",
];

/** Features shown as matrix columns for a revision: defined in it and not client-party. */
export function matrixColumns(data: Dataset, revisionId: string, specId = ATLAS_SPEC): Feature[] {
  return data.features
    .filter((f) => f.party !== "client" && featureInRevision(f, revisionId, specId))
    .sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
        a.id.localeCompare(b.id),
    );
}

/** Servers shown as matrix rows: not withdrawn, by name. */
export function matrixRows(data: Dataset): Server[] {
  return data.servers.filter((s) => !s.withdrawn).sort((a, b) => a.name.localeCompare(b.name));
}

function sortNewestFirst(observations: Observation[]): Observation[] {
  return [...observations].sort(
    (a, b) =>
      Date.parse(b.observedAt) - Date.parse(a.observedAt) ||
      methodStrength[b.method] - methodStrength[a.method],
  );
}

export function observationsFor(
  data: Dataset,
  server: string,
  feature: string,
  revisionId: string,
  specId = ATLAS_SPEC,
): Observation[] {
  return sortNewestFirst(
    data.observations.filter(
      (o) =>
        o.server === server &&
        o.feature === feature &&
        o.revision.spec === specId &&
        o.revision.revision === revisionId,
    ),
  );
}

/**
 * The current state of one cell: the newest observation wins, ties broken by method strength.
 * With no observation the cell is `unknown`, or `not-applicable` for stdio-only servers.
 */
export function currentCell(
  data: Dataset,
  server: Server,
  feature: Feature,
  revisionId: string,
  specId = ATLAS_SPEC,
): Cell {
  const history = observationsFor(data, server.id, feature.id, revisionId, specId);
  const newest = history[0];
  if (newest) {
    return {
      server: server.id,
      feature: feature.id,
      revision: revisionId,
      status: newest.status,
      derived: false,
      observation: newest,
    };
  }
  return {
    server: server.id,
    feature: feature.id,
    revision: revisionId,
    status: server.transport === "stdio-only" ? "not-applicable" : "unknown",
    derived: true,
  };
}

/** Every observation for a cell except the current one, newest first. */
export function cellHistory(
  data: Dataset,
  server: string,
  feature: string,
  revisionId: string,
  specId = ATLAS_SPEC,
): Observation[] {
  return observationsFor(data, server, feature, revisionId, specId).slice(1);
}

export function matrixFor(data: Dataset, revisionId: string, specId = ATLAS_SPEC): Matrix {
  const spec = getSpec(data, specId);
  const revision = getRevision(data, revisionId, specId);
  const columns = matrixColumns(data, revisionId, specId);
  const rows = matrixRows(data);
  const cells = new Map<string, Cell>();
  for (const server of rows) {
    for (const feature of columns) {
      cells.set(
        cellKey(server.id, feature.id),
        currentCell(data, server, feature, revisionId, specId),
      );
    }
  }
  return { spec, revision, columns, rows, cells };
}

export interface FeatureShare {
  supported: number;
  partial: number;
  unsupported: number;
  unknown: number;
  notApplicable: number;
  /** supported / (supported + partial + unsupported), or null when nothing is known. */
  share: number | null;
}

/** Adoption share of a feature across listed servers. Unknown and not-applicable are excluded. */
export function featureShare(
  data: Dataset,
  featureId: string,
  revisionId: string,
  specId = ATLAS_SPEC,
): FeatureShare {
  const feature = data.features.find((f) => f.id === featureId);
  if (!feature) throw new Error(`feature "${featureId}" not found`);
  const counts: FeatureShare = {
    supported: 0,
    partial: 0,
    unsupported: 0,
    unknown: 0,
    notApplicable: 0,
    share: null,
  };
  for (const server of matrixRows(data)) {
    const cell = currentCell(data, server, feature, revisionId, specId);
    if (cell.status === "not-applicable") counts.notApplicable += 1;
    else counts[cell.status] += 1;
  }
  const known = counts.supported + counts.partial + counts.unsupported;
  counts.share = known === 0 ? null : counts.supported / known;
  return counts;
}

export interface RevisionDiff {
  from: Revision;
  to: Revision;
  changed: { feature: Feature; from: FeatureLevel; to: FeatureLevel }[];
  added: Feature[];
  removed: Feature[];
}

/** Features whose level changed between two revisions, or that exist in only one of them. */
export function revisionDiff(
  data: Dataset,
  fromId: string,
  toId: string,
  specId = ATLAS_SPEC,
): RevisionDiff {
  const diff: RevisionDiff = {
    from: getRevision(data, fromId, specId),
    to: getRevision(data, toId, specId),
    changed: [],
    added: [],
    removed: [],
  };
  for (const feature of data.features) {
    const a = featureInRevision(feature, fromId, specId);
    const b = featureInRevision(feature, toId, specId);
    if (a && b) {
      if (a.level !== b.level) diff.changed.push({ feature, from: a.level, to: b.level });
    } else if (b) {
      diff.added.push(feature);
    } else if (a) {
      diff.removed.push(feature);
    }
  }
  const byId = (x: { id: string }, y: { id: string }) => x.id.localeCompare(y.id);
  diff.changed.sort((x, y) => byId(x.feature, y.feature));
  diff.added.sort(byId);
  diff.removed.sort(byId);
  return diff;
}

/** Adjacent (older, newer) revision pairs of the atlas spec, for the changes pages. */
export function revisionPairs(data: Dataset, specId = ATLAS_SPEC): [Revision, Revision][] {
  const asc = [...revisionsNewestFirst(data, specId)].reverse();
  const pairs: [Revision, Revision][] = [];
  for (let i = 1; i < asc.length; i += 1) {
    const older = asc[i - 1];
    const newer = asc[i];
    if (older && newer) pairs.push([older, newer]);
  }
  return pairs;
}
