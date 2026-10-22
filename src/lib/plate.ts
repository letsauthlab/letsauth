/**
 * The decorative plate (specs/016-visual-redesign plan, WP8): a small label-free drawing of a
 * delegation graph, derived from a page's id and title so that the same page always gets the
 * same drawing and two pages rarely share one. Three to five columns of nodes, the links between
 * neighbouring columns, one highlighted path from the first column to the last, one dashed trust
 * boundary around a column or two, and one of eight hues. Pure: no randomness, no clock, no DOM.
 */

export const PLATE_WIDTH = 800;
export const PLATE_HEIGHT = 168;
export const PLATE_HUES = 8;

const PAD_X = 40;
const NODE_GAP = 38;

export interface PlateNode {
  x: number;
  y: number;
  /** On the highlighted path. */
  path: boolean;
}

export interface Plate {
  /** 0 to PLATE_HUES - 1: which `--plate-N` token colours the path. */
  hue: number;
  nodes: PlateNode[];
  /** Pairs of indexes into `nodes`, always from a column to the next one. */
  links: [number, number][];
  /** Indexes into `nodes`, one per column, left to right. */
  path: number[];
  /** The dashed trust boundary, a rounded rectangle. */
  boundary: { x: number; y: number; width: number; height: number };
}

/** FNV-1a, 32 bit. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a small seeded generator, so the drawing depends on the seed alone. */
function random(seed: number): (n: number) => number {
  let a = seed;
  return (n) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
  };
}

export function plate(id: string, title: string): Plate {
  const seed = hash(`${id}\n${title}`);
  const pick = random(seed);
  const hue = seed % PLATE_HUES;
  const columnCount = 3 + pick(3);
  const step = (PLATE_WIDTH - 2 * PAD_X) / (columnCount - 1);

  const nodes: PlateNode[] = [];
  const columns: number[][] = [];
  for (let c = 0; c < columnCount; c++) {
    const count = 2 + pick(3);
    const top = PLATE_HEIGHT / 2 - ((count - 1) * NODE_GAP) / 2;
    const column: number[] = [];
    for (let k = 0; k < count; k++) {
      column.push(nodes.length);
      nodes.push({
        x: Math.round(PAD_X + c * step + pick(17) - 8),
        y: Math.round(top + k * NODE_GAP + pick(13) - 6),
        path: false,
      });
    }
    columns.push(column);
  }

  const path = columns.map((column) => column[pick(column.length)] as number);
  for (const i of path) (nodes[i] as PlateNode).path = true;

  // Each node links to the node at the same height in the next column and, now and then, to one
  // more; every node of the next column gets at least one incoming link; the path's links exist.
  const links = new Map<string, [number, number]>();
  const link = (a: number, b: number) => links.set(`${a}-${b}`, [a, b]);
  for (let c = 0; c + 1 < columnCount; c++) {
    const from = columns[c] as number[];
    const to = columns[c + 1] as number[];
    from.forEach((a, k) => {
      link(a, to[Math.round((k * (to.length - 1)) / Math.max(1, from.length - 1))] as number);
      if (pick(3) === 0) link(a, to[pick(to.length)] as number);
    });
    to.forEach((b, k) => {
      if (![...links.values()].some(([, t]) => t === b)) {
        link(from[Math.round((k * (from.length - 1)) / Math.max(1, to.length - 1))] as number, b);
      }
    });
    link(path[c] as number, path[c + 1] as number);
  }

  // The boundary holds one column, or two neighbours when there are four or five.
  const span = columnCount > 3 && pick(2) === 0 ? 2 : 1;
  const first = pick(columnCount - span + 1);
  const inside = columns.slice(first, first + span).flat();
  const xs = inside.map((i) => (nodes[i] as PlateNode).x);
  const ys = inside.map((i) => (nodes[i] as PlateNode).y);
  const x = Math.min(...xs) - 22;
  const y = Math.max(8, Math.min(...ys) - 20);
  const boundary = {
    x,
    y,
    width: Math.max(...xs) + 22 - x,
    height: Math.min(PLATE_HEIGHT - 8, Math.max(...ys) + 20) - y,
  };

  return { hue, nodes, links: [...links.values()], path, boundary };
}

/** A horizontal S-curve from one node to another. */
function curve(a: PlateNode, b: PlateNode, move = true): string {
  const mid = Math.round((a.x + b.x) / 2);
  return `${move ? `M${a.x} ${a.y}` : ""}C${mid} ${a.y} ${mid} ${b.y} ${b.x} ${b.y}`;
}

/**
 * The drawing as SVG markup. Classes, not colours: `.pb` boundary, `.pl` links, `.ph` the halo
 * under the path, `.pp` the path, `.pn` nodes, `.po` nodes on the path. The page or the social
 * card generator styles them with tokens and sets `--plate` to the hue.
 */
export function plateSvg(p: Plate): string {
  const node = (i: number) => p.nodes[i] as PlateNode;
  const links = p.links.map(([a, b]) => curve(node(a), node(b))).join("");
  const route = p.path
    .slice(1)
    .map((b, k) => curve(node(p.path[k] as number), node(b), k === 0))
    .join("");
  const { x, y, width, height } = p.boundary;
  const circles = p.nodes
    .map((n) => `<circle${n.path ? ' class="po"' : ""} cx="${n.x}" cy="${n.y}" r="5"/>`)
    .join("");
  return (
    `<svg viewBox="0 0 ${PLATE_WIDTH} ${PLATE_HEIGHT}" aria-hidden="true" focusable="false">` +
    `<rect class="pb" x="${x}" y="${y}" width="${width}" height="${height}" rx="12"/>` +
    `<path class="pl" d="${links}"/>` +
    `<path class="ph" pathLength="1" d="${route}"/>` +
    `<path class="pp" pathLength="1" d="${route}"/>` +
    `<g class="pn">${circles}</g></svg>`
  );
}

/**
 * The section roots that carry a plate, with what their social card says. The page and the card
 * generator (`scripts/generate-brand-assets.ts`) seed the drawing from the same id and title, so
 * the card shows the page's drawing.
 */
export const SECTION_PLATES = {
  explorer: { title: "Delegation chains", eyebrow: "Delegation chain explorer" },
  breaches: { title: "Agent auth failures", eyebrow: "Breach anatomy" },
} as const;

/** The social card of a section root, written by `pnpm generate:brand`. */
export const sectionCard = (id: keyof typeof SECTION_PLATES) => `/og-${id}.png`;
