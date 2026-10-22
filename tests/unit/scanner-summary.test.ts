import { describe, expect, it } from "vitest";
import { SUMMARY_RULE, summarize } from "@/scanner/summary";
import type { FeatureLevel, ObservationStatus } from "@/schema";

const STATUSES: ObservationStatus[] = [
  "supported",
  "partial",
  "unsupported",
  "unknown",
  "not-applicable",
];

const wellKnown = { feature: "mcp.prm.well-known", name: "PRM well-known", level: "MUST" as const };
const header = { feature: "mcp.prm.www-authenticate", name: "PRM header", level: "MUST" as const };

describe("scan summary (017 FR-001, FR-002)", () => {
  for (const must of STATUSES) {
    for (const should of STATUSES) {
      it(`MUST ${must}, SHOULD ${should}: one count per level, nothing else`, () => {
        const s = summarize([
          { name: "m", level: "MUST", status: must },
          { name: "s", level: "SHOULD", status: should },
          { name: "y", level: "MAY", status: "unsupported" },
          { name: "d", level: "DEPRECATED", status: "supported" },
        ]);
        expect(s.state).toBe("scanned");
        expect(s.tallies.map((t) => t.level)).toEqual(["MUST", "SHOULD", "MAY", "DEPRECATED"]);
        expect(s.tallies[0]?.counts).toEqual([{ status: must, n: 1 }]);
        expect(s.tallies[1]?.counts).toEqual([{ status: should, n: 1 }]);
        // no letter, score or verdict on the summary
        expect(Object.keys(s).sort()).toEqual(["label", "notes", "open", "state", "tallies"]);
      });
    }
  }

  it("counts per level in status order and says so in words", () => {
    const s = summarize([
      { name: "a", level: "MUST", status: "unsupported" },
      { name: "b", level: "MUST", status: "supported" },
      { name: "c", level: "MUST", status: "supported" },
      { name: "d", level: "SHOULD", status: "unknown" },
      { name: "e", level: "SHOULD", status: "partial" },
    ]);
    expect(s.tallies[0]).toEqual({
      level: "MUST",
      total: 3,
      counts: [
        { status: "supported", n: 2 },
        { status: "unsupported", n: 1 },
      ],
    });
    expect(s.label).toBe("MUST 2 supported, 1 unsupported · SHOULD 1 partial, 1 unknown");
  });

  it("lists the checks that are not supported, by name, at every level", () => {
    const s = summarize([
      { name: "PRM served", level: "MUST", status: "supported" },
      { name: "CIMD", level: "SHOULD", status: "unsupported" },
      { name: "iss", level: "SHOULD", status: "unknown" },
      { name: "na", level: "SHOULD", status: "not-applicable" },
      { name: "scopes", level: "MAY", status: "unsupported" },
    ]);
    expect(s.open.map((c) => `${c.name} ${c.status}`)).toEqual([
      "CIMD unsupported",
      "iss unknown",
      "scopes unsupported",
    ]);
  });

  it("counts unknown as unknown, never as unsupported", () => {
    const s = summarize([{ name: "a", level: "MUST", status: "unknown" }]);
    expect(s.tallies[0]?.counts).toEqual([{ status: "unknown", n: 1 }]);
  });

  it("treats the two discovery mechanisms as alternatives in both directions (008 FR-005)", () => {
    const statuses = ["supported", "unsupported", "unknown"] as const;
    const expected = (a: string, b: string): string => {
      if (a === "supported" || b === "supported") return "supported";
      if (a === "unknown" || b === "unknown") return "unknown";
      return "unsupported";
    };
    for (const a of statuses) {
      for (const b of statuses) {
        const s = summarize([
          { ...wellKnown, status: a },
          { ...header, status: b },
        ]);
        const want = expected(a, b);
        // when one way decides, both count with the same status
        if (want !== "unknown" || (a !== "supported" && b !== "supported")) {
          expect(
            s.tallies[0]?.counts.map((c) => c.status),
            `${a} / ${b}`,
          ).toContain(want);
        }
        expect(
          s.tallies[0]?.counts.some((c) => c.status === "unsupported"),
          `${a} / ${b}`,
        ).toBe(want === "unsupported");
      }
    }
    // a challenge without a pointer next to a well-known document is not a failure, and the
    // summary says why the row and the count differ
    const s = summarize([
      { ...wellKnown, status: "supported" },
      { ...header, status: "unsupported" },
    ]);
    expect(s.tallies[0]?.counts).toEqual([{ status: "supported", n: 2 }]);
    expect(s.open).toEqual([]);
    expect(s.notes).toHaveLength(1);
    expect(s.notes[0]).toContain("PRM header counts as supported");
  });

  it("does not fail one discovery mechanism while the other is unknown or absent", () => {
    const s = summarize([{ ...wellKnown, status: "unsupported" }]);
    expect(s.tallies[0]?.counts).toEqual([{ status: "unknown", n: 1 }]);
    expect(s.notes[0]).toContain("counts as unknown");
  });

  it("publishes its rule lines, which name every level and rule out a score", () => {
    const text = SUMMARY_RULE.join(" ");
    const levels: FeatureLevel[] = ["MUST", "SHOULD", "MAY"];
    for (const l of levels) expect(text).toContain(l);
    expect(text).toContain("no grade and no score");
  });
});
