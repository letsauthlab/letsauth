import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

for (const file of ["deploy.yml", "scanner-deploy.yml"]) {
  const workflow = parse(
    readFileSync(new URL(`../../.github/workflows/${file}`, import.meta.url), "utf8"),
  );
  const job = workflow.jobs.deploy;
  describe(`${file} production boundaries`, () => {
    const trusted = {
      event_name: "workflow_run",
      repository: "o/r",
      ref: "refs/heads/main",
      event: {
        workflow_run: {
          conclusion: "success",
          event: "push",
          head_branch: "main",
          head_repository: { full_name: "o/r" },
        },
      },
    };
    // The Actions condition uses the same comparisons/booleans as JavaScript; evaluate the
    // actual YAML expression against adversarial event payloads rather than copying the policy.
    const allowed = (github: unknown) => new Function("github", `return (${job.if});`)(github);
    it("accepts only successful push CI from this repository's main, or manual main", () => {
      expect(allowed(trusted)).toBe(true);
      const run = trusted.event.workflow_run;
      for (const change of [
        { event: "pull_request" },
        { head_repository: { full_name: "attacker/fork" } },
        { head_branch: "feature" },
        { conclusion: "failure" },
      ]) {
        expect(allowed({ ...trusted, event: { workflow_run: { ...run, ...change } } })).toBe(false);
      }
      expect(allowed({ ...trusted, event_name: "workflow_dispatch" })).toBe(true);
      expect(
        allowed({ ...trusted, event_name: "workflow_dispatch", ref: "refs/heads/feature" }),
      ).toBe(false);
    });
    it("skips a stale commit and gates every subsequent step", () => {
      expect(workflow.concurrency["cancel-in-progress"]).toBe(false);
      const gate = job.steps[0];
      expect(gate.id).toBe("current");
      for (const step of job.steps.slice(1))
        expect(step.if).toBe("steps.current.outputs.deploy == 'true'");
      const dir = mkdtempSync(join(tmpdir(), "deploy-gate-"));
      try {
        const gh = join(dir, "gh");
        writeFileSync(gh, '#!/bin/sh\nprintf "%s\\n" "$REMOTE_SHA"\n');
        chmodSync(gh, 0o755);
        for (const remote of ["newer", "tested"]) {
          const output = join(dir, remote);
          const result = spawnSync("bash", ["-c", gate.run], {
            encoding: "utf8",
            env: {
              ...process.env,
              PATH: `${dir}:${process.env.PATH}`,
              GITHUB_OUTPUT: output,
              GITHUB_REPOSITORY: "o/r",
              EXPECTED_SHA: "tested",
              REMOTE_SHA: remote,
            },
          });
          expect(result.status, result.stderr).toBe(0);
          expect(readFileSync(output, "utf8").trim()).toBe(`deploy=${remote === "tested"}`);
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
}
