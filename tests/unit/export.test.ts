import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { currentRevision, matrixFor } from "@/lib/atlas";
import { getDataset } from "@/lib/data";
import { buildExport, buildServerExport } from "@/lib/export";
import { featureSchema, observationSchema, serverSchema, specSchema } from "@/schema";

const exportSchema = z.object({
  version: z.literal(1),
  generatedAt: z.iso.datetime(),
  license: z.string().min(1),
  spec: z.object({
    id: z.string(),
    name: z.string(),
    currentRevision: z.string(),
    revisions: specSchema.shape.revisions,
  }),
  features: z.array(featureSchema),
  servers: z.array(serverSchema),
  cells: z.array(
    z.object({
      server: z.string(),
      feature: z.string(),
      revision: z.string(),
      status: observationSchema.shape.status,
      derived: z.boolean(),
    }),
  ),
  observations: z.array(observationSchema.extend({ revision: z.string() })),
});

const data = getDataset();
const current = currentRevision(data);

describe("data.json export (FR-013)", () => {
  const out = buildExport(data, "2026-10-13T00:00:00Z");

  it("validates against the schemas", () => {
    const parsed = exportSchema.safeParse(out);
    expect(parsed.success, JSON.stringify(parsed.error?.issues.slice(0, 3))).toBe(true);
    expect(out.license).toBe("CC BY 4.0");
  });

  it("cells equal matrixFor(currentRevision)", () => {
    const matrix = matrixFor(data, current.id);
    expect(out.cells.length).toBe(matrix.cells.size);
    for (const cell of out.cells) {
      const expected = matrix.cells.get(`${cell.server}|${cell.feature}`);
      expect(expected).toBeDefined();
      expect(cell.status).toBe(expected?.status);
      expect(cell.derived).toBe(expected?.derived);
      expect(cell.revision).toBe(current.id);
    }
  });

  it("omits withdrawn servers everywhere", () => {
    const withdrawn = new Set(data.servers.filter((s) => s.withdrawn).map((s) => s.id));
    for (const s of out.servers) expect(withdrawn.has(s.id)).toBe(false);
    for (const c of out.cells) expect(withdrawn.has(c.server)).toBe(false);
    for (const o of out.observations) expect(withdrawn.has(o.server)).toBe(false);
  });

  it("matches the built file when dist/ exists", () => {
    const built = resolve(__dirname, "../../dist/mcp/data.json");
    if (!existsSync(built)) return;
    const file = JSON.parse(readFileSync(built, "utf8"));
    expect(exportSchema.safeParse(file).success).toBe(true);
    expect(file.cells).toEqual(out.cells);
    expect(file.servers.length).toBe(out.servers.length);
  });
});

describe("per-server export", () => {
  it("restricts to one server across every revision", () => {
    const first = data.servers.find((s) => !s.withdrawn);
    if (!first) throw new Error("no server");
    const out = buildServerExport(data, first.id, "2026-10-13T00:00:00Z");
    expect(out.server.id).toBe(first.id);
    for (const c of out.cells) expect(c.server).toBe(first.id);
    for (const o of out.observations) expect(o.server).toBe(first.id);
    const revisions = new Set(out.cells.map((c) => c.revision));
    expect(revisions.size).toBe(out.spec.revisions.length);
  });
});
