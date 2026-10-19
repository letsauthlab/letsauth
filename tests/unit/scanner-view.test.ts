import { describe, expect, it } from "vitest";
import { currentRevision } from "@/lib/atlas";
import { type Dataset, getDataset } from "@/lib/data";
import {
  latestScan,
  passiveChecks,
  reportFromView,
  scannerFacts,
  scannerIndex,
  unscannedFeatures,
} from "@/lib/scanner";
import { OBSERVER, SCANNER_ID } from "@/scanner/version";
import type { Observation } from "@/schema";

const base = getDataset();
const revision = currentRevision(base).id;
const server = base.servers.find((s) => !s.withdrawn && s.transport !== "stdio-only");
if (!server) throw new Error("no server");
const checks = passiveChecks(base);

function obs(
  feature: string,
  status: Observation["status"],
  extra: Partial<Observation> = {},
): Observation {
  return {
    server: server?.id ?? "",
    feature,
    revision: { spec: "mcp-authorization", revision },
    status,
    method: "passive-scan",
    observedAt: "2026-10-15T03:17:04Z",
    observedBy: OBSERVER,
    evidence: `https://example.com/.well-known/x — HTTP 200; ${feature}`,
    ...extra,
  };
}

function withObservations(observations: Observation[]): Dataset {
  return { ...base, observations, locations: undefined };
}

describe("passiveChecks", () => {
  it("returns the fourteen passive server-party features, MCP server party first", () => {
    expect(checks).toHaveLength(14);
    const parties = checks.map((c) => c.feature.party);
    expect(parties.indexOf("authorization-server")).toBe(parties.lastIndexOf("mcp-server") + 1);
    for (const c of checks) expect(c.entry.level).toBeDefined();
  });

  it("unscannedFeatures lists the active and manual server-party requirements", () => {
    const ids = unscannedFeatures(base).map((f) => f.id);
    expect(ids).toContain("mcp.rs.401-on-invalid");
    expect(ids).toContain("mcp.proxy.consent");
    expect(ids).not.toContain("mcp.prm");
    expect(ids.every((id) => !id.startsWith("mcp.client."))).toBe(true);
  });
});

describe("latestScan (FR-007)", () => {
  it("reports a server without scanner observations as not scanned, with no grade", () => {
    const v = latestScan(withObservations([]), server);
    expect(v.scanned).toBe(false);
    expect(v.scannedAt).toBeUndefined();
    expect(v.grade).toEqual({ letter: null, label: "Not scanned", reasons: [] });
    expect(v.checks.every((c) => c.status === "unknown" && c.observedAt === undefined)).toBe(true);
  });

  it("does not grade a server whose auth class is api-key or none, even with scanner observations (009 FR-005)", () => {
    const statement = {
      method: "manual" as const,
      evidence: "https://example.com/docs — a pasted key",
      observedAt: "2026-10-17T00:00:00Z",
      observedBy: "tester",
    };
    const all = withObservations(checks.map((c) => obs(c.feature.id, "unsupported")));
    const keyed = latestScan(all, { ...server, auth: { ...statement, class: "api-key" as const } });
    expect(keyed.grade.letter).toBeNull();
    expect(keyed.grade.label).toBe("No OAuth");
    expect(keyed.grade.reasons[0]).toContain("API key");
    const open = latestScan(all, { ...server, auth: { ...statement, class: "none" as const } });
    expect(open.grade.label).toBe("No OAuth");
    expect(open.grade.reasons[0]).toContain("no authentication");
  });

  it("grades a missing or unknown class like OAuth (009 SC-003)", () => {
    const all = withObservations(checks.map((c) => obs(c.feature.id, "unsupported")));
    const missing = latestScan(all, { ...server, auth: undefined });
    expect(missing.grade.letter).toBe("F");
    const unknown = latestScan(all, {
      ...server,
      auth: {
        class: "unknown" as const,
        method: "manual" as const,
        evidence: "https://example.com — page says nothing",
        observedAt: "2026-10-17T00:00:00Z",
        observedBy: "tester",
      },
    });
    expect(unknown.grade.letter).toBe("F");
  });

  it("ignores manual and documentation observations", () => {
    const data = withObservations([
      obs("mcp.prm", "supported", { method: "vendor-claim", observedBy: "jbspeakr" }),
      obs("mcp.as.cimd", "supported", { method: "manual", observedBy: "jbspeakr" }),
    ]);
    const v = latestScan(data, server);
    expect(v.scanned).toBe(false);
  });

  it("takes the newest scanner observation per check and grades the statuses", () => {
    const all = checks.map((c) =>
      obs(c.feature.id, c.feature.id === "mcp.as.dcr" ? "unsupported" : "supported"),
    );
    const older = obs("mcp.as.cimd", "unsupported", { observedAt: "2026-10-01T00:00:00Z" });
    const v = latestScan(withObservations([older, ...all]), server);
    expect(v.scanned).toBe(true);
    expect(v.scannedAt).toBe("2026-10-15T03:17:04Z");
    expect(v.checks.find((c) => c.feature === "mcp.as.cimd")?.status).toBe("supported");
    expect(v.grade.letter).toBe("A");
    const newerFail = obs("mcp.as.cimd", "unsupported", { observedAt: "2026-10-20T00:00:00Z" });
    const v2 = latestScan(withObservations([...all, newerFail]), server);
    expect(v2.grade.letter).toBe("C");
    expect(v2.scannedAt).toBe("2026-10-20T00:00:00Z");
  });

  it("withholds the grade when a MUST-level check has no scanner observation", () => {
    const some = checks
      .filter((c) => c.feature.id !== "mcp.prm")
      .map((c) => obs(c.feature.id, "supported"));
    const v = latestScan(withObservations(some), server);
    expect(v.scanned).toBe(true);
    expect(v.grade.letter).toBeNull();
    expect(v.grade.label).toBe("Withheld");
    expect(v.grade.reasons.join(" ")).toContain("Protected Resource Metadata served");
  });
});

describe("scannerIndex (FR-009)", () => {
  it("lists every non-withdrawn server by name, never by grade", () => {
    const views = scannerIndex(withObservations([]));
    const names = views.map((v) => v.server.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(views.some((v) => v.server.withdrawn)).toBe(false);
    expect(views).toHaveLength(base.servers.filter((s) => !s.withdrawn).length);
    expect(scannerFacts(views)).toEqual({ servers: views.length, scanned: 0, newest: undefined });
  });
});

describe("reportFromView", () => {
  it("has the report shape with recorded: true and no requests", () => {
    const all = checks.map((c) => obs(c.feature.id, "supported"));
    const r = reportFromView(latestScan(withObservations(all), server), "2026-10-16T00:00:00Z");
    expect(r).toMatchObject({
      version: 1,
      scanner: SCANNER_ID,
      recorded: true,
      target: { url: server?.url, server: server?.id },
      revision: { spec: "mcp-authorization", revision },
      method: "passive-scan",
      requests: [],
      discovered: null,
      observations: [],
    });
    expect(r.checks).toHaveLength(14);
    expect(r.grade.letter).toBe("A");
  });
});

it("uses timestamp instants for each scanner cell, report date and index date", () => {
  const first = checks[0]?.feature.id ?? "";
  const second = checks[1]?.feature.id ?? "";
  const older = "2026-10-18T11:00:00+02:00";
  const newer = "2026-10-18T10:00:00Z";
  const view = latestScan(
    withObservations([
      obs(first, "unsupported", { observedAt: older }),
      obs(first, "supported", { observedAt: newer }),
      obs(second, "supported", { observedAt: older }),
    ]),
    server,
  );
  expect(view.checks.find((c) => c.feature === first)?.status).toBe("supported");
  expect(view.scannedAt).toBe(newer);
  expect(scannerFacts([{ ...view, scannedAt: older }, view]).newest).toBe(newer);
});
