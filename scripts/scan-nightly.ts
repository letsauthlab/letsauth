/**
 * The nightly run (specs/004-scanner, research R8): the command a Scaleway Serverless Job
 * executes on its cron schedule from the scanner image.
 *
 *   SCANNER_APP_ID, SCANNER_APP_PRIVATE_KEY
 *                     preferred: the scanner's GitHub App. Each run mints an installation token
 *                     valid for one hour, limited to the repository; commits and pull requests
 *                     show up as <app-slug>[bot]
 *   SCANNER_TOKEN     fallback when no App is configured: a fine-grained personal token with
 *                     contents and pull requests write on the repository
 *   SCANNER_REPO      owner/name (default letsauthlab/letsauth)
 *   SCANNER_BASE      base branch (default main)
 *   SCANNER_WORKDIR   where to clone (default a fresh directory under the system temp dir)
 *
 * Steps: shallow-clone the base branch, install, `pnpm scan --all --write --summary`, validate
 * the data and the append-only rule, and when anything under data/observations changed commit
 * to a new branch scanner/<date>-<hhmm>, push it, open one pull request whose description is the
 * run summary. Earlier pull requests retain their evidence for review. Nothing is merged
 * without review. Exit 0 when nothing changed or the pull request is up; exit 1 when a step fails.
 *
 * The token never appears in a command line, a remote URL, the clone's config or a log line:
 * git reads the auth header from GIT_CONFIG_* environment variables, child processes never write
 * to the job's output directly (their output is captured and redacted first), and everything
 * this process writes to stdout and stderr passes through `redact`.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installationToken } from "../src/scanner/github-app";
import {
  branchFor,
  commitMessage,
  describeError,
  redact,
  retryingFetch,
  runStamp,
  upsertPullRequest,
} from "../src/scanner/nightly";

const SECRET_VARS = ["SCANNER_TOKEN", "SCANNER_APP_PRIVATE_KEY"] as const;

// every GitHub API call goes through this: a request dropped before any response is retried
const github = retryingFetch(fetch);

// everything that must never be printed; filled before the first line is written
const secrets: string[] = SECRET_VARS.flatMap((name) => {
  const value = process.env[name];
  if (!value) return [];
  // a PEM is also matched line by line, in case one line of it ends up in a message
  return [value, ...value.split(/\\n|\n/).filter((line) => line.length >= 16)];
});
const safe = (text: string) => redact(text, secrets);

// last line of defence: whatever this process prints, by any path, is redacted on the way out
for (const stream of [process.stdout, process.stderr]) {
  const write = stream.write.bind(stream) as (chunk: unknown, ...rest: unknown[]) => boolean;
  stream.write = ((chunk: unknown, ...rest: unknown[]) =>
    write(
      typeof chunk === "string" || Buffer.isBuffer(chunk) ? safe(String(chunk)) : chunk,
      ...rest,
    )) as typeof stream.write;
}

interface Credentials {
  token: string;
  name: string;
  email: string;
  via: string;
}

async function credentials(): Promise<Credentials> {
  const appId = process.env.SCANNER_APP_ID;
  const privateKey = process.env.SCANNER_APP_PRIVATE_KEY;
  if (appId && privateKey) {
    const minted = await installationToken({
      credentials: { appId, privateKey },
      repo,
      fetch: github,
    });
    secrets.push(minted.token);
    return { ...minted, via: `GitHub App ${minted.name}, token valid until ${minted.expiresAt}` };
  }
  const token = process.env.SCANNER_TOKEN;
  if (token) {
    return {
      token,
      name: "letsauth scanner",
      email: "scanner@letsauth.eu",
      via: "personal token (SCANNER_TOKEN)",
    };
  }
  throw new Error(
    "neither SCANNER_APP_ID with SCANNER_APP_PRIVATE_KEY nor SCANNER_TOKEN is set; the nightly run cannot push or open a pull request",
  );
}

const repo = process.env.SCANNER_REPO ?? "letsauthlab/letsauth";
const base = process.env.SCANNER_BASE ?? "main";
const workdir = process.env.SCANNER_WORKDIR ?? mkdtempSync(join(tmpdir(), "letsauth-scan-"));
const now = new Date();
const stamp = runStamp(now);
const branch = branchFor(now);

function withoutSecrets(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const name of [...SECRET_VARS, "SCANNER_APP_ID"]) delete env[name];
  return env;
}

// git takes the auth header from the environment (GIT_CONFIG_COUNT/KEY/VALUE), so it is never
// part of an argument list that an error message or a process listing could show
let gitEnv: NodeJS.ProcessEnv = withoutSecrets();
function authenticateGit(token: string): void {
  gitEnv = {
    ...withoutSecrets(),
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`,
    GIT_TERMINAL_PROMPT: "0",
  };
}

interface RunOptions {
  cwd?: string;
}

/**
 * Runs a command with its output captured, never inherited, so it reaches the log only through
 * the redacting streams above. Throws on a non-zero exit with a redacted message.
 */
function run(cmd: string, args: string[], options: RunOptions = {}): string {
  console.log(`$ ${[cmd, ...args].join(" ")}`);
  // git gets the auth environment; pnpm and the scanner never see the token
  const env = cmd === "git" ? gitEnv : withoutSecrets();
  const result = spawnSync(cmd, args, {
    cwd: options.cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw new Error(safe(`${cmd}: ${result.error.message}`));
  if (result.status !== 0) {
    throw new Error(safe(`${cmd} ${args[0] ?? ""} exited with ${result.status ?? result.signal}`));
  }
  return result.stdout ?? "";
}

const inRepo: RunOptions = { cwd: workdir };

async function main(): Promise<void> {
  try {
    const auth = await credentials();
    const token = auth.token;
    authenticateGit(token);
    console.log(`authenticated as ${auth.via}`);
    run("git", [
      "clone",
      "--depth",
      "1",
      "--branch",
      base,
      `https://github.com/${repo}.git`,
      workdir,
    ]);
    // --prod=false: the image sets NODE_ENV=production and tsx is a dev dependency
    run("pnpm", ["install", "--frozen-lockfile", "--prod=false", "--prefer-offline"], inRepo);

    // a refused or failing server exits 1 but the others are still written; the summary says which
    try {
      run("pnpm", ["scan", "--all", "--write", "--summary", "scan-summary.md"], inRepo);
    } catch {
      console.warn("some servers could not be scanned; see the summary");
    }

    run("pnpm", ["validate:data"], inRepo);
    run("pnpm", ["check:append-only", "HEAD"], inRepo);

    const changed = run("git", ["status", "--porcelain", "--", "data/observations"], inRepo).trim();
    if (!changed) {
      console.log("nothing to append");
      process.exit(0);
    }

    const summary = readFileSync(join(workdir, "scan-summary.md"), "utf8");
    run("git", ["config", "user.name", auth.name], inRepo);
    run("git", ["config", "user.email", auth.email], inRepo);
    run("git", ["checkout", "-B", branch], inRepo);
    run("git", ["add", "data/observations"], inRepo);
    run("git", ["commit", "-q", "-m", commitMessage(stamp, summary)], inRepo);
    // a new branch per run: a plain push, nothing to overwrite
    run("git", ["push", "origin", `HEAD:refs/heads/${branch}`], inRepo);

    const pr = await upsertPullRequest({
      repo,
      token,
      head: branch,
      base,
      title: `Scanner: ${stamp}`,
      body: summary,
      labels: ["data"],
      fetch: github,
    });
    console.log(`${pr.action} pull request #${pr.number}: ${pr.url}`);
  } catch (error) {
    console.error(safe(describeError(error)));
    process.exit(1);
  } finally {
    if (!process.env.SCANNER_WORKDIR) rmSync(workdir, { recursive: true, force: true });
  }
}

main();
