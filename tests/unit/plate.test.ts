import { describe, expect, it } from "vitest";
import { PLATE_HEIGHT, PLATE_WIDTH, plate, plateSvg } from "@/lib/plate";

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

  it("keeps every plate a chain in bounds and small", () => {
    for (let i = 0; i < 300; i++) {
      const p = plate(`page-${i}`, `Title ${i}`);
      expect(p.lanes.length).toBeGreaterThanOrEqual(3);
      expect(p.lanes.length).toBeLessThanOrEqual(5);
      for (const x of p.lanes) {
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThan(PLATE_WIDTH);
      }
      expect(p.messages.length).toBeGreaterThanOrEqual(4);
      for (const m of p.messages) {
        expect(m.from).not.toBe(m.to);
        expect(m.y).toBeGreaterThan(0);
        expect(m.y).toBeLessThan(PLATE_HEIGHT);
      }
      // the path hands on: each message on it starts where the previous one arrived
      const path = p.messages.filter((m) => m.path);
      expect(path.length).toBeGreaterThanOrEqual(2);
      for (let k = 1; k < path.length; k++) expect(path[k]?.from).toBe(path[k - 1]?.to);
      const { boundary: b } = p;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(PLATE_WIDTH);
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
