import { describe, expect, it } from "vitest";
import { PLATE_HEIGHT, PLATE_HUES, PLATE_WIDTH, plate, plateSvg } from "@/lib/plate";

describe("plate", () => {
  it("draws the same plate for the same page", () => {
    expect(plateSvg(plate("rfc8693", "OAuth 2.0 Token Exchange"))).toBe(
      plateSvg(plate("rfc8693", "OAuth 2.0 Token Exchange")),
    );
    expect(plateSvg(plate("explorer", "Delegation chains"))).toMatchSnapshot();
  });

  it("draws different plates for different pages", () => {
    const drawings = new Set(
      ["explorer", "breaches", "rfc8693", "rfc9728", "aauth", "transaction-tokens"].map((id) =>
        plateSvg(plate(id, id)),
      ),
    );
    expect(drawings.size).toBe(6);
  });

  it("keeps every plate in bounds, connected and small", () => {
    for (let i = 0; i < 300; i++) {
      const p = plate(`page-${i}`, `Title ${i}`);
      expect(p.hue).toBeGreaterThanOrEqual(0);
      expect(p.hue).toBeLessThan(PLATE_HUES);
      expect(p.path.length).toBeGreaterThanOrEqual(3);
      expect(p.path.length).toBeLessThanOrEqual(5);
      for (const n of p.nodes) {
        expect(n.x).toBeGreaterThan(0);
        expect(n.x).toBeLessThan(PLATE_WIDTH);
        expect(n.y).toBeGreaterThan(0);
        expect(n.y).toBeLessThan(PLATE_HEIGHT);
      }
      // the path runs along existing links
      for (let k = 1; k < p.path.length; k++) {
        expect(p.links).toContainEqual([p.path[k - 1], p.path[k]]);
      }
      // every node is reached by or leaves on a link
      const linked = new Set(p.links.flat());
      expect(linked.size).toBe(p.nodes.length);
      const { boundary: b } = p;
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(PLATE_HEIGHT);
      expect(Buffer.byteLength(plateSvg(p))).toBeLessThan(4096);
    }
  });

  it("is hidden from assistive technology and carries no colour", () => {
    const svg = plateSvg(plate("breaches", "Agent auth failures"));
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).not.toMatch(/fill=|stroke=|oklch|#[0-9a-f]{3}/i);
  });
});
