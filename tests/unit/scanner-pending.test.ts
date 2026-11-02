import { describe, expect, it } from "vitest";
import { listPendingScannerPulls, pendingNote } from "@/scanner/nightly";
import { appendedText, onto, pendingEntries, withEntries } from "@/scanner/pending";

const A = `- server: s
  feature: mcp.prm
  status: supported
  observedAt: 2026-10-30T02:19:28Z
  observedBy: scanner@0.4.0
`;
const B = `- server: s
  feature: mcp.as.cimd
  status: supported
  observedAt: 2026-10-31T02:19:55Z
  observedBy: scanner@0.4.0
`;
const C = `- server: s
  feature: mcp.as.dcr
  status: unknown
  observedAt: 2026-11-01T02:18:31Z
  observedBy: scanner@0.4.0
`;

describe("pending scanner evidence (spec 018)", () => {
  it("takes what a pending branch has and the run's file does not, in the branch's order", () => {
    expect(pendingEntries(A, A + B + C)).toEqual([
      expect.objectContaining({ feature: "mcp.as.cimd" }),
      expect.objectContaining({ feature: "mcp.as.dcr" }),
    ]);
  });

  it("does not repeat what was merged, or carried from an earlier pending pull request", () => {
    // main has A, merged since; an earlier pending branch already added B
    expect(pendingEntries(A + B, A + B)).toEqual([]);
    // an entry is the same entry whatever order its keys come in
    const reordered = `- feature: mcp.as.cimd
  server: s
  observedBy: scanner@0.4.0
  observedAt: 2026-10-31T02:19:55Z
  status: supported
`;
    expect(pendingEntries(A + reordered, A + B)).toEqual([]);
  });

  it("reads a file a pending branch created as all pending", () => {
    expect(pendingEntries("", B)).toHaveLength(1);
  });

  it("writes carried entries in the scanner's own form", () => {
    expect(withEntries(A, pendingEntries(A, A + B))).toBe(A + B);
    expect(withEntries(A, [])).toBe(A);
  });

  it("keeps only what the scan appended on top of the overlay, onto main's file", () => {
    const main = A;
    const overlaid = A + B;
    const scanned = overlaid + C;
    expect(onto(main, appendedText(overlaid, scanned))).toBe(A + C);
    expect(onto(main, appendedText(overlaid, overlaid))).toBe(A);
  });

  it("refuses a scan that changed an existing entry", () => {
    expect(() => appendedText(A + B, B + A)).toThrow(/instead of appending/);
  });
});

describe("listPendingScannerPulls", () => {
  it("lists the open scanner pull requests of the repository itself, oldest first", async () => {
    const urls: string[] = [];
    const pull = (number: number, ref: string, repo = "o/r") => ({
      number,
      html_url: `https://github.com/o/r/pull/${number}`,
      head: { ref, repo: { full_name: repo } },
    });
    const pending = await listPendingScannerPulls({
      repo: "o/r",
      token: "t",
      base: "main",
      fetch: async (url) => {
        urls.push(url);
        return Response.json([
          pull(85, "scanner/2026-10-31-0217"),
          pull(82, "scanner/2026-10-29-0217"),
          pull(84, "ci-lighthouse"),
          pull(90, "scanner/2026-11-03-0217", "someone/fork"),
        ]);
      },
    });
    expect(pending.map((p) => p.number)).toEqual([82, 85]);
    expect(urls[0]).toContain("/repos/o/r/pulls?state=open&base=main");
  });

  it("names the pending pull requests in the description", () => {
    expect(pendingNote([])).toBe("");
    const note = pendingNote([
      { number: 82, head: "scanner/a", url: "" },
      { number: 83, head: "scanner/b", url: "" },
      { number: 85, head: "scanner/c", url: "" },
    ]);
    expect(note).toContain("#82, #83 and #85");
  });
});
