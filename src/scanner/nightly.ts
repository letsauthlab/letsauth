/**
 * The nightly run's GitHub side: open one pull request for the branch the run pushed, or update
 * the open one for that branch. Everything else the nightly job does (clone, scan, validate,
 * commit, push) is plain git and pnpm in scripts/scan-nightly.ts; this module is the part worth
 * testing without a network, so `fetch` is injected.
 */

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface PullRequestOptions {
  /** `owner/name` */
  repo: string;
  /** a fine-grained token with contents and pull requests write on the repository */
  token: string;
  /** the branch the run pushed, e.g. `scanner/2026-10-14-0317` */
  head: string;
  /** the base branch, normally `main` */
  base: string;
  title: string;
  /** the run summary (Markdown) */
  body: string;
  /** labels to add on creation; a missing label is ignored */
  labels?: string[];
  fetch?: FetchLike;
  apiBase?: string;
}

export interface PullRequestResult {
  action: "created" | "updated";
  number: number;
  url: string;
}

interface PullRequestJson {
  number: number;
  html_url: string;
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
    "User-Agent": "letsauth-scanner-nightly",
  };
}

async function expectOk(response: Response, what: string): Promise<unknown> {
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${what}: HTTP ${response.status}${text ? ` ${text.slice(0, 300)}` : ""}`);
  }
  return response.json();
}

/** Creates the pull request for `head`, or updates the open one's body when it already exists. */
export async function upsertPullRequest(options: PullRequestOptions): Promise<PullRequestResult> {
  const fetchImpl = options.fetch ?? fetch;
  const api = (options.apiBase ?? "https://api.github.com").replace(/\/+$/, "");
  const [owner] = options.repo.split("/");
  const h = headers(options.token);
  const base = `${api}/repos/${options.repo}`;

  const listUrl = `${base}/pulls?state=open&head=${encodeURIComponent(`${owner}:${options.head}`)}&base=${encodeURIComponent(options.base)}`;
  const existing = (await expectOk(
    await fetchImpl(listUrl, { headers: h }),
    "listing pull requests",
  )) as PullRequestJson[];

  const first = existing[0];
  if (first) {
    const updated = (await expectOk(
      await fetchImpl(`${base}/pulls/${first.number}`, {
        method: "PATCH",
        headers: h,
        body: JSON.stringify({ title: options.title, body: options.body }),
      }),
      "updating the pull request",
    )) as PullRequestJson;
    return { action: "updated", number: updated.number, url: updated.html_url };
  }

  const created = (await expectOk(
    await fetchImpl(`${base}/pulls`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        title: options.title,
        head: options.head,
        base: options.base,
        body: options.body,
      }),
    }),
    "creating the pull request",
  )) as PullRequestJson;

  if (options.labels?.length) {
    // a label that does not exist in the repository makes GitHub answer 422; the pull request
    // is still fine without it
    await fetchImpl(`${base}/issues/${created.number}/labels`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ labels: options.labels }),
    }).catch(() => undefined);
  }
  return { action: "created", number: created.number, url: created.html_url };
}

/**
 * Wraps `fetchImpl` so a request that fails before any response (a dropped connection, a reset,
 * a DNS hiccup: Node's "fetch failed") is tried again after a pause. An HTTP error status is a
 * response and is returned as is. The nightly run talks to GitHub once at the start and again
 * after a scan of several minutes, long enough for an idle kept-alive connection to be dropped
 * on the way.
 */
export function retryingFetch(
  fetchImpl: FetchLike,
  options: { attempts?: number; delayMs?: number } = {},
): FetchLike {
  const attempts = options.attempts ?? 3;
  const delayMs = options.delayMs ?? 2000;
  return async (url, init) => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await fetchImpl(url, init);
      } catch (error) {
        if (attempt >= attempts) throw error;
        console.warn(`${describeError(error)}; retrying (${attempt + 1} of ${attempts})`);
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
  };
}

/**
 * An error's message with its causes, e.g. `fetch failed: other side closed (UND_ERR_SOCKET)`:
 * Node's fetch says only "fetch failed" and keeps the reason in `cause`.
 */
export function describeError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current !== undefined && current !== null && depth < 4; depth++) {
    if (current instanceof Error) {
      const code = (current as { code?: unknown }).code;
      parts.push(typeof code === "string" ? `${current.message} (${code})` : current.message);
      current = current.cause;
    } else {
      parts.push(String(current));
      break;
    }
  }
  return parts.join(": ");
}

/** Replaces every secret (and its base64 forms in an Authorization header) in `text` with ***. */
export function redact(text: string, secrets: readonly string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (!secret) continue;
    for (const form of [secret, Buffer.from(`x-access-token:${secret}`).toString("base64")]) {
      out = out.split(form).join("***");
    }
  }
  return out;
}

/** The commit message of a nightly run: subject line, blank line, the summary. */
export function commitMessage(stamp: string, summary: string): string {
  return `Scanner: observations from the run of ${stamp}\n\n${summary.trim()}\n`;
}

/** `2026-10-15 03:17 UTC` for a run started at `now`. */
export function runStamp(now: Date): string {
  return `${now.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/**
 * The branch a run started at `now` pushes to, e.g. `scanner/2026-10-15-0317`. Unique per run
 * (to the minute; the job runs with concurrency 1), so a push never has to overwrite a branch.
 */
export function branchFor(now: Date): string {
  const iso = now.toISOString();
  return `scanner/${iso.slice(0, 10)}-${iso.slice(11, 13)}${iso.slice(14, 16)}`;
}
