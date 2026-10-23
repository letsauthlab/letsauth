import { beforeAll, describe, expect, it } from "vitest";
import {
  buildForest,
  dependencyDepths,
  type Layout,
  layoutGraph,
  type TreeNode,
  wrapLabel,
} from "@/lib/graph";
import { BODY_ORDER } from "@/lib/standards";
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
  let layout: Layout;
  beforeAll(async () => {
    layout = await layoutGraph(specs, relations);
  });
  const node = (id: string) => {
    const n = layout.nodes.find((p) => p.spec.id === id);
    if (!n) throw new Error(`node ${id} not placed`);
    return n;
  };

  it("places every spec once, including isolated ones", () => {
    expect(layout.nodes.map((n) => n.spec.id).sort()).toEqual(specs.map((s) => s.id).sort());
  });

  it("puts a spec in a column right of what it builds on", () => {
    expect(node("pkce").x).toBeGreaterThan(node("oauth").x);
    expect(node("oidc").x).toBeGreaterThan(node("oauth").x);
    expect(node("mcp").x).toBeGreaterThan(node("pkce").x);
    expect(node("mcp").x).toBeGreaterThan(node("oidc").x);
    // families without a dependency between them pack beside or under the largest one
    expect(layout.columns).toBeGreaterThanOrEqual(3);
  });

  it("groups each column by body in BODY_ORDER, behind one band per run, with no overlap", () => {
    for (const band of layout.bands) {
      const inside = layout.nodes.filter(
        (n) =>
          n.x >= band.x &&
          n.x + n.w <= band.x + band.width &&
          n.y >= band.y &&
          n.y + n.h <= band.y + band.height,
      );
      expect(inside.length).toBeGreaterThan(0);
      for (const n of inside) expect(n.spec.body).toBe(band.body);
    }
    const columns = new Set(layout.nodes.map((n) => n.x));
    for (const x of columns) {
      const column = layout.nodes.filter((n) => n.x === x).sort((a, b) => a.y - b.y);
      const order = column.map((n) => BODY_ORDER.indexOf(n.spec.body));
      expect(order).toEqual([...order].sort((a, b) => a - b));
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
      const numbers = e.d.match(/[\d.]+/g)?.map(Number) ?? [];
      const [x0, y0] = numbers;
      const x3 = numbers[numbers.length - 2];
      const y3 = numbers[numbers.length - 1];
      const onBorder = (p: { x?: number; y?: number }, n: typeof e.from) =>
        ((p.x === n.x || p.x === n.x + n.w) && (p.y ?? -1) >= n.y && (p.y ?? -1) <= n.y + n.h) ||
        ((p.y === n.y || p.y === n.y + n.h) && (p.x ?? -1) >= n.x && (p.x ?? -1) <= n.x + n.w);
      expect(onBorder({ x: x0, y: y0 }, e.from), e.d).toBe(true);
      expect(onBorder({ x: x3, y: y3 }, e.to), e.d).toBe(true);
      expect(e.symmetric).toBe(e.relation.type === "competes-with");
      expect(e.mid.x).toBeGreaterThan(0);
    }
  });

  it("routes dependencies as polylines and cross links as curves", () => {
    const dep = layout.edges.find((e) => e.relation.type === "builds-on");
    const ref = layout.edges.find((e) => e.relation.type === "references");
    expect(dep?.d).toMatch(/^M[\d.]+,[\d.]+( L[\d.]+,[\d.]+)+$/);
    expect(ref?.d).toContain(" C");
  });

  it("is deterministic", async () => {
    const again = await layoutGraph([...specs].reverse(), [...relations].reverse());
    expect(JSON.stringify(again.nodes.map((n) => [n.spec.id, n.x, n.y]))).toBe(
      JSON.stringify(layout.nodes.map((n) => [n.spec.id, n.x, n.y])),
    );
  });
});

describe("buildForest", () => {
  const forest = buildForest(specs, relations);
  const flat = (nodes: TreeNode[]): TreeNode[] => nodes.flatMap((n) => [n, ...flat(n.children)]);
  const all = flat(forest.trees);
  const find = (id: string) => {
    const n = all.find((t) => t.spec.id === id);
    if (!n) throw new Error(`${id} not in the forest`);
    return n;
  };

  it("roots the trees at specs that nothing builds on, and lists the rest once", () => {
    expect(forest.trees.map((t) => t.spec.id)).toEqual(["oauth"]);
    expect(forest.standalone.map((s) => s.id)).toEqual(["a2a", "island"]);
    expect(all.map((n) => n.spec.id).sort()).toEqual(["mcp", "oauth", "oidc", "pkce"]);
  });

  it("nests a spec under its deepest parent and names the others", () => {
    expect(find("pkce").depth).toBe(1);
    expect(find("pkce").parentType).toBe("builds-on");
    const mcp = find("mcp");
    expect(mcp.depth).toBe(2);
    expect(find("pkce").children.map((c) => c.spec.id)).toContain("mcp");
    expect(mcp.alsoParents.map((p) => [p.spec.id, p.type])).toEqual([["oidc", "profiles"]]);
  });

  it("ignores cross links for the shape", () => {
    expect(all.some((n) => n.spec.id === "a2a")).toBe(false);
    expect(find("mcp").children).toEqual([]);
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
