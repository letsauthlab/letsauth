/*
 * What changed in the atlas, read from the append-only observation history (spec 019).
 *
 * A status change is two consecutive observations of one cell, in date order, whose statuses
 * differ. The home page leads with them ("Since the last run"), rings the changed cells on the
 * plate, and ranks requirements by how many servers are observed without them. Nothing here
 * ranks or scores a server.
 */
import { methodStrength, type Observation, type ObservationStatus } from "@/schema";
import { ATLAS_SPEC, cellKey, matrixFor } from "./atlas";
import type { Dataset } from "./data";

export interface StatusChange {
  server: string;
  feature: string;
  from: ObservationStatus;
  to: ObservationStatus;
  /** The observation that recorded the new status. */
  observation: Observation;
  /** Every observation of the cell, newest first; the evidence stack under a change. */
  history: Observation[];
}

/**
 * Observations of one revision of the atlas spec, grouped per cell, oldest first; at the same
 * moment the weaker method comes first, as `currentCell` lets the stronger one win.
 */
function cellsOf(data: Pick<Dataset, "observations">, revisionId: string, specId: string) {
  const cells = new Map<string, Observation[]>();
  for (const o of data.observations) {
    if (o.revision.spec !== specId || o.revision.revision !== revisionId) continue;
    const key = cellKey(o.server, o.feature);
    const list = cells.get(key);
    if (list) list.push(o);
    else cells.set(key, [o]);
  }
  for (const list of cells.values())
    list.sort(
      (a, b) =>
        Date.parse(a.observedAt) - Date.parse(b.observedAt) ||
        methodStrength[a.method] - methodStrength[b.method],
    );
  return cells;
}

/**
 * Every status change on record for one revision, newest first; ties by server, then feature,
 * so the order is stable from build to build.
 */
export function statusChanges(
  data: Pick<Dataset, "observations">,
  revisionId: string,
  specId = ATLAS_SPEC,
): StatusChange[] {
  const changes: StatusChange[] = [];
  for (const list of cellsOf(data, revisionId, specId).values()) {
    const history = [...list].reverse();
    for (let i = 1; i < list.length; i++) {
      const before = list[i - 1];
      const after = list[i];
      if (!before || !after || before.status === after.status) continue;
      changes.push({
        server: after.server,
        feature: after.feature,
        from: before.status,
        to: after.status,
        observation: after,
        history,
      });
    }
  }
  return changes.sort(
    (a, b) =>
      b.observation.observedAt.localeCompare(a.observation.observedAt) ||
      a.server.localeCompare(b.server) ||
      a.feature.localeCompare(b.feature),
  );
}

/** The UTC day of an ISO timestamp. */
export const dayOf = (iso: string) => iso.slice(0, 10);

/** Changes grouped by UTC day, newest day first, the order inside a day kept. */
export function changesByDay(changes: StatusChange[]): [string, StatusChange[]][] {
  const days = new Map<string, StatusChange[]>();
  for (const c of changes) {
    const day = dayOf(c.observation.observedAt);
    const list = days.get(day);
    if (list) list.push(c);
    else days.set(day, [c]);
  }
  return [...days.entries()];
}

/**
 * The scanner runs after a given moment: the distinct timestamps (to the minute) of passive
 * scans, oldest first. A run that recorded no status change is still news for a record.
 */
export function scanRunsAfter(data: Pick<Dataset, "observations">, after: string): string[] {
  const runs = new Set<string>();
  for (const o of data.observations)
    if (o.method === "passive-scan" && o.observedAt > after) runs.add(o.observedAt.slice(0, 16));
  return [...runs].sort();
}

/**
 * Servers first observed after a given moment for one revision: their earliest observation of
 * any cell comes later. A first observation is not a status change (there is no status before
 * it), so the quiet line under the matrix names these on their own. Sorted by id.
 */
export function firstObservedAfter(
  data: Pick<Dataset, "observations">,
  after: string,
  revisionId: string,
  specId = ATLAS_SPEC,
): string[] {
  const first = new Map<string, string>();
  for (const o of data.observations) {
    if (o.revision.spec !== specId || o.revision.revision !== revisionId) continue;
    const seen = first.get(o.server);
    if (!seen || o.observedAt < seen) first.set(o.server, o.observedAt);
  }
  return [...first]
    .filter(([, at]) => at > after)
    .map(([id]) => id)
    .sort();
}

export interface MissingRequirement {
  feature: string;
  /** Servers whose current cell for this requirement is unsupported. */
  unsupported: number;
  /** Servers in the matrix. */
  of: number;
}

/**
 * Requirements of the current matrix ordered by how many servers are observed unsupported,
 * most first; ties by feature id. Requirements with none are left out. This ranks
 * requirements, never servers.
 */
export function missingMostOften(
  data: Dataset,
  revisionId: string,
  specId = ATLAS_SPEC,
): MissingRequirement[] {
  const matrix = matrixFor(data, revisionId, specId);
  const counts = matrix.columns.map((f) => {
    let unsupported = 0;
    for (const s of matrix.rows)
      if (matrix.cells.get(cellKey(s.id, f.id))?.status === "unsupported") unsupported += 1;
    return { feature: f.id, unsupported, of: matrix.rows.length };
  });
  return counts
    .filter((c) => c.unsupported > 0)
    .sort((a, b) => b.unsupported - a.unsupported || a.feature.localeCompare(b.feature));
}

/**
 * Cells whose status changed on or after a given day: the rings on the home plate. Keys are
 * `cellKey(server, feature)`.
 */
export function changedSince(changes: StatusChange[], day: string): Set<string> {
  const keys = new Set<string>();
  for (const c of changes)
    if (dayOf(c.observation.observedAt) >= day) keys.add(cellKey(c.server, c.feature));
  return keys;
}
