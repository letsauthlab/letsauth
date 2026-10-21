import { isDependency, isSymmetric, type Relation, type Spec, type SpecBody } from "../schema";
import { BODY_ORDER, compareSpecs } from "./standards";

/**
 * Build-time layout for the standards map (research R2). Deterministic: the same nodes and
 * relations always yield the same coordinates, so the SVG is stable across builds and can be
 * compared by screenshot.
 *
 * Columns are dependency depth: a spec sits one column right of the specs it builds on, profiles
 * or replaces. Rows are lanes, one per publishing body in BODY_ORDER. Inside a lane, the specs of
 * one column stack top to bottom in `compareSpecs` order.
 */

export const NODE_W = 200;
export const NODE_H = 68;
export const COL_GAP = 84;
export const ROW_GAP = 14;
export const LANE_GAP = 26;
export const LANE_LABEL_W = 120;
export const PAD = 16;

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
  /** SVG path data for a cubic curve from `from` to `to`. */
  d: string;
  /** Point halfway along the curve, for a label or title anchor. */
  mid: Point;
}

export interface Lane {
  body: SpecBody;
  y: number;
  height: number;
}

export interface Layout {
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  lanes: Lane[];
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

export function layoutGraph(specs: Spec[], relations: Relation[]): Layout {
  const sorted = [...specs].sort(compareSpecs);
  const depth = dependencyDepths(sorted, relations);
  const columns = sorted.reduce((max, s) => Math.max(max, (depth.get(s.id) ?? 0) + 1), 0);

  const placed = new Map<string, PlacedNode>();
  const nodes: PlacedNode[] = [];
  const lanes: Lane[] = [];
  let y = PAD;
  for (const body of BODY_ORDER) {
    const inLane = sorted.filter((s) => s.body === body);
    if (inLane.length === 0) continue;
    const perColumn = new Map<number, Spec[]>();
    for (const spec of inLane) {
      const d = depth.get(spec.id) ?? 0;
      const list = perColumn.get(d) ?? [];
      list.push(spec);
      perColumn.set(d, list);
    }
    const rows = Math.max(...[...perColumn.values()].map((l) => l.length));
    const height = rows * NODE_H + (rows - 1) * ROW_GAP;
    lanes.push({ body, y, height });
    for (const [d, list] of perColumn) {
      list.forEach((spec, i) => {
        const node: PlacedNode = {
          spec,
          x: PAD + LANE_LABEL_W + d * (NODE_W + COL_GAP),
          y: y + i * (NODE_H + ROW_GAP),
          w: NODE_W,
          h: NODE_H,
          depth: d,
        };
        placed.set(spec.id, node);
        nodes.push(node);
      });
    }
    y += height + LANE_GAP;
  }
  const height = y - LANE_GAP + PAD;
  const width = PAD + LANE_LABEL_W + columns * NODE_W + Math.max(0, columns - 1) * COL_GAP + PAD;

  const edges: PlacedEdge[] = [];
  for (const relation of relations) {
    const from = placed.get(relation.from);
    const to = placed.get(relation.to);
    if (!from || !to) continue;
    edges.push({ relation, from, to, symmetric: isSymmetric(relation.type), ...route(from, to) });
  }
  nodes.sort((a, b) => compareSpecs(a.spec, b.spec));
  return { nodes, edges, lanes, columns, width, height };
}

/** Stacked layout (phones): one column, a header row per lane, relations as arcs on the right. */
export const STACK_W = 360;
export const STACK_NODE_W = 236;
export const STACK_LANE_HEAD = 30;

/**
 * The same map for a narrow screen: an arc diagram. Lanes stack top to bottom in BODY_ORDER with
 * their label above them; inside a lane, specs run in dependency depth, then `compareSpecs`
 * order, so a builds-on chain reads downwards. Every relation leaves and joins a node's right
 * edge and bows out by its length, so short arcs nest inside long ones.
 */
export function layoutStacked(specs: Spec[], relations: Relation[]): Layout {
  const sorted = [...specs].sort(compareSpecs);
  const depth = dependencyDepths(sorted, relations);
  const placed = new Map<string, PlacedNode>();
  const nodes: PlacedNode[] = [];
  const lanes: Lane[] = [];
  let y = PAD;
  for (const body of BODY_ORDER) {
    const inLane = sorted
      .filter((s) => s.body === body)
      .sort((a, b) => (depth.get(a.id) ?? 0) - (depth.get(b.id) ?? 0) || compareSpecs(a, b));
    if (inLane.length === 0) continue;
    const height = STACK_LANE_HEAD + inLane.length * NODE_H + (inLane.length - 1) * ROW_GAP;
    lanes.push({ body, y, height });
    inLane.forEach((spec, i) => {
      const node: PlacedNode = {
        spec,
        x: PAD,
        y: y + STACK_LANE_HEAD + i * (NODE_H + ROW_GAP),
        w: STACK_NODE_W,
        h: NODE_H,
        depth: depth.get(spec.id) ?? 0,
      };
      placed.set(spec.id, node);
      nodes.push(node);
    });
    y += height + LANE_GAP;
  }
  const height = y - LANE_GAP + PAD;
  const room = STACK_W - PAD - STACK_NODE_W - 8;
  const span = Math.max(1, height - 2 * PAD);

  const edges: PlacedEdge[] = [];
  for (const relation of relations) {
    const from = placed.get(relation.from);
    const to = placed.get(relation.to);
    if (!from || !to) continue;
    const down = to.y > from.y;
    const p0 = { x: from.x + from.w, y: from.y + from.h / 2 + (down ? 10 : -10) };
    const p3 = { x: to.x + to.w, y: to.y + to.h / 2 + (down ? -10 : 10) };
    // a cubic's bulge is 3/4 of its control offset: scale so the longest arc fills the room
    const bow = (4 / 3) * (12 + (room - 12) * Math.sqrt(Math.abs(p3.y - p0.y) / span));
    const p1 = { x: p0.x + bow, y: p0.y };
    const p2 = { x: p3.x + bow, y: p3.y };
    const d = `M${round(p0.x)},${round(p0.y)} C${round(p1.x)},${round(p1.y)} ${round(p2.x)},${round(p2.y)} ${round(p3.x)},${round(p3.y)}`;
    const m = bezier(p0, p1, p2, p3, 0.5);
    edges.push({
      relation,
      from,
      to,
      symmetric: isSymmetric(relation.type),
      d,
      mid: { x: round(m.x), y: round(m.y) },
    });
  }
  nodes.sort((a, b) => compareSpecs(a.spec, b.spec));
  return { nodes, edges, lanes, columns: 1, width: STACK_W, height };
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
