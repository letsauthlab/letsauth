import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

const script = resolve("scripts/investigate.ts");
const loader = import.meta.resolve("tsx");
let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "letsauth-investigation-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));
function cli(args: string[], cwd = process.cwd()) {
  return spawnSync(process.execPath, ["--import", loader, script, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 15_000,
  });
}

describe("investigation CLI", { timeout: 30_000 }, () => {
  it("prints help, lists JSON recipes and rejects bad flags/extra arguments", () => {
    expect(cli(["--help"]).stdout).toContain("record");
    expect(Object.keys(JSON.parse(cli(["list", "--json"]).stdout))).toContain("revocation");
    expect(cli(["list", "--write"]).status).toBe(1);
    expect(cli(["list", "extra"]).status).toBe(1);
    expect(cli(["challenge", "https://example.com/mcp"]).status).toBe(1);
    expect(cli(["run", "unused.json", "--proof", "unused.json"]).stderr).toContain(
      "Unknown option",
    );
  });
  it("starts direct URL checks without a config and cleans output on failed login setup", () => {
    const out = join(dir, "report.json");
    const result = cli([
      "check",
      "https://new.example.com/mcp",
      "--client-id",
      "test",
      "--client-secret-env",
      "MISSING_TEST_CLIENT_SECRET_UNIQUE",
      "--out",
      out,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Client secret environment variable");
    expect(existsSync(out)).toBe(false);
    expect(cli(["check", "figma", "--callback-port", "NaN", "--out", out]).status).toBe(1);
    expect(existsSync(out)).toBe(false);
  });
  it("writes an offline plan and validates revision selection", () => {
    const path = join(dir, "plan.json");
    const result = cli(["plan", "figma", "--out", path, "--json"]);
    expect(result.status).toBe(0);
    expect(JSON.parse(readFileSync(path, "utf8")).server).toBe("figma");
    expect(cli(["plan", "figma", "--revision", "invented"]).status).toBe(1);
  });
  it("prepares editable run configurations for a server ID and an unlisted URL", () => {
    for (const target of ["figma", "https://new.example.com/mcp"]) {
      const path = join(dir, target === "figma" ? "listed.json" : "new.json");
      const result = cli(["init", target, "--out", path]);
      expect(result.status, result.stderr).toBe(0);
      const config = JSON.parse(readFileSync(path, "utf8"));
      expect(config).toMatchObject({ recipe: "baseline", tokenEnv: "LETSAUTH_TOKEN" });
      expect(config.server).toBe(target === "figma" ? "figma" : undefined);
      if (target !== "figma") expect(config.target).toBe(target);
      expect(statSync(path).mode & 0o777).toBe(0o600);
      expect(cli(["init", target, "--out", path]).status).toBe(1);
    }
    expect(
      cli(["init", "figma", "--revision", "invented", "--out", join(dir, "bad.json")]).status,
    ).toBe(1);
  });
  it("previews without mutation, appends only with --write, and preserves existing bytes", () => {
    cpSync(resolve("data"), join(dir, "data"), { recursive: true });
    const note = join(dir, "note.txt");
    writeFileSync(
      note,
      "Reviewed the documented registration policy; only approved test client names are accepted.",
    );
    const args = [
      "record",
      "figma",
      "mcp.as.dcr",
      "partial",
      "--by",
      "test-reviewer",
      "--evidence-file",
      note,
      "--at",
      "2026-10-18T12:00:00Z",
    ];
    const path = join(dir, "data/observations/figma.yaml");
    const before = readFileSync(path, "utf8");
    const preview = cli(args, dir);
    expect(preview.status, preview.stderr).toBe(0);
    expect(parse(preview.stdout)[0]).toMatchObject({ method: "manual", status: "partial" });
    expect(readFileSync(path, "utf8")).toBe(before);
    expect(cli([...args, "--write"], dir).status).toBe(0);
    const after = readFileSync(path, "utf8");
    expect(after.startsWith(before)).toBe(true);
    expect(parse(after).length).toBe(parse(before).length + 1);
    expect(cli([...args, "--write"], dir).status).toBe(1);
    expect(readFileSync(path, "utf8")).toBe(after);
  });
  it("fails closed on malformed config and missing token before creating a report", () => {
    const config = join(dir, "config.json");
    const report = join(dir, "report.json");
    writeFileSync(config, '{"token":"secret-raw-value","recipe":"oops"}');
    const args = ["run", config, "--out", report];
    const invalid = cli(args);
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).not.toContain("secret-raw-value");
    expect(existsSync(report)).toBe(false);
    writeFileSync(
      config,
      JSON.stringify({
        version: 1,
        recipe: "baseline",
        target: "https://lab.example.com/mcp",
        tokenEnv: "MISSING_TEST_TOKEN_UNIQUE",
        context: "Test failure before any network request.",
        request: { method: "tools/list" },
      }),
    );
    expect(cli(args).status).toBe(1);
    expect(existsSync(report)).toBe(false);
  });
});
