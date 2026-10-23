import { describe, expect, it } from "vitest";
import type { Dataset } from "@/lib/data";
import { getDataset } from "@/lib/data";
import {
  buildExplorerExport,
  diffClaims,
  featureSupport,
  resolveChain,
  scenarioList,
} from "@/lib/explorer";
import type { Scenario, Step, TokenValue } from "@/schema";

const cite = { spec: "mcp-authorization", revision: "2026-07-28", section: "Authorization" };

function step(id: string, from: string, to: string, claims?: Record<string, TokenValue>): Step {
  return {
    id,
    from,
    to,
    message: `${id} message`,
    cites: cite,
    ...(claims ? { token: { name: `token at ${id}`, claims } } : {}),
  };
}

const scenario: Scenario = {
  id: "demo",
  title: "Demo",
  summary: "A demo chain.",
  actors: [
    { id: "client", kind: "mcp-client", name: "Client" },
    { id: "as", kind: "authorization-server", name: "AS" },
    { id: "server", kind: "mcp-server", name: "Server" },
  ],
  features: ["mcp.rs.no-passthrough"],
  steps: [
    step("ask", "client", "as"),
    step("issue", "as", "client", {
      iss: "https://as.example",
      aud: "https://mcp.example",
      scope: "read",
    }),
    step("call", "client", "server", {
      iss: "https://as.example",
      aud: "https://mcp.example",
      scope: "read",
    }),
    step("validate", "server", "server"),
    step("upstream", "server", "server", {
      iss: "https://as.example",
      aud: "https://api.example",
      act: { sub: "server" },
    }),
  ],
  toggles: [
    {
      id: "split",
      name: "Split the call",
      kind: "attack",
      summary: "Replaces one step with two.",
      cites: cite,
      replaces: {
        call: [
          step("call-a", "client", "server", {
            iss: "https://as.example",
            aud: "https://other.example",
          }),
          step("call-b", "client", "server"),
        ],
      },
      violates: ["mcp.rs.audience-validation"],
    },
    {
      id: "skip",
      name: "Skip validation",
      kind: "misconfiguration",
      summary: "Removes a step.",
      cites: cite,
      replaces: { validate: [] },
    },
  ],
};

describe("diffClaims (FR-004)", () => {
  it("marks nothing without a previous token", () => {
    expect(diffClaims(undefined, { a: 1 })).toEqual({ added: [], changed: [], removed: [] });
  });

  it("names added, changed and removed claims, comparing nested values structurally", () => {
    const diff = diffClaims(
      { iss: "x", aud: "a", act: { sub: "o" }, scope: "r" },
      { iss: "x", aud: "b", act: { sub: "o" }, jti: "1" },
    );
    expect(diff).toEqual({ added: ["jti"], changed: ["aud"], removed: ["scope"] });
    expect(diffClaims({ act: { sub: "o" } }, { act: { sub: "p" } }).changed).toEqual(["act"]);
  });
});

describe("resolveChain (FR-003, FR-005)", () => {
  it("keeps the baseline in order with 1-based indexes and no toggle marks", () => {
    const chain = resolveChain(scenario);
    expect(chain.toggle).toBeUndefined();
    expect(chain.steps.map((s) => s.id)).toEqual(["ask", "issue", "call", "validate", "upstream"]);
    expect(chain.steps.map((s) => s.index)).toEqual([1, 2, 3, 4, 5]);
    expect(chain.steps.every((s) => !s.toggled && !s.removed)).toBe(true);
  });

  it("diffs each token against the previous token in the chain", () => {
    const chain = resolveChain(scenario);
    expect(chain.steps[1]?.token?.diff).toEqual({ added: [], changed: [], removed: [] });
    expect(chain.steps[2]?.token?.diff).toEqual({ added: [], changed: [], removed: [] });
    expect(chain.steps[4]?.token?.diff).toEqual({
      added: ["act"],
      changed: ["aud"],
      removed: ["scope"],
    });
  });

  it("replaces one step with two in place, marking both and naming the replaced step once", () => {
    const chain = resolveChain(scenario, "split");
    expect(chain.toggle?.id).toBe("split");
    expect(chain.steps.map((s) => s.id)).toEqual([
      "ask",
      "issue",
      "call-a",
      "call-b",
      "validate",
      "upstream",
    ]);
    expect(chain.steps[2]).toMatchObject({ toggled: true, replaces: "call", index: 3 });
    expect(chain.steps[3]).toMatchObject({ toggled: true, index: 4 });
    expect(chain.steps[3]?.replaces).toBeUndefined();
    expect(chain.steps[1]?.toggled).toBe(false);
    // the mark lands where the toggled token first differs
    expect(chain.steps[2]?.token?.diff).toEqual({
      added: [],
      changed: ["aud"],
      removed: ["scope"],
    });
  });

  it("keeps a removed step in place, marked, and skips it in the diff", () => {
    const chain = resolveChain(scenario, "skip");
    expect(chain.steps.map((s) => s.id)).toEqual(["ask", "issue", "call", "validate", "upstream"]);
    expect(chain.steps[3]).toMatchObject({ toggled: true, removed: true });
    expect(chain.steps[4]?.token?.diff.changed).toEqual(["aud"]);
  });

  it("throws on an unknown toggle", () => {
    expect(() => resolveChain(scenario, "nope")).toThrow(/no toggle "nope"/);
  });
});

describe("scenarioList, featureSupport and the export (FR-006, FR-008, FR-009)", () => {
  const real = getDataset();
  const data: Dataset = { ...real, scenarios: [scenario] };

  it("lists scenarios by id with counts, toggles and resolved features", () => {
    const list = scenarioList(data);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ stepCount: 5 });
    expect(list[0]?.toggles.map((t) => t.id)).toEqual(["split", "skip"]);
    expect(list[0]?.features.map((f) => f.id)).toEqual(["mcp.rs.no-passthrough"]);
  });

  it("counts listed servers for a server-side requirement and explains a client-side one", () => {
    const observed = featureSupport(real, "mcp.rs.no-passthrough");
    expect(observed.observed).toBe(true);
    if (observed.observed) {
      const c = observed.counts;
      expect(c.supported + c.partial + c.unsupported + c.unknown + c.notApplicable).toBe(
        real.servers.filter((s) => !s.withdrawn).length,
      );
    }
    const client = featureSupport(real, "mcp.client.resource-param");
    expect(client.observed).toBe(false);
    if (!client.observed) expect(client.reason).toMatch(/does not observe clients/);
  });

  it("builds the export envelope with the scenarios as validated", () => {
    const out = buildExplorerExport(data, "2026-10-15T00:00:00.000Z");
    expect(out).toMatchObject({
      version: 1,
      generatedAt: "2026-10-15T00:00:00.000Z",
      license: "CC BY 4.0",
      source: "https://www.letsauth.eu/explorer/",
    });
    expect(out.scenarios).toEqual([scenario]);
  });

  it("ships three scenarios with eleven toggles, every one resolvable (003 SC-001, 005 FR-005)", () => {
    const list = scenarioList(real);
    expect(list).toHaveLength(3);
    expect(list.reduce((n, s) => n + s.toggles.length, 0)).toBe(11);
    for (const { scenario: s } of list) {
      resolveChain(s);
      for (const t of s.toggles) resolveChain(s, t.id);
    }
  });
});
