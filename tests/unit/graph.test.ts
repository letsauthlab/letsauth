import { describe, expect, it } from "vitest";
import {
  COL_GAP,
  dependencyDepths,
  LANE_LABEL_W,
  layoutGraph,
  layoutStacked,
  NODE_W,
  PAD,
  STACK_W,
  wrapLabel,
} from "@/lib/graph";
import type { Relation, Spec } from "@/schema";

function spec(id: string, body: Spec["body"], date = "2020-01-01"): Spec {
  return {
    id,
    name: id,
    body,
    family: "protocol",
    maturity: "published",
    summary: "s",
    url: `https://example.org/${id}`,
    revisions: [{ id: "v", date, status: "current", url: `https://example.org/${id}/v` }],
  };
}

const specs = [
  spec("oauth", "ietf-oauth", "2012-01-01"),
  spec("pkce", "ietf-oauth", "2015-01-01"),
  spec("oidc", "openid", "2014-01-01"),
  spec("mcp", "mcp", "2025-01-01"),
  spec("a2a", "a2a", "2025-06-01"),
  spec("island", "vendor"),
];

const relations: Relation[] = [
  { from: "pkce", to: "oauth", type: "builds-on" },
  { from: "oidc", to: "oauth", type: "builds-on" },
  { from: "mcp", to: "pkce", type: "builds-on" },
  { from: "mcp", to: "oidc", type: "profiles" },
  { from: "a2a", to: "mcp", type: "competes-with", note: "n" },
  { from: "oauth", to: "mcp", type: "references" },
];

describe("dependencyDepths", () => {
  it("is the longest dependency path from a root", () => {
    const depth = dependencyDepths(specs, relations);
    expect(depth.get("oauth")).toBe(0);
    expect(depth.get("pkce")).toBe(1);
    expect(depth.get("oidc")).toBe(1);
    expect(depth.get("mcp")).toBe(2);
  });

  it("ignores symmetric and reference edges", () => {
    const depth = dependencyDepths(specs, relations);
    expect(depth.get("a2a")).toBe(0);
    expect(depth.get("island")).toBe(0);
  });

  it("does not loop on a cycle", () => {
    const depth = dependencyDepths(specs, [
      { from: "pkce", to: "oauth", type: "builds-on" },
      { from: "oauth", to: "pkce", type: "builds-on" },
    ]);
    expect([...depth.values()].every((d) => Number.isFinite(d))).toBe(true);
  });
});

describe("layoutGraph", () => {
  const layout = layoutGraph(specs, relations);
  const node = (id: string) => {
    const n = layout.nodes.find((p) => p.spec.id === id);
    if (!n) throw new Error(`node ${id} not placed`);
    return n;
  };

  it("places every spec once, including isolated ones", () => {
    expect(layout.nodes.map((n) => n.spec.id).sort()).toEqual(specs.map((s) => s.id).sort());
  });

  it("puts a spec one column right of what it builds on", () => {
    const col = (id: string) => (node(id).x - PAD - LANE_LABEL_W) / (NODE_W + COL_GAP);
    expect(col("oauth")).toBe(0);
    expect(col("pkce")).toBe(1);
    expect(col("mcp")).toBe(2);
    expect(layout.columns).toBe(3);
  });

  it("groups nodes into body lanes in BODY_ORDER with no overlap", () => {
    expect(layout.lanes.map((l) => l.body)).toEqual([
      "ietf-oauth",
      "openid",
      "mcp",
      "a2a",
      "vendor",
    ]);
    for (const n of layout.nodes) {
      const lane = layout.lanes.find((l) => l.body === n.spec.body);
      expect(lane).toBeDefined();
      expect(n.y).toBeGreaterThanOrEqual(lane?.y ?? Number.NaN);
      expect(n.y + n.h).toBeLessThanOrEqual((lane?.y ?? 0) + (lane?.height ?? 0));
    }
    for (const a of layout.nodes) {
      for (const b of layout.nodes) {
        if (a === b) continue;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `${a.spec.id} overlaps ${b.spec.id}`).toBe(false);
      }
    }
  });

  it("covers every node with width and height", () => {
    for (const n of layout.nodes) {
      expect(n.x + n.w).toBeLessThanOrEqual(layout.width);
      expect(n.y + n.h).toBeLessThanOrEqual(layout.height);
    }
  });

  it("starts and ends each edge on a node border and marks symmetric ones", () => {
    expect(layout.edges).toHaveLength(relations.length);
    for (const e of layout.edges) {
      const m = e.d.match(/^M([\d.]+),([\d.]+) C.* ([\d.]+),([\d.]+)$/);
      expect(m, e.d).not.toBeNull();
      const [, x0, y0, x3, y3] = m?.map(Number) ?? [];
      const onBorder = (p: { x?: number; y?: number }, n: typeof e.from) =>
        (p.x === n.x || p.x === n.x + n.w) && (p.y ?? -1) >= n.y && (p.y ?? -1) <= n.y + n.h;
      expect(onBorder({ x: x0, y: y0 }, e.from)).toBe(true);
      expect(onBorder({ x: x3, y: y3 }, e.to)).toBe(true);
      expect(e.symmetric).toBe(e.relation.type === "competes-with");
      expect(e.mid.x).toBeGreaterThan(0);
    }
  });

  it("is deterministic", () => {
    const again = layoutGraph([...specs].reverse(), [...relations].reverse());
    expect(JSON.stringify(again.nodes.map((n) => [n.spec.id, n.x, n.y]))).toBe(
      JSON.stringify(layout.nodes.map((n) => [n.spec.id, n.x, n.y])),
    );
  });
});

describe("layoutStacked", () => {
  const layout = layoutStacked(specs, relations);
  const node = (id: string) => {
    const n = layout.nodes.find((p) => p.spec.id === id);
    if (!n) throw new Error(`node ${id} not placed`);
    return n;
  };

  it("places every spec once in one column, lanes in BODY_ORDER", () => {
    expect(layout.nodes.map((n) => n.spec.id).sort()).toEqual(specs.map((s) => s.id).sort());
    expect(new Set(layout.nodes.map((n) => n.x))).toEqual(new Set([PAD]));
    expect(layout.lanes.map((l) => l.body)).toEqual([
      "ietf-oauth",
      "openid",
      "mcp",
      "a2a",
      "vendor",
    ]);
    const ys = layout.nodes.map((n) => n.y);
    expect(new Set(ys).size).toBe(ys.length);
  });

  it("orders a lane by dependency depth, so a builds-on chain reads downwards", () => {
    expect(node("oauth").y).toBeLessThan(node("pkce").y);
  });

  it("keeps every arc inside the drawing's width, on the nodes' right edge", () => {
    expect(layout.width).toBe(STACK_W);
    expect(layout.edges).toHaveLength(relations.length);
    for (const e of layout.edges) {
      const numbers = e.d.match(/[\d.]+/g)?.map(Number) ?? [];
      const xs = numbers.filter((_, i) => i % 2 === 0);
      expect(xs[0]).toBe(e.from.x + e.from.w);
      expect(xs.at(-1)).toBe(e.to.x + e.to.w);
      expect(e.mid.x).toBeLessThan(STACK_W - PAD / 2);
    }
  });
});

describe("wrapLabel", () => {
  it("wraps on word boundaries and truncates with an ellipsis", () => {
    expect(wrapLabel("OAuth 2.0 Token Exchange", 14)).toEqual(["OAuth 2.0", "Token Exchange"]);
    expect(wrapLabel("The OAuth 2.0 Authorization Framework", 14)).toEqual([
      "The OAuth 2.0",
      "Authorization…",
    ]);
    expect(wrapLabel("PKCE", 14)).toEqual(["PKCE"]);
  });
});
