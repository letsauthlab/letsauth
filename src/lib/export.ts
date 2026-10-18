import { readFileSync } from "node:fs";
import { type Cell, currentRevision, getSpec, matrixFor, matrixRows } from "./atlas";
import type { Dataset } from "./data";

/** Bumps on a breaking change of the export shape (contracts/data-export.md). */
export const EXPORT_VERSION = 1;

function licenseLine(): string {
  try {
    const text = readFileSync(new URL("../../LICENSE-DATA", import.meta.url), "utf8");
    const match = text.match(/Creative Commons [^\n]*?\(([^)]+)\)/);
    return match?.[1] ?? "CC BY 4.0";
  } catch {
    return "CC BY 4.0";
  }
}

function flatCell(cell: Cell) {
  return {
    server: cell.server,
    feature: cell.feature,
    revision: cell.revision,
    status: cell.status,
    derived: cell.derived,
  };
}

function flatObservation(o: Dataset["observations"][number]) {
  return { ...o, revision: o.revision.revision };
}

export function buildExport(data: Dataset, generatedAt = new Date().toISOString()) {
  const spec = getSpec(data);
  const current = currentRevision(data);
  const matrix = matrixFor(data, current.id);
  const listed = new Set(matrixRows(data).map((s) => s.id));
  return {
    version: EXPORT_VERSION,
    generatedAt,
    license: licenseLine(),
    source: "https://letsauth.eu/mcp/",
    spec: { id: spec.id, name: spec.name, currentRevision: current.id, revisions: spec.revisions },
    features: data.features,
    servers: matrix.rows,
    cells: [...matrix.cells.values()].map(flatCell),
    observations: data.observations.filter((o) => listed.has(o.server)).map(flatObservation),
  };
}

export function buildServerExport(
  data: Dataset,
  serverId: string,
  generatedAt = new Date().toISOString(),
) {
  const server = data.servers.find((s) => s.id === serverId);
  if (!server) throw new Error(`server "${serverId}" not found`);
  const spec = getSpec(data);
  const cells: Cell[] = [];
  for (const revision of spec.revisions) {
    const matrix = matrixFor(data, revision.id);
    for (const feature of matrix.columns) {
      const cell = matrix.cells.get(`${server.id}|${feature.id}`);
      if (cell) cells.push(cell);
    }
  }
  return {
    version: EXPORT_VERSION,
    generatedAt,
    license: licenseLine(),
    source: `https://letsauth.eu/mcp/servers/${server.id}/`,
    spec: {
      id: spec.id,
      name: spec.name,
      currentRevision: currentRevision(data).id,
      revisions: spec.revisions,
    },
    server,
    features: data.features.filter((f) => f.party !== "client"),
    cells: cells.map(flatCell),
    observations: data.observations.filter((o) => o.server === server.id).map(flatObservation),
  };
}
