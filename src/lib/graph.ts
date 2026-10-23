import ELK, { type ElkNode } from "elkjs/lib/elk.bundled.js";
import {
  isDependency,
  isSymmetric,
  type Relation,
  type RelationType,
  type Spec,
  type SpecBody,
} from "../schema";
import { compareSpecs } from "./standards";

/**
 * Build-time layout for the standards map (research R2). Deterministic: the same nodes and
 * relations always yield the same coordinates, so the SVG is stable across builds and can be
 * compared by screenshot.
 *
 * The dependency relations (builds-on, profiles, replaces) shape the drawing: ELK's layered
 * algorithm puts a spec one layer right of what it builds on and routes those edges
 * orthogonally around the nodes. Within a layer the nodes keep model order, which is
 * `compareSpecs` order, so each column groups by publishing body in BODY_ORDER; a band behind
 * each group carries the body's name. Each group of specs joined by dependencies is laid out
 * on its own and the small ones are packed under the large one, see `layoutGraph`. The cross links (references, competes-with,
 * solves-same-problem-as) are not part of the shape and are drawn as curves over it.
 */

export const NODE_W = 200;
export const NODE_H = 68;
/** the gap between layers, where the orthogonal edges run */
export const COL_GAP = 72;
/** the gap between nodes in a layer; a band label sits in the gap above its first node */
export const ROW_GAP = 24;
export const PAD = 16;
export const BAND_PAD = 6;

export interface PlacedNode {
  spec: Spec;
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface PlacedEdge {
  relation: Relation;
  from: PlacedNode;
  to: PlacedNode;
  symmetric: boolean;
  /** SVG path data from `from` to `to`: a polyline for a dependency, a cubic curve otherwise. */
  d: string;
  /** Point halfway along the edge, for a label or title anchor. */
  mid: Point;
}

/** A run of nodes of one publishing body in one column, drawn as a tinted band with a label. */
export interface Band {
  body: SpecBody;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Layout {
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  bands: Band[];
  columns: number;
  width: number;
  height: number;
}

/** Longest dependency path from a root, per spec id. Cycles (rejected by validation) count as 0. */
export function dependencyDepths(specs: Spec[], relations: Relation[]): Map<string, number> {
  const ids = new Set(specs.map((s) => s.id));
  const deps = new Map<string, string[]>();
  for (const r of relations) {
    if (!isDependency(r.type) || !ids.has(r.from) || !ids.has(r.to)) continue;
    const list = deps.get(r.from) ?? [];
    list.push(r.to);
    deps.set(r.from, list);
  }
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const resolve = (id: string): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let d = 0;
    for (const target of deps.get(id) ?? []) d = Math.max(d, resolve(target) + 1);
    visiting.delete(id);
    depth.set(id, d);
    return d;
  };
  for (const spec of specs) resolve(spec.id);
  return depth;
}

function bezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

const round = (n: number) => Math.round(n * 10) / 10;

/** Anchors on the node borders and a curve between them, chosen by relative position. */
/** A point on a node's side edge, pulled towards the other node so parallel edges fan out. */
function sideAnchor(node: PlacedNode, towardsY: number): number {
  const inset = 10;
  return Math.min(node.y + node.h - inset, Math.max(node.y + inset, towardsY));
}

function route(from: PlacedNode, to: PlacedNode, right: number): { d: string; mid: Point } {
  let p0: Point;
  let p3: Point;
  let p1: Point;
  let p2: Point;
  const fromMid = from.y + from.h / 2;
  const toMid = to.y + to.h / 2;
  if (to.x + to.w < from.x) {
    // target is to the left: leave from the left edge, arrive at the right edge
    p0 = { x: from.x, y: sideAnchor(from, toMid) };
    p3 = { x: to.x + to.w, y: sideAnchor(to, fromMid) };
    const dx = (p0.x - p3.x) / 2;
    p1 = { x: p0.x - dx, y: p0.y };
    p2 = { x: p3.x + dx, y: p3.y };
  } else if (from.x + from.w < to.x) {
    // target is to the right
    p0 = { x: from.x + from.w, y: sideAnchor(from, toMid) };
    p3 = { x: to.x, y: sideAnchor(to, fromMid) };
    const dx = (p3.x - p0.x) / 2;
    p1 = { x: p0.x + dx, y: p0.y };
    p2 = { x: p3.x - dx, y: p3.y };
  } else {
    // same column: bow out to the right of both nodes, or to the left in the last column
    const down = to.y > from.y;
    const side = from.x + from.w >= right ? 0 : from.w;
    const bow = COL_GAP * 0.55 * (side ? 1 : -1);
    p0 = { x: from.x + side, y: from.y + from.h / 2 + (down ? 10 : -10) };
    p3 = { x: to.x + side, y: to.y + to.h / 2 + (down ? -10 : 10) };
    p1 = { x: p0.x + bow, y: p0.y };
    p2 = { x: p3.x + bow, y: p3.y };
  }
  const d = `M${round(p0.x)},${round(p0.y)} C${round(p1.x)},${round(p1.y)} ${round(p2.x)},${round(p2.y)} ${round(p3.x)},${round(p3.y)}`;
  const m = bezier(p0, p1, p2, p3, 0.5);
  return { d, mid: { x: round(m.x), y: round(m.y) } };
}

/** The vertical gap above a packed component: room for its band label and a clear break. */
const PACK_GAP = 2 * ROW_GAP;

const ELK_OPTIONS: Record<string, string> = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.padding": `[top=${PAD + ROW_GAP},left=${PAD},bottom=${PAD},right=${PAD}]`,
  "elk.layered.spacing.nodeNodeBetweenLayers": String(COL_GAP),
  "elk.layered.spacing.edgeNodeBetweenLayers": "20",
  "elk.spacing.nodeNode": String(ROW_GAP),
  "elk.spacing.edgeNode": "12",
  "elk.spacing.edgeEdge": "8",
  "elk.separateConnectedComponents": "false",
  "elk.layered.crossingMinimization.forceNodeModelOrder": "true",
  "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
  "elk.layered.mergeEdges": "true",
};

/**
 * The parts of the drawing: specs joined by dependency relations, the largest first and the rest
 * in `compareSpecs` order of their first spec. Specs with no dependency either way stack in one
 * part per publishing body, so each body keeps one band.
 */
function components(sorted: Spec[], dependencies: Relation[]): Spec[][] {
  const parent = new Map(sorted.map((s) => [s.id, s.id]));
  const find = (id: string): string => {
    const p = parent.get(id) ?? id;
    if (p === id) return id;
    const root = find(p);
    parent.set(id, root);
    return root;
  };
  const linked = new Set<string>();
  for (const r of dependencies) {
    linked.add(r.from);
    linked.add(r.to);
    parent.set(find(r.from), find(r.to));
  }
  const groups = new Map<string, Spec[]>();
  for (const s of sorted) {
    const key = linked.has(s.id) ? find(s.id) : `body:${s.body}`;
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }
  const parts = [...groups.values()];
  const largest = parts.reduce((a, b) => (b.length > a.length ? b : a), parts[0] ?? []);
  return [largest, ...parts.filter((p) => p !== largest)];
}

/**
 * Build-time layout. The largest part is laid out first and sets the columns; every other part
 * is laid out on its own and dropped into the columns where it sits highest, under what is
 * already there, so the small trees and the standalone specs fill the space the long first
 * column leaves free instead of hanging below it.
 */
export async function layoutGraph(specs: Spec[], relations: Relation[]): Promise<Layout> {
  const sorted = [...specs].sort(compareSpecs);
  const ids = new Set(sorted.map((s) => s.id));
  const depth = dependencyDepths(sorted, relations);
  const dependencies = relations.filter(
    (r) => isDependency(r.type) && ids.has(r.from) && ids.has(r.to),
  );
  const elk = new ELK();

  const placed = new Map<string, PlacedNode>();
  const routed = new Map<string, Point[]>();
  /** the x of each column, from the first part */
  let columnX: number[] = [];
  /** the lowest point drawn so far in each column, and in the gap right of each column */
  const bottom: number[] = [];
  const gapBottom: number[] = [];
  const mark = (x: number, y: number) => {
    const i = columnX.findIndex((cx) => x <= cx + NODE_W);
    const c = i === -1 ? columnX.length - 1 : i;
    const inGap = i === -1 || x < (columnX[c] ?? 0);
    const list = inGap ? gapBottom : bottom;
    const at = inGap && i !== -1 ? c - 1 : c;
    list[at] = Math.max(list[at] ?? 0, y);
  };

  for (const [index, part] of components(sorted, dependencies).entries()) {
    const own = new Set(part.map((s) => s.id));
    const deps = dependencies.filter((r) => own.has(r.from));
    const graph: ElkNode = {
      id: "root",
      layoutOptions: ELK_OPTIONS,
      children: part.map((s) => ({ id: s.id, width: NODE_W, height: NODE_H })),
      // the older document is the source, so the drawing reads left to right in time
      edges: deps.map((r, i) => ({ id: `d${i}`, sources: [r.to], targets: [r.from] })),
    };
    const out = await elk.layout(graph);
    const children = out.children ?? [];
    const localX = [...new Set(children.map((c) => round(c.x ?? 0)))].sort((a, b) => a - b);
    const top = Math.min(...children.map((c) => c.y ?? 0));
    let dx = 0;
    let dy = 0;
    if (index === 0) {
      columnX = localX;
    } else {
      // the leftmost run of columns where the part's top can sit highest
      const span = localX.length;
      let best = { start: 0, y: Number.POSITIVE_INFINITY };
      for (let start = 0; start + span <= Math.max(columnX.length, span); start++) {
        let y = 0;
        for (let j = 0; j < span; j++) {
          y = Math.max(y, (bottom[start + j] ?? 0) + PACK_GAP);
          if (j < span - 1) y = Math.max(y, (gapBottom[start + j] ?? 0) + PACK_GAP);
        }
        if (y < best.y) best = { start, y };
      }
      dx = (columnX[best.start] ?? PAD) - (localX[0] ?? 0);
      dy = best.y - top;
    }
    for (const child of children) {
      const spec = part.find((s) => s.id === child.id);
      if (!spec) continue;
      const node: PlacedNode = {
        spec,
        x: round((child.x ?? 0) + dx),
        y: round((child.y ?? 0) + dy),
        w: NODE_W,
        h: NODE_H,
        depth: depth.get(spec.id) ?? 0,
      };
      placed.set(spec.id, node);
    }
    for (const [i, r] of deps.entries()) {
      const section = out.edges?.find((x) => x.id === `d${i}`)?.sections?.[0];
      if (!section) continue;
      // ELK ran the edge from the older document; the arrow points at it, so reverse the points
      const points = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint]
        .map((p) => ({ x: round(p.x + dx), y: round(p.y + dy) }))
        .reverse();
      routed.set(`${r.from}|${r.type}|${r.to}`, points);
    }
    for (const spec of part) {
      const n = placed.get(spec.id);
      if (n) mark(n.x, n.y + n.h);
    }
    for (const r of deps) {
      for (const p of routed.get(`${r.from}|${r.type}|${r.to}`) ?? []) mark(p.x, p.y);
    }
  }
  const nodes = sorted.map((s) => placed.get(s.id)).filter((n): n is PlacedNode => !!n);

  // bands: consecutive nodes of one body in one column
  const bands: Band[] = [];
  const byColumn = new Map<number, PlacedNode[]>();
  for (const n of nodes) {
    const list = byColumn.get(n.x) ?? [];
    list.push(n);
    byColumn.set(n.x, list);
  }
  const columnsX = [...byColumn.keys()].sort((a, b) => a - b);
  for (const x of columnsX) {
    const column = (byColumn.get(x) ?? []).sort((a, b) => a.y - b.y);
    let band: Band | undefined;
    for (const n of column) {
      if (band && band.body === n.spec.body && n.y - (band.y + band.height) <= ROW_GAP + 1) {
        band.height = n.y + n.h + BAND_PAD - band.y;
      } else {
        band = {
          body: n.spec.body,
          x: n.x - BAND_PAD,
          y: n.y - BAND_PAD,
          width: n.w + 2 * BAND_PAD,
          height: n.h + 2 * BAND_PAD,
        };
        bands.push(band);
      }
    }
  }

  const right = Math.max(...nodes.map((n) => n.x + n.w), 0);
  const edges: PlacedEdge[] = [];
  for (const relation of relations) {
    const from = placed.get(relation.from);
    const to = placed.get(relation.to);
    if (!from || !to) continue;
    const symmetric = isSymmetric(relation.type);
    const points = routed.get(`${relation.from}|${relation.type}|${relation.to}`);
    if (points) {
      const d = points.map((p, j) => `${j === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
      const m = points[Math.floor(points.length / 2)] ?? points[0] ?? { x: 0, y: 0 };
      edges.push({ relation, from, to, symmetric, d, mid: m });
    } else {
      edges.push({ relation, from, to, symmetric, ...route(from, to, right) });
    }
  }
  const low = Math.max(...nodes.map((n) => n.y + n.h), ...bottom, ...gapBottom, 0);
  return {
    nodes,
    edges,
    bands,
    columns: columnsX.length,
    width: Math.ceil(right + PAD),
    height: Math.ceil(low + PAD),
  };
}

/** One row of the dependency outline: a spec, the relation to its parent, and its children. */
export interface TreeNode {
  spec: Spec;
  /** how this spec relates to the row above it (undefined on a root) */
  parentType?: RelationType;
  /** further dependency parents, when a spec builds on more than one document */
  alsoParents: { spec: Spec; type: RelationType }[];
  children: TreeNode[];
  depth: number;
}

export interface Forest {
  /** one tree per root, in compareSpecs order of the roots */
  trees: TreeNode[];
  /** specs with no dependency relation either way, in compareSpecs order */
  standalone: Spec[];
}

/**
 * The map as an outline (phones, screen readers): the dependency relations (builds-on, profiles,
 * replaces) form a forest, so every spec sits under one parent. A spec with several parents sits
 * under the deepest one and names the others, so each spec appears once. Cross links (references,
 * competes-with, solves-same-problem-as) are not part of the shape; the outline shows them as
 * chips on the row.
 */
export function buildForest(specs: Spec[], relations: Relation[]): Forest {
  const sorted = [...specs].sort(compareSpecs);
  const byId = new Map(sorted.map((s) => [s.id, s]));
  const depth = dependencyDepths(sorted, relations);
  const parentsOf = new Map<string, { spec: Spec; type: RelationType }[]>();
  const hasChild = new Set<string>();
  for (const r of relations) {
    if (!isDependency(r.type)) continue;
    const parent = byId.get(r.to);
    if (!parent || !byId.has(r.from)) continue;
    const list = parentsOf.get(r.from) ?? [];
    list.push({ spec: parent, type: r.type });
    parentsOf.set(r.from, list);
    hasChild.add(r.to);
  }
  const chosen = new Map<string, { spec: Spec; type: RelationType }>();
  const also = new Map<string, { spec: Spec; type: RelationType }[]>();
  for (const [id, parents] of parentsOf) {
    const ranked = [...parents].sort(
      (a, b) =>
        (depth.get(b.spec.id) ?? 0) - (depth.get(a.spec.id) ?? 0) || compareSpecs(a.spec, b.spec),
    );
    const first = ranked[0];
    if (!first) continue;
    chosen.set(id, first);
    also.set(id, ranked.slice(1));
  }
  const childrenOf = new Map<string, Spec[]>();
  for (const [id, parent] of chosen) {
    const spec = byId.get(id);
    if (!spec) continue;
    const list = childrenOf.get(parent.spec.id) ?? [];
    list.push(spec);
    childrenOf.set(parent.spec.id, list);
  }
  const seen = new Set<string>();
  const node = (spec: Spec, d: number): TreeNode => {
    seen.add(spec.id);
    const children = (childrenOf.get(spec.id) ?? [])
      .filter((c) => !seen.has(c.id))
      .sort(compareSpecs)
      .map((c) => node(c, d + 1));
    return {
      spec,
      parentType: chosen.get(spec.id)?.type,
      alsoParents: also.get(spec.id) ?? [],
      children,
      depth: d,
    };
  };
  const trees = sorted
    .filter((s) => !chosen.has(s.id) && hasChild.has(s.id))
    .map((s) => node(s, 0));
  const standalone = sorted.filter((s) => !chosen.has(s.id) && !hasChild.has(s.id));
  return { trees, standalone };
}

/** Greedy word wrap for node labels; the last line gets an ellipsis when the name does not fit. */
export function wrapLabel(name: string, maxChars = 24, maxLines = 2): string[] {
  const words = name.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1] ?? "";
  kept[maxLines - 1] = `${last.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
  return kept;
}
