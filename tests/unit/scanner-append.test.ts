import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { currentRevision } from "@/lib/atlas";
import { type Dataset, getDataset } from "@/lib/data";
import { type Fixture, recordingFetcher } from "@/scanner/fetch";
import {
  appendObservations,
  authNote,
  heldCells,
  summarise,
  toAppend,
} from "@/scanner/observations";
import { type Report, scan } from "@/scanner/report";
import { type Observation, observationFileSchema } from "@/schema";

const base = getDataset();
const revision = currentRevision(base).id;
const fixture = JSON.parse(
  readFileSync(resolve(__dirname, "../fixtures/scanner/complete.json"), "utf8"),
) as Fixture;
const server = base.servers.find((s) => !s.withdrawn && s.transport !== "stdio-only");
if (!server) throw new Error("no server");

/** A dataset with the real servers and features but only the given observations. */
function withObservations(observations: Observation[]): Dataset {
  return { ...base, observations, locations: undefined };
}

async function report(now = "2026-10-15T03:17:04Z"): Promise<Report> {
  return scan({ url: fixture.target, serverId: server?.id }, base, {
    fetcher: recordingFetcher(fixture),
    now,
  });
}

describe("append rule (FR-005, SC-003)", () => {
  it("appends every check when the server has no observation", async () => {
    const r = await report();
    expect(toAppend(r, withObservations([]))).toHaveLength(r.checks.length);
  });

  it("appends nothing when the current cells already hold this scanner's results", async () => {
    const r = await report();
    const data = withObservations(r.observations);
    expect(toAppend(await report("2026-10-16T03:17:04Z"), data)).toEqual([]);
  });

  it("appends only the cell whose evidence or status changed", async () => {
    const r = await report();
    const earlier = r.observations.map((o) =>
      o.feature === "mcp.as.cimd"
        ? { ...o, status: "unsupported" as const, evidence: `${o.evidence} (old)` }
        : o,
    );
    const again = await report("2026-10-16T03:17:04Z");
    const out = toAppend(again, withObservations(earlier));
    expect(out.map((o) => o.feature)).toEqual(["mcp.as.cimd"]);
  });

  it("re-observes every cell written by an older scanner version", async () => {
    const r = await report();
    const old = r.observations.map((o) => ({ ...o, observedBy: "scanner@0.0.9" }));
    expect(toAppend(await report("2026-10-16T03:17:04Z"), withObservations(old))).toHaveLength(
      r.checks.length,
    );
  });

  it("appends over a documentation cell even when the status agrees", async () => {
    const r = await report();
    const docs = r.observations.map((o) => ({
      ...o,
      method: "vendor-claim" as const,
      observedBy: "jbspeakr",
      evidence: "https://docs.example/ says so",
    }));
    expect(toAppend(await report("2026-10-16T03:17:04Z"), withObservations(docs))).toHaveLength(
      r.checks.length,
    );
  });

  it("leaves a newer manual observation standing while its own view is unchanged", async () => {
    const r = await report();
    const manual: Observation = {
      ...(r.observations[0] as Observation),
      method: "manual",
      observedBy: "jbspeakr",
      observedAt: "2026-10-16T00:00:00Z",
      status: "partial",
      evidence: "https://docs.example/ limits registration to allowlisted clients",
    };
    const data = withObservations([...r.observations, manual]);
    const again = await report("2026-10-17T03:17:04Z");
    expect(toAppend(again, data)).toEqual([]);
    expect(heldCells(again, data)).toEqual([
      {
        feature: manual.feature,
        status: "partial",
        method: "manual",
        observedBy: "jbspeakr",
        scanStatus: (r.observations[0] as Observation).status,
      },
    ]);
  });

  it("writes over a newer manual observation once its own view changes, and holds nothing then", async () => {
    const r = await report();
    const manual: Observation = {
      ...(r.observations[0] as Observation),
      method: "manual",
      observedBy: "jbspeakr",
      observedAt: "2026-10-16T00:00:00Z",
      status: "partial",
      evidence: "https://docs.example/ limits registration to allowlisted clients",
    };
    const old = r.observations.map((o) => ({ ...o, observedBy: "scanner@0.0.9" }));
    const data = withObservations([...old, manual]);
    const again = await report("2026-10-17T03:17:04Z");
    expect(toAppend(again, data)).toHaveLength(r.checks.length);
    expect(heldCells(again, data)).toEqual([]);
  });

  it("holds nothing when the manual observation agrees with the scan", async () => {
    const r = await report();
    const manual: Observation = {
      ...(r.observations[0] as Observation),
      method: "manual",
      observedBy: "jbspeakr",
      observedAt: "2026-10-16T00:00:00Z",
      evidence: "checked by hand",
    };
    const data = withObservations([...r.observations, manual]);
    const again = await report("2026-10-17T03:17:04Z");
    expect(toAppend(again, data)).toEqual([]);
    expect(heldCells(again, data)).toEqual([]);
  });

  it("returns nothing for a target that is not a listed server", async () => {
    const r = await scan({ url: fixture.target }, base, { fetcher: recordingFetcher(fixture) });
    expect(toAppend(r, base)).toEqual([]);
  });
});

describe("appendObservations", () => {
  it("keeps the existing text as a byte-identical prefix and the result validates", async () => {
    const dir = mkdtempSync(join(tmpdir(), "scanner-append-"));
    const file = join(dir, `${server?.id}.yaml`);
    const original = readFileSync(
      resolve(__dirname, `../../data/observations/${server?.id}.yaml`),
      "utf8",
    );
    writeFileSync(file, original.replace(/\n$/, ""));
    const r = await report();
    appendObservations(file, r.observations.slice(0, 2));
    const after = readFileSync(file, "utf8");
    expect(after.startsWith(original.replace(/\n$/, ""))).toBe(true);
    const parsed = observationFileSchema.safeParse(parse(after));
    expect(parsed.success, JSON.stringify(parsed.error?.issues.slice(0, 2))).toBe(true);
    expect(parsed.data?.slice(-2)).toEqual(r.observations.slice(0, 2));
  });

  it("creates the file when missing and does nothing for an empty list", async () => {
    const dir = mkdtempSync(join(tmpdir(), "scanner-append-"));
    const file = join(dir, "new.yaml");
    appendObservations(file, []);
    expect(() => readFileSync(file)).toThrow();
    const r = await report();
    appendObservations(file, r.observations);
    expect(observationFileSchema.parse(parse(readFileSync(file, "utf8")))).toHaveLength(
      r.observations.length,
    );
  });
});

describe("authNote (009 FR-006)", () => {
  const statement = (cls: "oauth" | "api-key" | "none" | "unknown") => ({
    class: cls,
    method: "manual" as const,
    evidence: "https://example.com/docs — says so",
    observedAt: "2026-10-17T00:00:00Z",
    observedBy: "tester",
  });

  it("names the suggestion when the class is not stated or stated unknown", async () => {
    const r = await report();
    expect(r.discovered?.authSuggestion).toBe("oauth");
    const bare = { ...(server as NonNullable<typeof server>), auth: undefined };
    expect(authNote(r, bare)).toBe("auth class not stated; the endpoint's answer suggests oauth");
    expect(authNote(r, { ...bare, auth: statement("unknown") })).toBe(
      "auth class unknown; the endpoint's answer suggests oauth",
    );
  });

  it("names a disagreement and is silent when the class agrees", async () => {
    const r = await report();
    const s = server as NonNullable<typeof server>;
    expect(authNote(r, { ...s, auth: statement("api-key") })).toBe(
      "auth class api key (manual); the endpoint's answer suggests oauth",
    );
    expect(authNote(r, { ...s, auth: statement("oauth") })).toBeUndefined();
  });

  it("is silent when the probe settles nothing", async () => {
    const neither = JSON.parse(
      readFileSync(resolve(__dirname, "../fixtures/scanner/challenge-neither.json"), "utf8"),
    ) as Fixture;
    const r = await scan({ url: neither.target, serverId: server?.id }, base, {
      fetcher: recordingFetcher(neither),
    });
    expect(r.discovered?.authSuggestion).toBeNull();
    expect(
      authNote(r, { ...(server as NonNullable<typeof server>), auth: undefined }),
    ).toBeUndefined();
  });

  it("lands in the summary's Notes column", async () => {
    const r = await report();
    const md = summarise(
      [
        {
          server: { id: server?.id ?? "", name: server?.name ?? "", url: fixture.target },
          report: r,
          appended: [],
          authNote: "auth class not stated; the endpoint's answer suggests oauth",
        },
      ],
      "2026-10-15T03:17:04Z",
      revision,
    );
    expect(md).toContain("| 0 | auth class not stated; the endpoint's answer suggests oauth |");
  });
});

describe("summarise", () => {
  it("lists every server with grade, appended cells and unknown count", async () => {
    const r = await report();
    const md = summarise(
      [
        {
          server: { id: server?.id ?? "", name: server?.name ?? "", url: fixture.target },
          report: r,
          appended: r.observations.slice(0, 1),
          held: [
            {
              feature: "mcp.as.dcr",
              status: "partial",
              method: "manual",
              observedBy: "jbspeakr",
              scanStatus: "supported",
            },
          ],
        },
        {
          server: { id: "down", name: "Down", url: "https://down.example/" },
          appended: [],
          error: "refused",
        },
      ],
      "2026-10-15T03:17:04Z",
      revision,
    );
    expect(md).toContain("1 observation appended");
    expect(md).toContain(
      `| ${server?.name} (\`${server?.id}\`) | A | 1: \`${r.observations[0]?.feature}\` supported | 0 | held by hand: \`mcp.as.dcr\` partial (manual, jbspeakr) over scan supported |`,
    );
    expect(md).toContain("| Down (`down`) | – | 0 | 0 | error: refused |");
  });
});
