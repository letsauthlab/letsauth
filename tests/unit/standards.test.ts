import { describe, expect, it } from "vitest";
import type { Dataset } from "@/lib/data";
import { getDataset } from "@/lib/data";
import {
  adjacentRevisionPairs,
  buildsOnSpine,
  currentRevisionOf,
  featuresDefinedBy,
  mapRelations,
  recentlyRevised,
  relationsOf,
  specNodes,
  specsByBody,
  withdrawnSpecs,
} from "@/lib/standards";
import { buildStandardsExport } from "@/lib/standards-export";
import { type Feature, type Relation, relationSchema, type Spec, specSchema } from "@/schema";

function spec(
  id: string,
  body: Spec["body"],
  first: string,
  maturity: Spec["maturity"] = "published",
  extra: Partial<Spec> = {},
): Spec {
  return {
    id,
    name: id,
    body,
    family: "protocol",
    maturity,
    summary: "s",
    url: `https://example.org/${id}`,
    revisions: [
      { id: "v1", date: first, status: "superseded", url: `https://example.org/${id}/1` },
      {
        id: "v2",
        date: "2026-01-01",
        status: "current",
        url: `https://example.org/${id}/2`,
        supersedes: "v1",
      },
    ],
    ...extra,
  };
}

function feature(id: string, spec: string, revision: string, party: Feature["party"]): Feature {
  return {
    id,
    name: id,
    description: "d",
    category: "authorization",
    party,
    observable: "manual",
    revisions: [{ spec, revision, section: "s", level: "MUST" }],
  };
}

const relations: Relation[] = [
  { from: "mcp", to: "oauth", type: "builds-on" },
  { from: "oidc", to: "oauth", type: "builds-on" },
  { from: "eu", to: "mcp", type: "references" },
  { from: "aauth", to: "oauth", type: "competes-with", note: "n" },
  { from: "oauth", to: "old", type: "replaces" },
  { from: "gone", to: "oauth", type: "builds-on" },
];

const data: Dataset = {
  specs: [
    spec("mcp", "mcp", "2025-01-01"),
    spec("oauth", "ietf-oauth", "2012-01-01"),
    spec("oidc", "openid", "2014-01-01"),
    spec("eu", "eu", "2024-01-01", "in-force"),
    spec("aauth", "ietf-oauth", "2026-04-01", "individual-draft"),
    spec("old", "ietf-oauth", "2010-01-01", "expired"),
    spec("gone", "vendor", "2020-01-01", "withdrawn"),
  ],
  features: [
    feature("mcp.as.x", "mcp", "v2", "authorization-server"),
    feature("mcp.client.y", "mcp", "v2", "client"),
    feature("mcp.rs.old", "mcp", "v1", "mcp-server"),
  ],
  servers: [],
  observations: [],
  relations,
  scenarios: [],
  vulnerabilities: [],
};

describe("specNodes and withdrawnSpecs (FR-014, SC-006)", () => {
  it("keeps expired specs on the map and lists withdrawn ones separately", () => {
    const ids = specNodes(data).map((s) => s.id);
    expect(ids).toContain("old");
    expect(ids).not.toContain("gone");
    expect(withdrawnSpecs(data).map((s) => s.id)).toEqual(["gone"]);
  });

  it("orders by body, first revision date, then name", () => {
    expect(specNodes(data).map((s) => s.id)).toEqual([
      "old",
      "oauth",
      "aauth",
      "oidc",
      "mcp",
      "eu",
    ]);
  });

  it("drops relations touching a withdrawn spec from the map", () => {
    const rels = mapRelations(data);
    expect(rels.some((r) => r.from === "gone" || r.to === "gone")).toBe(false);
    expect(rels).toHaveLength(relations.length - 1);
  });

  it("groups by body in BODY_ORDER", () => {
    expect(specsByBody(specNodes(data)).map((g) => g.body)).toEqual([
      "ietf-oauth",
      "openid",
      "mcp",
      "eu",
    ]);
  });
});

describe("buildsOnSpine (M4)", () => {
  it("follows the longest builds-on chain from the oldest document, stable on ties", () => {
    const specs = [
      spec("a", "ietf-oauth", "2010-01-01"),
      spec("b", "ietf-oauth", "2012-01-01"),
      spec("c", "openid", "2014-01-01"),
      spec("d", "mcp", "2025-01-01"),
      spec("e", "mcp", "2025-02-01"),
    ];
    const rels: Relation[] = [
      { from: "b", to: "a", type: "builds-on" },
      { from: "c", to: "b", type: "builds-on" },
      { from: "d", to: "c", type: "builds-on" },
      { from: "e", to: "c", type: "builds-on" },
      { from: "e", to: "a", type: "references" },
    ];
    expect(buildsOnSpine(specs, rels).map((r) => `${r.to}>${r.from}`)).toEqual([
      "a>b",
      "b>c",
      "c>d",
    ]);
  });

  it("is empty without builds-on relations and ignores specs off the map", () => {
    expect(buildsOnSpine(specNodes(data), [])).toEqual([]);
    expect(buildsOnSpine(specNodes(data), mapRelations(data)).map((r) => r.from)).toHaveLength(1);
  });
});

describe("relationsOf", () => {
  it("separates outgoing, incoming and symmetric relations", () => {
    const groups = relationsOf(data, "oauth");
    expect([...groups.outgoing.keys()]).toEqual(["replaces"]);
    expect(groups.incoming.get("builds-on")?.map((e) => e.other.id)).toEqual([
      "oidc",
      "mcp",
      "gone",
    ]);
    expect(groups.related.get("competes-with")?.map((e) => e.other.id)).toEqual(["aauth"]);
    expect(groups.total).toBe(5);
  });

  it("puts a symmetric relation under related on the stored `to` side as well", () => {
    const groups = relationsOf(data, "aauth");
    expect(groups.related.get("competes-with")?.[0]?.other.id).toBe("oauth");
    expect(groups.outgoing.size).toBe(0);
  });
});

describe("revisions", () => {
  it("currentRevisionOf returns the current one and adjacent pairs ascend", () => {
    const s = spec("x", "mcp", "2025-01-01");
    expect(currentRevisionOf(s).id).toBe("v2");
    expect(adjacentRevisionPairs(s).map(([a, b]) => `${a.id}>${b.id}`)).toEqual(["v1>v2"]);
  });

  it("recentlyRevised lists the newest current revisions first", () => {
    const recent = recentlyRevised(data, 2);
    expect(recent).toHaveLength(2);
    expect((recent[0]?.revision.date ?? "") >= (recent[1]?.revision.date ?? "")).toBe(true);
  });
});

describe("featuresDefinedBy", () => {
  it("lists features whose entry cites the spec's current revision, client features included", () => {
    const defined = featuresDefinedBy(data, "mcp").map((d) => d.feature.id);
    expect(defined).toEqual(["mcp.as.x", "mcp.client.y"]);
  });

  it("over the real data, every MCP feature with a 2026-07-28 entry is listed", () => {
    const real = getDataset();
    const defined = featuresDefinedBy(real, "mcp-authorization");
    const expected = real.features.filter((f) =>
      f.revisions.some((r) => r.spec === "mcp-authorization" && r.revision === "2026-07-28"),
    );
    expect(defined.length).toBe(expected.length);
    expect(defined.find((d) => d.feature.id === "mcp.as.cimd")?.entry.level).toBe("SHOULD");
  });
});

describe("standards export (FR-012, SC-007)", () => {
  it("validates against the schemas and holds every node and edge of the map", () => {
    const out = buildStandardsExport(data, "2026-10-14T00:00:00Z");
    expect(out.version).toBe(1);
    expect(out.license).toBe("CC BY 4.0");
    for (const s of out.specs) expect(specSchema.safeParse(s).success).toBe(true);
    for (const r of out.relations) expect(relationSchema.safeParse(r).success).toBe(true);
    expect(out.specs.map((s) => s.id)).toEqual(specNodes(data).map((s) => s.id));
    expect(out.withdrawn).toEqual(["gone"]);
    expect(out.relations).toHaveLength(relations.length);
  });

  it("over the real data, every spec and relation is present", () => {
    const real = getDataset();
    const out = buildStandardsExport(real, "2026-10-14T00:00:00Z");
    expect(out.specs.length + out.withdrawn.length).toBe(real.specs.length);
    expect(out.relations.length).toBe(real.relations.length);
  });
});
