import { describe, expect, it } from "vitest";
import { cellKey } from "@/lib/atlas";
import {
  changedSince,
  changesByDay,
  missingMostOften,
  scanRunsAfter,
  statusChanges,
} from "@/lib/changes";
import type { Dataset } from "@/lib/data";
import type { Feature, Observation, Server } from "@/schema";

const SPEC = "mcp-authorization";
const REV = "2026-07-28";

const feature = (id: string): Feature => ({
  id,
  name: id,
  description: id,
  category: "registration",
  party: "authorization-server",
  observable: "passive",
  revisions: [{ spec: SPEC, revision: REV, section: "Section", level: "MUST" }],
});

const server = (id: string): Server => ({
  id,
  name: id.toUpperCase(),
  url: `https://${id}.example`,
  transport: "streamable-http",
  listed: "maintainer-added",
  source: "https://example.org/list",
});

const obs = (
  server: string,
  feature: string,
  status: Observation["status"],
  method: Observation["method"],
  observedAt: string,
  revision = REV,
): Observation => ({
  server,
  feature,
  revision: { spec: SPEC, revision },
  status,
  method,
  observedAt,
  observedBy: "test",
  evidence: "https://example.org/evidence",
});

const data: Dataset = {
  relations: [],
  scenarios: [],
  vulnerabilities: [],
  specs: [
    {
      id: SPEC,
      name: "MCP Authorization",
      body: "mcp",
      family: "profile",
      maturity: "published",
      summary: "s",
      url: "https://modelcontextprotocol.io",
      revisions: [{ id: REV, date: REV, status: "current", url: "https://example.org/rev" }],
    },
  ],
  features: [feature("mcp.a"), feature("mcp.b")],
  servers: [server("alpha"), server("beta"), server("gamma")],
  observations: [
    // alpha a: unsupported, unsupported, supported -> one change on 2026-11-02
    obs("alpha", "mcp.a", "unsupported", "passive-scan", "2026-10-16T01:18:00Z"),
    obs("alpha", "mcp.a", "unsupported", "passive-scan", "2026-10-20T01:18:00Z"),
    obs("alpha", "mcp.a", "supported", "passive-scan", "2026-11-02T02:18:00Z"),
    // beta a: same moment, the vendor claim is weaker than the scan, so the scan comes second
    obs("beta", "mcp.a", "supported", "passive-scan", "2026-10-20T01:18:00Z"),
    obs("beta", "mcp.a", "unknown", "vendor-claim", "2026-10-20T01:18:00Z"),
    // beta b: supported -> unsupported -> unsupported
    obs("beta", "mcp.b", "supported", "vendor-claim", "2026-10-14T00:00:00Z"),
    obs("beta", "mcp.b", "unsupported", "passive-scan", "2026-10-20T01:18:00Z"),
    obs("beta", "mcp.b", "unsupported", "passive-scan", "2026-11-05T02:18:00Z"),
    // gamma: one observation, no change; another revision is ignored
    obs("gamma", "mcp.a", "unsupported", "passive-scan", "2026-11-05T02:18:00Z"),
    obs("gamma", "mcp.b", "supported", "passive-scan", "2026-09-01T00:00:00Z", "2025-11-25"),
    obs("gamma", "mcp.b", "unsupported", "passive-scan", "2026-11-10T02:18:00Z", "2025-11-25"),
  ],
};

describe("statusChanges", () => {
  const changes = statusChanges(data, REV);

  it("records each change of status between consecutive observations, newest first", () => {
    expect(changes.map((c) => [c.server, c.feature, c.from, c.to])).toEqual([
      ["alpha", "mcp.a", "unsupported", "supported"],
      ["beta", "mcp.a", "unknown", "supported"],
      ["beta", "mcp.b", "supported", "unsupported"],
    ]);
  });

  it("orders observations at the same moment by method strength", () => {
    const beta = changes.find((c) => c.server === "beta" && c.feature === "mcp.a");
    expect(beta?.observation.method).toBe("passive-scan");
  });

  it("carries the whole cell history, newest first", () => {
    expect(changes[0]?.history.map((o) => o.observedAt.slice(0, 10))).toEqual([
      "2026-11-02",
      "2026-10-20",
      "2026-10-16",
    ]);
  });

  it("groups by day and finds the cells changed since a day", () => {
    expect(changesByDay(changes).map(([day, list]) => [day, list.length])).toEqual([
      ["2026-11-02", 1],
      ["2026-10-20", 2],
    ]);
    expect([...changedSince(changes, "2026-11-01")]).toEqual([cellKey("alpha", "mcp.a")]);
  });
});

describe("scanRunsAfter", () => {
  it("lists the distinct scan runs after a moment, oldest first", () => {
    expect(scanRunsAfter(data, "2026-11-02T02:18:00Z")).toEqual([
      "2026-11-05T02:18",
      "2026-11-10T02:18",
    ]);
  });
});

describe("missingMostOften", () => {
  it("ranks requirements by servers observed unsupported, leaving out those with none", () => {
    expect(missingMostOften(data, REV)).toEqual([
      { feature: "mcp.a", unsupported: 1, of: 3 },
      { feature: "mcp.b", unsupported: 1, of: 3 },
    ]);
  });
});
