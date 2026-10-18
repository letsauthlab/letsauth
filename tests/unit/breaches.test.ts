import { describe, expect, it } from "vitest";
import { breachList, buildBreachesExport, missingControls, replayOf } from "@/lib/breaches";
import { type Dataset, getDataset } from "@/lib/data";
import type { Vulnerability } from "@/schema";
import { vulnerabilitySchema } from "@/schema";

const data = getDataset();

const entry: Vulnerability = {
  id: "demo-breach",
  title: "Demo",
  class: "other",
  summary: "A demo entry.",
  disclosed: "2025-01-02",
  affects: ["demo"],
  features: ["mcp.rs.no-passthrough", "mcp.client.pkce"],
  sources: ["https://example.org/advisory"],
};

describe("vulnerability schema (FR-001)", () => {
  it("requires a summary, a disclosure date and at least one source", () => {
    expect(vulnerabilitySchema.safeParse(entry).success).toBe(true);
    const { summary: _s, ...noSummary } = entry;
    expect(vulnerabilitySchema.safeParse(noSummary).success).toBe(false);
    expect(vulnerabilitySchema.safeParse({ ...entry, disclosed: "yesterday" }).success).toBe(false);
    expect(vulnerabilitySchema.safeParse({ ...entry, sources: [] }).success).toBe(false);
    expect(vulnerabilitySchema.safeParse({ ...entry, affects: [] }).success).toBe(false);
  });
});

describe("breachList (FR-002)", () => {
  it("orders newest disclosure first, then by id", () => {
    const set: Dataset = {
      ...data,
      vulnerabilities: [
        { ...entry, id: "b-older", disclosed: "2024-05-01" },
        { ...entry, id: "z-same-day", disclosed: "2025-01-02" },
        { ...entry, id: "a-same-day", disclosed: "2025-01-02" },
      ],
    };
    expect(breachList(set).map((b) => b.vulnerability.id)).toEqual([
      "a-same-day",
      "z-same-day",
      "b-older",
    ]);
  });

  it("resolves the named features and drops nothing silently on the real data", () => {
    for (const b of breachList(data)) {
      expect(b.features.map((f) => f.id)).toEqual(b.vulnerability.features);
    }
  });
});

describe("replayOf (FR-003, data model rule 8)", () => {
  it("is undefined without a scenario", () => {
    expect(replayOf(data, entry)).toBeUndefined();
  });

  it("finds the toggle that names the vulnerability back, for every entry with a scenario", () => {
    const withScenario = data.vulnerabilities.filter((v) => v.scenario);
    expect(withScenario.length).toBeGreaterThan(0);
    for (const v of withScenario) {
      const replay = replayOf(data, v);
      expect(replay?.scenario.id).toBe(v.scenario);
      expect(replay?.toggle.vulnerability).toBe(v.id);
    }
  });
});

describe("missingControls (FR-004)", () => {
  it("reports atlas counts for server-side requirements and a reason for client ones", () => {
    const controls = missingControls(data, entry);
    expect(controls.map((c) => c.feature.id)).toEqual(entry.features);
    const [server, client] = controls;
    expect(server?.observed).toBe(true);
    expect(client?.observed).toBe(false);
    if (client && !client.observed) expect(client.reason).toMatch(/client requirement/);
  });

  it("is empty when the entry names no feature", () => {
    expect(missingControls(data, { ...entry, features: [] })).toEqual([]);
  });
});

describe("buildBreachesExport (FR-006)", () => {
  it("carries every entry in list order with its replay path or null", () => {
    const out = buildBreachesExport(data, "2026-01-01T00:00:00Z");
    expect(out.version).toBe(1);
    expect(out.generatedAt).toBe("2026-01-01T00:00:00Z");
    expect(out.license).toBe("CC BY 4.0");
    expect(out.vulnerabilities.map((v) => v.id)).toEqual(
      breachList(data).map((b) => b.vulnerability.id),
    );
    for (const v of out.vulnerabilities) {
      const replay = replayOf(data, v);
      expect(v.replay).toBe(replay ? `/explorer/${replay.scenario.id}/${replay.toggle.id}/` : null);
    }
  });
});
