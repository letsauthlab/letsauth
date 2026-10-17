import { describe, expect, it } from "vitest";
import { ACCESS_ORDER, AUTH_ORDER, accessOf, authOf, countBy, hasNoOAuth } from "@/lib/classes";
import { getDataset } from "@/lib/data";
import { type Auth, type Server, serverSchema } from "@/schema";

const base: Server = {
  id: "example",
  name: "Example",
  url: "https://mcp.example.com/mcp",
  transport: "streamable-http",
  listed: "opt-in",
};
const stated = (cls: Auth["class"]): Auth => ({
  class: cls,
  method: "manual",
  evidence: "https://example.com/docs — says so",
  observedAt: "2026-10-17T00:00:00Z",
  observedBy: "tester",
});

describe("accessOf / authOf (009 FR-002)", () => {
  it("derives unknown when nothing is stated", () => {
    expect(accessOf(base)).toEqual({ value: "unknown", derived: true });
    expect(authOf(base)).toEqual({ value: "unknown", derived: true });
  });

  it("keeps a stated unknown apart from a derived one", () => {
    const s = { ...base, auth: stated("unknown") };
    expect(authOf(s)).toEqual({ value: "unknown", derived: false });
  });

  it("returns the stated class", () => {
    expect(authOf({ ...base, auth: stated("api-key") }).value).toBe("api-key");
  });
});

describe("hasNoOAuth (009 FR-005)", () => {
  it("is true only for api-key and none; unknown and missing are scanned like OAuth", () => {
    expect(hasNoOAuth(base)).toBe(false);
    expect(hasNoOAuth({ ...base, auth: stated("oauth") })).toBe(false);
    expect(hasNoOAuth({ ...base, auth: stated("unknown") })).toBe(false);
    expect(hasNoOAuth({ ...base, auth: stated("api-key") })).toBe(true);
    expect(hasNoOAuth({ ...base, auth: stated("none") })).toBe(true);
  });
});

describe("countBy", () => {
  it("counts every class in order, including empty ones", () => {
    const servers = [base, { ...base, auth: stated("none") }, { ...base, auth: stated("none") }];
    expect(countBy(servers, AUTH_ORDER, authOf)).toEqual([
      { value: "oauth", count: 0 },
      { value: "api-key", count: 0 },
      { value: "none", count: 2 },
      { value: "unknown", count: 1 },
    ]);
    expect(countBy(servers, ACCESS_ORDER, accessOf).map((c) => c.count)).toEqual([0, 0, 3]);
  });
});

describe("serverSchema with classes (009 FR-001)", () => {
  it("accepts a full statement and rejects a partial or unknown one", () => {
    expect(serverSchema.safeParse({ ...base, auth: stated("oauth") }).success).toBe(true);
    const missing = serverSchema.safeParse({
      ...base,
      access: {
        class: "public",
        method: "manual",
        observedAt: "2026-10-17T00:00:00Z",
        observedBy: "t",
      },
    });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues.map((i) => i.path.join("."))).toContain("access.evidence");
    const bad = serverSchema.safeParse({ ...base, auth: stated("basic" as Auth["class"]) });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.path.join(".")).toBe("auth.class");
  });

  it("the seed data states a class with a vendor page for most servers (SC-002)", () => {
    const servers = getDataset().servers.filter((s) => !s.withdrawn);
    const statedAuth = servers.filter((s) => s.auth && s.auth.class !== "unknown");
    expect(statedAuth.length).toBeGreaterThanOrEqual(30);
    for (const s of servers) {
      for (const c of [s.access, s.auth]) {
        if (!c) continue;
        expect(c.evidence, s.id).toMatch(/^https:\/\//);
        expect(c.method, s.id).not.toBe("vendor-claim");
      }
    }
  });
});
