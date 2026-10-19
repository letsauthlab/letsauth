import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const root = new URL("../../", import.meta.url);
const workflow = parse(readFileSync(new URL(".github/workflows/deploy.yml", root), "utf8"));
const job = workflow.jobs.deploy;

describe("official Bunny Sites deployment", () => {
  it("publishes only the built directory through one pinned vendor action", () => {
    const actions = job.steps.filter((step: { uses?: string }) =>
      step.uses?.startsWith("BunnyWay/actions/deploy-site@"),
    );
    expect(actions).toHaveLength(1);
    const deploy = actions[0];
    expect(deploy.uses).toBe(
      "BunnyWay/actions/deploy-site@4b22fe0b319386b3913117daf97729409dd0a6ef",
    );
    expect(deploy.if).toBe("steps.current.outputs.deploy == 'true'");
    expect(deploy.with).toEqual({
      site: `\${{ vars.BUNNY_SITE }}`,
      directory: "dist",
      api_key: `\${{ secrets.BUNNY_API_KEY }}`,
      cli_version: "0.20.0",
      deployments: "false",
    });
    expect(job.steps.findIndex((step: { run?: string }) => step.run === "pnpm build")).toBeLessThan(
      job.steps.indexOf(deploy),
    );
    expect(job.steps.at(-1)).toBe(deploy);
  });

  it("retains the protected environment without extra write permissions or a custom publisher", () => {
    expect(job.environment).toBe("production");
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(job.permissions).toBeUndefined();
    const yaml = JSON.stringify(workflow);
    expect(yaml).not.toMatch(/BUNNY_STORAGE_|BUNNY_PULL_ZONE_ID|purgeCache|deploy-storage/);
    for (const path of ["scripts/deploy-storage.ts", "scripts/lib/storage.ts"]) {
      expect(existsSync(new URL(path, root))).toBe(false);
    }
  });
});
