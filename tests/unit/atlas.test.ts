import { describe, expect, it } from "vitest";
import {
  cellHistory,
  currentCell,
  featureShare,
  matrixColumns,
  matrixFor,
  matrixRows,
  observationsFor,
  revisionDiff,
} from "@/lib/atlas";
import type { Dataset } from "@/lib/data";
import type { Feature, Observation, Server } from "@/schema";

const SPEC = "mcp-authorization";
const OLD = "2025-11-25";
const NEW = "2026-07-28";

function feature(
  id: string,
  party: Feature["party"],
  levels: Partial<Record<string, Feature["revisions"][number]["level"]>>,
): Feature {
  return {
    id,
    name: id,
    description: id,
    category: "registration",
    party,
    observable: "passive",
    revisions: Object.entries(levels).map(([revision, level]) => ({
      spec: SPEC,
      revision,
      section: "Section",
      level: level ?? "MUST",
    })),
  };
}

function server(
  id: string,
  transport: Server["transport"] = "streamable-http",
  withdrawn = false,
): Server {
  return {
    id,
    name: id.toUpperCase(),
    url: `https://${id}.example`,
    transport,
    listed: "maintainer-added",
    source: "https://example.org/list",
    ...(withdrawn ? { withdrawn: { at: "2026-10-01", reason: "asked" } } : {}),
  };
}

function obs(
  server: string,
  feature: string,
  status: Observation["status"],
  method: Observation["method"],
  observedAt: string,
  revision = NEW,
): Observation {
  return {
    server,
    feature,
    revision: { spec: SPEC, revision },
    status,
    method,
    observedAt,
    observedBy: "test",
    evidence: "https://example.org/evidence",
  };
}

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
      revisions: [
        { id: OLD, date: "2025-11-25", status: "superseded", url: "https://example.org/old" },
        {
          id: NEW,
          date: "2026-07-28",
          status: "current",
          url: "https://example.org/new",
          supersedes: OLD,
        },
      ],
    },
  ],
  features: [
    feature("mcp.as.cimd", "authorization-server", { [OLD]: "SHOULD", [NEW]: "SHOULD" }),
    feature("mcp.as.dcr", "authorization-server", { [OLD]: "SHOULD", [NEW]: "MAY" }),
    feature("mcp.as.iss-param", "authorization-server", { [NEW]: "SHOULD" }),
    feature("mcp.rs.old-only", "mcp-server", { [OLD]: "MAY" }),
    feature("mcp.client.pkce", "client", { [NEW]: "MUST" }),
  ],
  servers: [
    server("alpha"),
    server("beta"),
    server("local", "stdio-only"),
    server("gone", "sse", true),
  ],
  observations: [
    obs("alpha", "mcp.as.cimd", "unsupported", "vendor-claim", "2026-09-01T00:00:00Z"),
    obs("alpha", "mcp.as.cimd", "supported", "passive-scan", "2026-10-01T00:00:00Z"),
    // same timestamp, different methods
    obs("beta", "mcp.as.cimd", "unsupported", "vendor-claim", "2026-10-05T00:00:00Z"),
    obs("beta", "mcp.as.cimd", "supported", "active-scan", "2026-10-05T00:00:00Z"),
    // newer vendor claim beats older scan (newest wins)
    obs("beta", "mcp.as.dcr", "supported", "passive-scan", "2026-09-01T00:00:00Z"),
    obs("beta", "mcp.as.dcr", "unsupported", "vendor-claim", "2026-10-10T00:00:00Z"),
    obs("alpha", "mcp.as.dcr", "partial", "manual", "2026-10-01T00:00:00Z"),
  ],
};

const f = (id: string) => data.features.find((x) => x.id === id) as Feature;
const s = (id: string) => data.servers.find((x) => x.id === id) as Server;

describe("currentCell", () => {
  it("newest observation wins", () => {
    const cell = currentCell(data, s("alpha"), f("mcp.as.cimd"), NEW);
    expect(cell.status).toBe("supported");
    expect(cell.derived).toBe(false);
    expect(cell.observation?.method).toBe("passive-scan");
  });

  it("newest wins even when the newer one has a weaker method", () => {
    const cell = currentCell(data, s("beta"), f("mcp.as.dcr"), NEW);
    expect(cell.status).toBe("unsupported");
    expect(cell.observation?.method).toBe("vendor-claim");
  });

  it("breaks equal timestamps by method strength", () => {
    const cell = currentCell(data, s("beta"), f("mcp.as.cimd"), NEW);
    expect(cell.status).toBe("supported");
    expect(cell.observation?.method).toBe("active-scan");
  });

  it("yields derived unknown when nothing was observed (never unsupported)", () => {
    const cell = currentCell(data, s("alpha"), f("mcp.as.iss-param"), NEW);
    expect(cell).toMatchObject({ status: "unknown", derived: true });
    expect(cell.observation).toBeUndefined();
  });

  it("yields derived not-applicable for stdio-only servers", () => {
    const cell = currentCell(data, s("local"), f("mcp.as.cimd"), NEW);
    expect(cell).toMatchObject({ status: "not-applicable", derived: true });
  });
});

describe("cellHistory", () => {
  it("lists every other observation newest first", () => {
    const history = cellHistory(data, "alpha", "mcp.as.cimd", NEW);
    expect(history.map((o) => o.observedAt)).toEqual(["2026-09-01T00:00:00Z"]);
    const tie = cellHistory(data, "beta", "mcp.as.cimd", NEW);
    expect(tie.map((o) => o.method)).toEqual(["vendor-claim"]);
  });
});

describe("matrix", () => {
  it("columns are the revision's non-client features, by category order then id", () => {
    expect(matrixColumns(data, NEW).map((x) => x.id)).toEqual([
      "mcp.as.cimd",
      "mcp.as.dcr",
      "mcp.as.iss-param",
    ]);
    expect(matrixColumns(data, OLD).map((x) => x.id)).toEqual([
      "mcp.as.cimd",
      "mcp.as.dcr",
      "mcp.rs.old-only",
    ]);
  });

  it("rows exclude withdrawn servers and are ordered by name", () => {
    expect(matrixRows(data).map((x) => x.id)).toEqual(["alpha", "beta", "local"]);
  });

  it("has a cell for every row and column with a status", () => {
    const m = matrixFor(data, NEW);
    expect(m.cells.size).toBe(m.rows.length * m.columns.length);
    for (const cell of m.cells.values()) expect(cell.status).toBeTruthy();
  });
});

describe("featureShare", () => {
  it("excludes unknown and not-applicable from the denominator and reports their counts", () => {
    const share = featureShare(data, "mcp.as.cimd", NEW);
    expect(share).toMatchObject({
      supported: 2,
      partial: 0,
      unsupported: 0,
      unknown: 0,
      notApplicable: 1,
    });
    expect(share.share).toBe(1);
    const none = featureShare(data, "mcp.as.iss-param", NEW);
    expect(none.share).toBeNull();
    expect(none.unknown).toBe(2);
  });
});

describe("revisionDiff", () => {
  it("lists level changes, additions and removals", () => {
    const diff = revisionDiff(data, OLD, NEW);
    expect(diff.changed.map((c) => [c.feature.id, c.from, c.to])).toEqual([
      ["mcp.as.dcr", "SHOULD", "MAY"],
    ]);
    expect(diff.added.map((x) => x.id)).toEqual(["mcp.as.iss-param", "mcp.client.pkce"]);
    expect(diff.removed.map((x) => x.id)).toEqual(["mcp.rs.old-only"]);
  });
});

it("orders instants across offsets and applies method strength to equivalent instants", () => {
  const older = obs("a", "f", "unsupported", "manual", "2026-10-18T11:00:00+02:00");
  const newer = obs("a", "f", "supported", "passive-scan", "2026-10-18T10:00:00Z");
  const tied = obs("a", "f", "partial", "manual", "2026-10-18T05:00:00-05:00");
  const history = observationsFor({ ...data, observations: [older, newer, tied] }, "a", "f", NEW);
  expect(history.map((o) => o.status)).toEqual(["supported", "partial", "unsupported"]);
});
