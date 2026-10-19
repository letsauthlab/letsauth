import { describe, expect, it } from "vitest";
import {
  branchFor,
  commitMessage,
  describeError,
  redact,
  retryingFetch,
  runStamp,
  upsertPullRequest,
} from "@/scanner/nightly";

interface Call {
  url: string;
  method: string;
  body?: unknown;
  auth?: string;
}

function fakeFetch(existing: { number: number; html_url: string }[]) {
  const calls: Call[] = [];
  const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
    const method = init?.method ?? "GET";
    const headers = init?.headers as Record<string, string> | undefined;
    calls.push({
      url,
      method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      auth: headers?.Authorization,
    });
    if (method === "GET") return Response.json(existing);
    if (method === "PATCH")
      return Response.json({ number: existing[0]?.number, html_url: existing[0]?.html_url });
    if (url.endsWith("/labels")) return new Response(null, { status: 422 });
    return Response.json(
      { number: 42, html_url: "https://github.com/o/r/pull/42" },
      { status: 201 },
    );
  };
  return { calls, fetchImpl };
}

describe("nightly pull request", () => {
  it("creates the pull request for the branch and adds the label", async () => {
    const { calls, fetchImpl } = fakeFetch([]);
    const result = await upsertPullRequest({
      repo: "o/r",
      token: "t",
      head: "scanner/2026-10-14",
      base: "main",
      title: "Scanner: 2026-10-14",
      body: "summary",
      labels: ["data"],
      fetch: fetchImpl,
    });
    expect(result).toEqual({
      action: "created",
      number: 42,
      url: "https://github.com/o/r/pull/42",
    });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET https://api.github.com/repos/o/r/pulls?state=open&head=o%3Ascanner%2F2026-10-14&base=main",
      "POST https://api.github.com/repos/o/r/pulls",
      "POST https://api.github.com/repos/o/r/issues/42/labels",
    ]);
    expect(calls[1]?.body).toEqual({
      title: "Scanner: 2026-10-14",
      head: "scanner/2026-10-14",
      base: "main",
      body: "summary",
    });
    expect(calls.every((c) => c.auth === "Bearer t")).toBe(true);
  });

  it("updates the open pull request for the branch instead of opening a second one", async () => {
    const { calls, fetchImpl } = fakeFetch([
      { number: 7, html_url: "https://github.com/o/r/pull/7" },
    ]);
    const result = await upsertPullRequest({
      repo: "o/r",
      token: "t",
      head: "scanner/2026-10-14",
      base: "main",
      title: "Scanner: 2026-10-14",
      body: "new summary",
      labels: ["data"],
      fetch: fetchImpl,
    });
    expect(result).toEqual({ action: "updated", number: 7, url: "https://github.com/o/r/pull/7" });
    expect(calls.map((c) => c.method)).toEqual(["GET", "PATCH"]);
    expect(calls[1]?.body).toEqual({ title: "Scanner: 2026-10-14", body: "new summary" });
  });

  it("fails loudly on an API error", async () => {
    const fetchImpl = async () => new Response("bad credentials", { status: 401 });
    await expect(
      upsertPullRequest({
        repo: "o/r",
        token: "t",
        head: "h",
        base: "main",
        title: "t",
        body: "b",
        fetch: fetchImpl,
      }),
    ).rejects.toThrow(/listing pull requests: HTTP 401 bad credentials/);
  });

  it("names a new branch per run and the commit by the run time", () => {
    const now = new Date("2026-10-15T09:08:47.762Z");
    expect(branchFor(now)).toBe("scanner/2026-10-15-0908");
    expect(runStamp(now)).toBe("2026-10-15 09:08 UTC");
    expect(commitMessage(runStamp(now), "| a | b |\n")).toBe(
      "Scanner: observations from the run of 2026-10-15 09:08 UTC\n\n| a | b |\n",
    );
  });
});

describe("redact", () => {
  it("removes the token and its basic-auth form from a failed command's message", () => {
    const token = "github_pat_example";
    const header = Buffer.from(`x-access-token:${token}`).toString("base64");
    const message = `Command failed: git -c http.extraheader=AUTHORIZATION: basic ${header} push (${token})`;
    const out = redact(message, [token]);
    expect(out).not.toContain(token);
    expect(out).not.toContain(header);
    expect(out).toBe("Command failed: git -c http.extraheader=AUTHORIZATION: basic *** push (***)");
  });
});

describe("retryingFetch", () => {
  const dropped = () =>
    Object.assign(new TypeError("fetch failed"), {
      cause: Object.assign(new Error("other side closed"), { code: "UND_ERR_SOCKET" }),
    });

  it("tries a dropped request again and returns the response", async () => {
    let calls = 0;
    const flaky = retryingFetch(
      async () => {
        calls++;
        if (calls === 1) throw dropped();
        return new Response("[]", { status: 200 });
      },
      { delayMs: 0 },
    );
    const response = await flaky("https://api.github.com/x");
    expect(response.status).toBe(200);
    expect(calls).toBe(2);
  });

  it("returns an HTTP error status without retrying", async () => {
    let calls = 0;
    const refused = retryingFetch(
      async () => {
        calls++;
        return new Response("nope", { status: 403 });
      },
      { delayMs: 0 },
    );
    expect((await refused("https://api.github.com/x")).status).toBe(403);
    expect(calls).toBe(1);
  });

  it("gives up after the last attempt with the original error", async () => {
    let calls = 0;
    const down = retryingFetch(
      async () => {
        calls++;
        throw dropped();
      },
      { attempts: 3, delayMs: 0 },
    );
    await expect(down("https://api.github.com/x")).rejects.toThrow("fetch failed");
    expect(calls).toBe(3);
  });
});

describe("describeError", () => {
  it("names the cause Node's fetch hides behind 'fetch failed'", () => {
    const error = new TypeError("fetch failed", {
      cause: Object.assign(new Error("getaddrinfo ENOTFOUND api.github.com"), {
        code: "ENOTFOUND",
      }),
    });
    expect(describeError(error)).toBe(
      "fetch failed: getaddrinfo ENOTFOUND api.github.com (ENOTFOUND)",
    );
  });

  it("is the message alone when there is no cause", () => {
    expect(describeError(new Error("listing pull requests: HTTP 401"))).toBe(
      "listing pull requests: HTTP 401",
    );
  });
});

it("publishes successive runs without closing or deleting an earlier pending run", async () => {
  const pending = new Map<string, { number: number; html_url: string; body: string }>();
  const fetchImpl = async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (method === "GET") {
      const head = new URL(url).searchParams.get("head")?.replace("o:", "") ?? "";
      return Response.json(pending.has(head) ? [pending.get(head)] : []);
    }
    expect(method).toBe("POST"); // no closure, branch deletion or supersession comments
    expect(url).toBe("https://api.github.com/repos/o/r/pulls");
    const body = JSON.parse(String(init?.body));
    const pr = {
      number: pending.size + 1,
      html_url: "https://github.com/o/r/pull/1",
      body: body.body,
    };
    pending.set(body.head, pr);
    return Response.json(pr, { status: 201 });
  };
  for (const [head, body] of [
    ["scanner/older", "success evidence"],
    ["scanner/newer", "endpoint unavailable"],
  ]) {
    await upsertPullRequest({
      repo: "o/r",
      token: "t",
      head: head ?? "",
      base: "main",
      title: "Scan",
      body: body ?? "",
      fetch: fetchImpl,
    });
  }
  expect(pending.size).toBe(2);
  expect(pending.get("scanner/older")?.body).toBe("success evidence");
});
