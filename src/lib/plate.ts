/**
 * The decorative plate (specs/016-visual-redesign plan, WP8): a small label-free delegation chain
 * in the explorer's own vocabulary, derived from a page's id and title so that the same page
 * always gets the same drawing and two pages rarely share one. Three to five actors as heads on
 * lifelines, four to six messages between them, one of which chain is the highlighted path, and
 * one dashed trust boundary around one or two lifelines. Pure: no randomness, no clock, no DOM.
 */

export const PLATE_WIDTH = 320;
export const PLATE_HEIGHT = 200;

const PAD_X = 28;
const HEAD_Y = 6;
const HEAD_W = 34;
const HEAD_H = 12;
const FIRST_ROW = 46;
const LAST_ROW = PLATE_HEIGHT - 18;

export interface PlateMessage {
  from: number;
  to: number;
  y: number;
  /** On the highlighted path. */
  path: boolean;
}

export interface Plate {
  /** The x of each lifeline, left to right. */
  lanes: number[];
  messages: PlateMessage[];
  /** The dashed trust boundary, a rounded rectangle around one or two lifelines. */
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
  const pick = random(hash(`${id}\n${title}`));
  const laneCount = 3 + pick(3);
  const step = (PLATE_WIDTH - 2 * PAD_X) / (laneCount - 1);
  const lanes = Array.from({ length: laneCount }, (_, i) => Math.round(PAD_X + i * step));

  // The path is a chain of messages, each sent by the lane the previous one reached, so it reads
  // as authority handed on. Two or three quieter messages sit between its steps.
  const rowCount = 4 + pick(3);
  const gap = (LAST_ROW - FIRST_ROW) / (rowCount - 1);
  const pathRows = new Set<number>([0, rowCount - 1]);
  while (pathRows.size < Math.min(rowCount - 2, 3 + pick(2))) pathRows.add(1 + pick(rowCount - 2));
  const other = (lane: number) => {
    const next = pick(laneCount - 1);
    return next >= lane ? next + 1 : next;
  };
  const messages: PlateMessage[] = [];
  let at = pick(laneCount);
  for (let r = 0; r < rowCount; r++) {
    const y = Math.round(FIRST_ROW + r * gap);
    if (pathRows.has(r)) {
      const to = other(at);
      messages.push({ from: at, to, y, path: true });
      at = to;
    } else {
      const from = pick(laneCount);
      messages.push({ from, to: other(from), y, path: false });
    }
  }

  const span = laneCount > 3 && pick(2) === 0 ? 2 : 1;
  const first = pick(laneCount - span + 1);
  const left = lanes[first] as number;
  const right = lanes[first + span - 1] as number;
  const boundary = {
    x: left - HEAD_W / 2 - 6,
    y: HEAD_Y - 4,
    width: right - left + HEAD_W + 12,
    height: PLATE_HEIGHT - HEAD_Y,
  };

  return { lanes, messages, boundary };
}

/**
 * The drawing as SVG markup. Classes, not colours: `.pb` boundary, `.pa` actor heads, `.pl`
 * lifelines, `.pm` quiet messages, `.ph` the halo under the path, `.pp` the highlighted path
 * (`pathLength` 1, for the draw-in), `.po` its ends. The page or the social card generator styles them with tokens.
 */
export function plateSvg(p: Plate): string {
  const lane = (i: number) => p.lanes[i] as number;
  const arrow = (m: PlateMessage) => {
    const dir = m.to > m.from ? 1 : -1;
    const x = lane(m.to) - dir * 4;
    return `M${lane(m.from)} ${m.y}H${x}M${x - dir * 5} ${m.y - 3}L${x} ${m.y}L${x - dir * 5} ${m.y + 3}`;
  };
  const route = p.messages
    .filter((m) => m.path)
    .map((m, k) => `${k === 0 ? "M" : "V"}${k === 0 ? `${lane(m.from)} ` : ""}${m.y}H${lane(m.to)}`)
    .join("");
  const ends = p.messages
    .filter((m) => m.path)
    .map((m) => `<circle cx="${lane(m.to)}" cy="${m.y}" r="3"/>`)
    .join("");
  const heads = p.lanes
    .map(
      (x) =>
        `<rect x="${x - HEAD_W / 2}" y="${HEAD_Y}" width="${HEAD_W}" height="${HEAD_H}" rx="4"/>`,
    )
    .join("");
  const lifelines = p.lanes.map((x) => `M${x} ${HEAD_Y + HEAD_H}V${PLATE_HEIGHT}`).join("");
  const quiet = p.messages
    .filter((m) => !m.path)
    .map(arrow)
    .join("");
  const { x, y, width, height } = p.boundary;
  return (
    `<svg viewBox="0 0 ${PLATE_WIDTH} ${PLATE_HEIGHT}" aria-hidden="true" focusable="false">` +
    `<rect class="pb" x="${x}" y="${y}" width="${width}" height="${height}" rx="10"/>` +
    `<path class="pl" d="${lifelines}"/>` +
    `<g class="pa">${heads}</g>` +
    `<path class="pm" d="${quiet}"/>` +
    `<path class="ph" pathLength="1" d="${route}"/>` +
    `<path class="pp" pathLength="1" d="${route}"/>` +
    `<g class="po">${ends}</g></svg>`
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
