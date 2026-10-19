import {
  closeSync,
  fstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { stringify } from "yaml";
import { ZodError } from "zod";
import { getDataset } from "../src/lib/data";
import {
  configSchema,
  oauthOptionsSchema,
  plan,
  recipes,
  redact,
  reportSchema,
  resolveTarget,
} from "../src/scanner/investigation/model";
import { login } from "../src/scanner/investigation/oauth";
import { observation } from "../src/scanner/investigation/record";
import { run, token, validateRun } from "../src/scanner/investigation/run";
import { nodeTransport } from "../src/scanner/investigation/transport";
import { appendObservations } from "../src/scanner/observations";

const HELP = `Usage: pnpm investigate <command> [arguments]

  list [--json]
  check <server-id|https-url> --out <report.json> [--recipe baseline|invalid-token]
        [--scope <scopes>] [--client-id <id>] [--client-secret-env <name>]
        [--client-metadata-url <url>] [--callback-port <port>] [--json]
  init <server-id|https-url> --out <config.json> [--revision <id>]
  plan <server-id|https-url> [--revision <id>] [--out <plan.json>] [--json]
  run <config.json> --out <report.json> [--login] [--json]
  record <server> <feature> <status> --by <handle> --evidence-file <note.txt>
         [--revision <id>] [--at <UTC-time>] [--report <report.json>]
         [--write | --out <draft.yaml>]

check opens interactive OAuth login, then runs a local check. You complete browser consent.
For advanced checks, init/edit a configuration and run --login (or supply tokenEnv yourself).
Plans are optional checklists. Only check/run contact the network. Use accounts/endpoints you
are permitted to test. No domain ownership proof or persistent credential store is required.
record previews YAML; --write appends a validated manual observation to data/observations/.
No command pushes or publishes data. Existing files are never overwritten by --out.
Exit codes: 0 completed/review required; 1 input/login failure; 2 inconclusive investigation.
Recipes, configurations, cleanup and interpretation: docs/investigations.md
`;

const options = {
  list: { json: { type: "boolean" } },
  check: {
    out: { type: "string" },
    recipe: { type: "string" },
    json: { type: "boolean" },
    scope: { type: "string" },
    "client-id": { type: "string" },
    "client-secret-env": { type: "string" },
    "client-metadata-url": { type: "string" },
    "callback-port": { type: "string" },
  },
  init: { out: { type: "string" }, revision: { type: "string" } },
  plan: { json: { type: "boolean" }, revision: { type: "string" }, out: { type: "string" } },
  run: { out: { type: "string" }, json: { type: "boolean" }, login: { type: "boolean" } },
  record: {
    by: { type: "string" },
    "evidence-file": { type: "string" },
    revision: { type: "string" },
    at: { type: "string" },
    report: { type: "string" },
    write: { type: "boolean" },
    out: { type: "string" },
  },
} as const;

function read(path: string): string {
  const fd = openSync(path, "r");
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > 1_048_576)
      throw new Error("input must be a regular file of at most 1 MiB");
    return readFileSync(fd, "utf8");
  } finally {
    closeSync(fd);
  }
}

/** Reserve output before side effects; private file, exclusive creation, no atlas artifact writes. */
function output(path: string) {
  const dest = resolve(path);
  const fromData = relative(resolve("data"), dest);
  if (fromData === "" || (!fromData.startsWith("../") && fromData !== ".."))
    throw new Error("--out must be outside data/; use record --write for observations");
  mkdirSync(dirname(dest), { recursive: true, mode: 0o700 });
  const fd = openSync(dest, "wx", 0o600);
  let written = false;
  return {
    write(text: string) {
      writeFileSync(fd, text);
      written = true;
    },
    close() {
      closeSync(fd);
      if (!written) unlinkSync(dest);
    },
  };
}
function save(path: string, text: string) {
  const file = output(path);
  try {
    file.write(text);
  } finally {
    file.close();
  }
}
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

async function main(): Promise<number> {
  const [command, ...args] = process.argv.slice(2);
  if (
    !command ||
    command === "help" ||
    command === "--help" ||
    (args.length === 1 && args[0] === "--help")
  ) {
    console.log(HELP);
    return 0;
  }
  if (!Object.hasOwn(options, command))
    throw new Error("unknown command; run pnpm investigate --help");
  const parsed = parseArgs({
    args,
    options: options[command as keyof typeof options],
    allowPositionals: true,
    strict: true,
  });
  const pos = parsed.positionals;
  const values = parsed.values as Record<string, string | boolean | undefined>;
  const flag = (key: string): string | undefined =>
    typeof values[key] === "string" ? (values[key] as string) : undefined;
  const required = (key: string): string => {
    const v = flag(key);
    if (!v) throw new Error(`--${key} is required`);
    return v;
  };
  const count = command === "list" ? 0 : command === "record" ? 3 : 1;
  if (pos.length !== count)
    throw new Error(`${command} expects ${count} positional argument(s); see --help`);
  if (command === "list") {
    console.log(
      values.json
        ? json(recipes)
        : Object.entries(recipes)
            .map(([id, r]) => `${id.padEnd(16)} ${r.title}\n  ${r.steps.join("\n  ")}`)
            .join("\n\n"),
    );
    return 0;
  }
  const target = pos[0] as string;
  const data = getDataset();
  if (command === "init") {
    const resolved = resolveTarget(data, target);
    const selected = plan(data, target, flag("revision")).revision;
    const config = configSchema.parse({
      version: 1,
      recipe: "baseline",
      ...resolved,
      revision: selected,
      context: "Describe the test account, granted scopes and expected operation here.",
      tokenEnv: "LETSAUTH_TOKEN",
      request: { method: "tools/list", params: {} },
    });
    save(required("out"), json(config));
    console.log(
      `Configuration saved to ${flag("out")}. Edit context, recipe and operation.\nRun with interactive OAuth login:\n  pnpm investigate run ${flag("out")} --login --out <report.json>\nSee docs/investigations.md for comparisons and recording findings.`,
    );
    return 0;
  }
  if (command === "plan") {
    const result = plan(data, target, flag("revision"));
    if (flag("out")) save(required("out"), json(result));
    console.log(
      values.json
        ? json(result)
        : `${result.target} · revision ${result.revision}\n\nStart with: ${result.passive}\n\n${result.recipes.map((r) => `${r.id}: ${r.title}\n${r.steps.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}`).join("\n\n")}\n\nManual/source checks:\n${result.manual.map((m) => `  ${m.feature}: ${m.question}`).join("\n")}\n\n${result.limits}${flag("out") ? `\nPlan saved to ${flag("out")}` : ""}`,
    );
    return 0;
  }
  if (command === "run" || command === "check") {
    const interactive = command === "check" || values.login === true;
    if (
      command === "check" &&
      flag("recipe") &&
      !["baseline", "invalid-token"].includes(required("recipe"))
    )
      throw new Error(
        "check supports baseline or invalid-token; use init and run for comparison recipes",
      );
    const config = configSchema.parse(
      command === "run"
        ? JSON.parse(read(target))
        : {
            version: 1,
            recipe: flag("recipe") ?? "baseline",
            ...resolveTarget(data, target),
            tokenEnv: "LETSAUTH_TOKEN",
            request: { method: "tools/list", params: {} },
            context: "Local human-operated investigation using interactive OAuth and tools/list.",
            oauth: {
              clientId: flag("client-id"),
              clientSecretEnv: flag("client-secret-env"),
              clientMetadataUrl: flag("client-metadata-url"),
              scope: flag("scope"),
              callbackPort: flag("callback-port") ? Number(required("callback-port")) : undefined,
            },
          },
    );
    validateRun(config, data);
    if (interactive && (config.recipe === "dcr" || config.recipe === "revocation"))
      throw new Error(
        "--login is for MCP baselines/comparisons; DCR and paired revocation use supplied tokens",
      );
    // Validate comparison credentials before initiating browser consent or registering a client.
    token(process.env, config.comparisonTokenEnv);
    const baseline = config.baseline
      ? reportSchema.parse(JSON.parse(read(resolve(dirname(resolve(target)), config.baseline))))
      : undefined;
    const file = output(required("out"));
    const runEnv = { ...process.env };
    try {
      if (interactive && config.tokenEnv)
        runEnv[config.tokenEnv] = await login(
          config.target,
          oauthOptionsSchema.parse(config.oauth ?? {}),
        );
      const result = await run(config, data, nodeTransport(), runEnv, baseline);
      file.write(json(result));
      console.log(
        values.json
          ? json(result)
          : `${result.recipe}: ${result.conclusion}\n${result.samples.map((s) => `  ${s.label} / ${s.stage}: ${s.outcome} (HTTP ${s.status ?? "none"}${s.authError ? `, ${s.authError}` : ""})`).join("\n")}\nEvidence saved to ${flag("out")}. Review before recording an atlas observation.`,
      );
      return result.conclusion === "inconclusive" ? 2 : 0;
    } finally {
      if (config.tokenEnv) delete runEnv[config.tokenEnv];
      file.close();
    }
  }
  if (values.write && flag("out")) throw new Error("choose --write or --out, not both");
  const report = flag("report")
    ? reportSchema.parse(JSON.parse(read(required("report"))))
    : undefined;
  const entry = observation(data, {
    server: target,
    feature: pos[1] as string,
    status: pos[2] as string,
    by: required("by"),
    evidence: read(required("evidence-file")),
    revision: flag("revision"),
    at: flag("at"),
    report,
  });
  const yaml = stringify([entry], { lineWidth: 0 });
  if (values.write) {
    appendObservations(join("data", "observations", `${entry.server}.yaml`), [entry]);
    console.log(
      `Appended manual observation to data/observations/${entry.server}.yaml. Next: pnpm validate:data, review diff, open a PR.`,
    );
  } else if (flag("out")) {
    save(required("out"), yaml);
    console.log(`Observation draft saved to ${flag("out")}; atlas unchanged.`);
  } else process.stdout.write(yaml);
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    // Do not stringify input JSON, network exceptions, tokens or Zod's received values.
    const message =
      error instanceof ZodError
        ? error.issues
            .map((i) => `invalid field ${i.path.join(".") || "configuration"}: ${i.code}`)
            .join("\n")
        : error instanceof SyntaxError
          ? "invalid JSON input"
          : error instanceof Error
            ? error.message
            : "investigation failed";
    console.error(redact(message));
    process.exitCode = 1;
  });
