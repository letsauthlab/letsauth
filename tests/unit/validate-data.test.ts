import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const tsx = join(root, "node_modules/.bin/tsx");

function run(script: string, args: string[], cwd = root) {
  return spawnSync(tsx, [join(root, script), ...args], { cwd, encoding: "utf8" });
}

describe("scripts/validate-data.ts", () => {
  const result = run("scripts/validate-data.ts", [join(root, "tests/fixtures/bad-data")]);

  it("exits non-zero on a bad dataset", () => {
    expect(result.status).not.toBe(0);
  });

  it("names file, index and field for a missing evidence (SC-005)", () => {
    expect(result.stderr).toMatch(/observations\/stripe\.yaml\[1\]\.evidence: required/);
  });

  it("names the field of a class statement without evidence (009 FR-001)", () => {
    expect(result.stderr).toMatch(/servers\/stripe\.yaml\.auth\.evidence: /);
  });

  it("names the feature field for an unknown feature id", () => {
    expect(result.stderr).toMatch(/observations\/stripe\.yaml\[2\]\.feature: .*mcp\.as\.nope/);
  });

  it("names the field for a dangling, self or unexplained relation (FR-011)", () => {
    expect(result.stderr).toMatch(/relations\.yaml\[0\]\.to: spec "nope" does not exist/);
    expect(result.stderr).toMatch(/relations\.yaml\[1\]\.to: must differ from "from"/);
    expect(result.stderr).toMatch(/relations\.yaml\[2\]\.note: required for a "competes-with"/);
  });

  it("names file and field for a broken scenario (003 FR-002)", () => {
    expect(result.stderr).toMatch(
      /scenarios\/broken\.yaml\.features\[0\]: feature "mcp\.as\.nope"/,
    );
    expect(result.stderr).toMatch(/scenarios\/broken\.yaml\.steps\[1\]\.to: actor "nobody"/);
    expect(result.stderr).toMatch(
      /scenarios\/broken\.yaml\.steps\[1\]\.cites: revision ".*1999-01-01"/,
    );
    expect(result.stderr).toMatch(/toggles\[0\]\.replaces\.missing: step "missing" does not exist/);
    expect(result.stderr).toMatch(/replaces\.missing\[0\]\.id: step id "ask" collides/);
  });

  it("passes on the real data", () => {
    const ok = run("scripts/validate-data.ts", []);
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.stdout).toMatch(/data ok/);
  });
});

describe("scripts/check-observations-append-only.ts", () => {
  it("fails naming the changed entry index", () => {
    const dir = mkdtempSync(join(tmpdir(), "append-only-"));
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    git("init", "-q", "-b", "main");
    git("config", "user.email", "t@example.org");
    git("config", "user.name", "t");
    mkdirSync(join(dir, "data/observations"), { recursive: true });
    const file = join(dir, "data/observations/stripe.yaml");
    const original = readFileSync(
      join(root, "tests/fixtures/bad-data/observations/stripe.yaml"),
      "utf8",
    );
    writeFileSync(file, original);
    git("add", ".");
    git("commit", "-q", "-m", "seed");
    const ok = run("scripts/check-observations-append-only.ts", ["HEAD"], dir);
    expect(ok.status, ok.stderr).toBe(0);

    writeFileSync(
      file,
      original.replace(
        "observedBy: test\n  evidence: https://example.org/ok\n- server",
        "observedBy: edited\n  evidence: https://example.org/ok\n- server",
      ),
    );
    const changed = run("scripts/check-observations-append-only.ts", ["HEAD"], dir);
    expect(changed.status).not.toBe(0);
    expect(changed.stderr).toMatch(/stripe\.yaml\[0\]: existing observation changed or removed/);

    writeFileSync(
      file,
      `${original}- server: stripe\n  feature: x.y\n  revision: { spec: s, revision: "1" }\n  status: unknown\n  method: manual\n  observedAt: "2026-10-14T00:00:00Z"\n  observedBy: t\n  evidence: n\n`,
    );
    const appended = run("scripts/check-observations-append-only.ts", ["HEAD"], dir);
    expect(appended.status, appended.stderr).toBe(0);
  });
});
