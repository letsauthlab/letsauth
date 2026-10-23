import ELK, { type ElkExtendedEdge, type ElkNode } from "elkjs/lib/elk.bundled.js";
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
 * each group carries the body's name. Each family of documents joined by dependencies is laid
 * out on its own and packed onto one column grid (see `layoutGraph`). The cross links
 * (references, competes-with, solves-same-problem-as) are not part of the shape and are drawn as
 * curves over it.
 */

export const NODE_W = 200;
export const NODE_H = 68;
/** the gap between layers, where the orthogonal edges run */
export const COL_GAP = 72;
/** the gap between nodes in a layer; a band label sits in the gap above its first node */
export const ROW_GAP = 24;
export const PAD = 16;
/** the gap above a family of documents that sits under another in the same columns */
export const COMPONENT_GAP = 40;
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

function route(from: PlacedNode, to: PlacedNode): { d: string; mid: Point } {
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
    // same column: bow out to the right of both nodes
    const down = to.y > from.y;
    p0 = { x: from.x + from.w, y: from.y + from.h / 2 + (down ? 10 : -10) };
    p3 = { x: to.x + to.w, y: to.y + to.h / 2 + (down ? -10 : 10) };
    const bow = COL_GAP * 0.55;
    p1 = { x: p0.x + bow, y: p0.y };
    p2 = { x: p3.x + bow, y: p3.y };
  }
  const d = `M${round(p0.x)},${round(p0.y)} C${round(p1.x)},${round(p1.y)} ${round(p2.x)},${round(p2.y)} ${round(p3.x)},${round(p3.y)}`;
  const m = bezier(p0, p1, p2, p3, 0.5);
  return { d, mid: { x: round(m.x), y: round(m.y) } };
}

/** Groups of specs joined by dependency relations, each in compareSpecs order, largest first. */
function dependencyComponents(sorted: Spec[], dependencies: Relation[]): Spec[][] {
  const root = new Map(sorted.map((s) => [s.id, s.id]));
  const find = (id: string): string => {
    let r = id;
    while (root.get(r) !== r) r = root.get(r) ?? r;
    root.set(id, r);
    return r;
  };
  for (const r of dependencies) root.set(find(r.from), find(r.to));
  const groups = new Map<string, Spec[]>();
  for (const s of sorted) {
    const key = find(s.id);
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  // documents on their own stack by body, so a body's loose documents stay together
  const merged = new Map<string, Spec[]>();
  for (const [key, group] of groups) {
    const solo = group.length === 1 && group[0] ? `body:${group[0].body}` : key;
    merged.set(solo, [...(merged.get(solo) ?? []), ...group]);
  }
  // Map keeps first-seen order, which is compareSpecs order of each group's first member
  return [...merged.values()].sort((a, b) => b.length - a.length);
}

interface Placed {
  nodes: Map<string, Point>;
  edges: Map<string, Point[]>;
  columns: number;
}

/** One component through ELK, at the origin, with its layers on the shared column grid. */
async function layoutComponent(
  elk: InstanceType<typeof ELK>,
  members: Spec[],
  dependencies: Relation[],
): Promise<Placed> {
  const ids = new Set(members.map((s) => s.id));
  const own = dependencies.filter((r) => ids.has(r.from));
  const graph: ElkNode = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.padding": "[top=0,left=0,bottom=0,right=0]",
      "elk.layered.spacing.nodeNodeBetweenLayers": String(COL_GAP),
      "elk.layered.spacing.edgeNodeBetweenLayers": "20",
      "elk.spacing.nodeNode": String(ROW_GAP),
      "elk.spacing.edgeNode": "12",
      "elk.spacing.edgeEdge": "8",
      "elk.layered.crossingMinimization.forceNodeModelOrder": "true",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
      "elk.layered.mergeEdges": "true",
    },
    children: members.map((s) => ({ id: s.id, width: NODE_W, height: NODE_H })),
    // the older document is the source, so the drawing reads left to right in time
    edges: own.map((r, i) => ({ id: `d${i}`, sources: [r.to], targets: [r.from] })),
  };
  const out = await elk.layout(graph);
  const nodes = new Map<string, Point>();
  for (const child of out.children ?? []) nodes.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
  const edges = new Map<string, Point[]>();
  for (const [i, r] of own.entries()) {
    const section = (out.edges as ElkExtendedEdge[] | undefined)?.find((x) => x.id === `d${i}`)
      ?.sections?.[0];
    if (!section) continue;
    // ELK ran the edge from the older document; the arrow points at it, so reverse the points
    const points = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint].reverse();
    edges.set(`${r.from}|${r.type}|${r.to}`, points);
  }
  const right = Math.max(...[...nodes.values()].map((p) => p.x + NODE_W));
  return { nodes, edges, columns: Math.round((right + COL_GAP) / (NODE_W + COL_GAP)) };
}

/**
 * The largest component (the OAuth family) sets the grid and goes first, top left. Each smaller
 * one then drops into the free space of the grid: per column a floor under everything already
 * drawn there, nodes and the lines in the gap before it, and the component takes the run of
 * columns whose highest floor is lowest, leftmost on a tie. So the families with no dependency
 * on the OAuth core fill the room its long first column leaves, instead of stacking under it.
 */
export async function layoutGraph(specs: Spec[], relations: Relation[]): Promise<Layout> {
  const sorted = [...specs].sort(compareSpecs);
  const ids = new Set(sorted.map((s) => s.id));
  const depth = dependencyDepths(sorted, relations);
  const dependencies = relations.filter(
    (r) => isDependency(r.type) && ids.has(r.from) && ids.has(r.to),
  );
  const elk = new ELK();
  const parts: Placed[] = [];
  for (const members of dependencyComponents(sorted, dependencies)) {
    parts.push(await layoutComponent(elk, members, dependencies));
  }
  // after the largest, the narrow ones first: single documents fill the deep gaps beside a long
  // column, which a family two columns wide could not use (the sort is stable, so ties keep order)
  const [main, ...rest] = parts;
  rest.sort((a, b) => a.columns - b.columns);

  const step = NODE_W + COL_GAP;
  const columns = Math.max(1, ...parts.map((p) => p.columns));
  const floor: number[] = new Array(columns).fill(0);
  const raise = (x0: number, x1: number, y: number) => {
    for (let c = 0; c < columns; c++) {
      const left = PAD + c * step - COL_GAP;
      const right = PAD + c * step + NODE_W;
      if (x1 > left && x0 < right) floor[c] = Math.max(floor[c] ?? 0, y);
    }
  };
  const positions = new Map<string, Point>();
  const routes = new Map<string, Point[]>();
  for (const part of main ? [main, ...rest] : []) {
    let best = 0;
    let top = Number.POSITIVE_INFINITY;
    for (let c = 0; c + part.columns <= columns; c++) {
      const y = Math.max(...floor.slice(c, c + part.columns));
      if (y < top) {
        top = y;
        best = c;
      }
    }
    // the top gap holds the band label; a component under another gets a wider one
    const dx = PAD + best * step;
    const dy = top === 0 ? PAD + ROW_GAP : top + COMPONENT_GAP;
    for (const [id, p] of part.nodes) {
      const at = { x: round(p.x + dx), y: round(p.y + dy) };
      positions.set(id, at);
      raise(at.x, at.x + NODE_W, at.y + NODE_H);
    }
    for (const [key, points] of part.edges) {
      const moved = points.map((p) => ({ x: round(p.x + dx), y: round(p.y + dy) }));
      routes.set(key, moved);
      for (const [a, b] of moved.slice(1).map((p, j) => [moved[j], p] as const)) {
        if (!a) continue;
        raise(Math.min(a.x, b.x), Math.max(a.x, b.x) + 1, Math.max(a.y, b.y));
      }
    }
  }

  const nodes: PlacedNode[] = [];
  for (const spec of sorted) {
    const p = positions.get(spec.id);
    if (!p) continue;
    nodes.push({ spec, x: p.x, y: p.y, w: NODE_W, h: NODE_H, depth: depth.get(spec.id) ?? 0 });
  }
  const placed = new Map(nodes.map((n) => [n.spec.id, n]));

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

  const edges: PlacedEdge[] = [];
  for (const relation of relations) {
    const from = placed.get(relation.from);
    const to = placed.get(relation.to);
    if (!from || !to) continue;
    const symmetric = isSymmetric(relation.type);
    const points = routes.get(`${relation.from}|${relation.type}|${relation.to}`);
    if (points) {
      const d = points.map((p, j) => `${j === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
      const m = points[Math.floor(points.length / 2)] ?? points[0] ?? { x: 0, y: 0 };
      edges.push({ relation, from, to, symmetric, d, mid: m });
    } else {
      edges.push({ relation, from, to, symmetric, ...route(from, to) });
    }
  }
  // a cross link within one column bows out to the right of it, so it counts towards the width
  const right = Math.max(
    0,
    ...nodes.map((n) => n.x + n.w),
    ...edges.flatMap((e) => (e.d.match(/[\d.]+(?=,)/g) ?? []).map(Number)),
  );
  return {
    nodes,
    edges,
    bands,
    columns: columnsX.length,
    width: Math.ceil(right + PAD),
    height: Math.ceil(Math.max(0, ...floor) + PAD),
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
