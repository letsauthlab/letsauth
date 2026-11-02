/**
 * Pending scanner evidence (spec 018). Earlier scanner pull requests stay open until a person
 * merges them (spec 014), so `main` alone does not say what the scanner has already reported.
 * Before a nightly scan the run lays the observations of every open scanner pull request over
 * its clone of `main`, so the append rule compares with them too; after the scan it keeps only
 * what was appended on top of that overlay and puts it back onto `main`'s files. A run opens a
 * pull request only when it saw something that neither `main` nor a pending pull request
 * carries, and the pull request it opens carries only that.
 *
 * The functions here are pure text in, text out; the git and GitHub side is in
 * scripts/scan-nightly.ts and `listPendingScannerPulls` (nightly.ts).
 */
import { parse, stringify } from "yaml";

/** The same entry, whatever order its keys were written in. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function entriesOf(text: string): unknown[] {
  if (text.trim() === "") return [];
  const parsed = parse(text) as unknown;
  if (parsed === null || parsed === undefined) return [];
  if (!Array.isArray(parsed)) throw new Error("an observations file is not a YAML list");
  return parsed;
}

/**
 * The entries of `branchText` (a pending pull request's version of an observations file) that
 * `baseText` (the same file as the run sees it) does not have, in the branch's order. An entry
 * merged since, or carried over from an earlier pending pull request, is not repeated.
 */
export function pendingEntries(baseText: string, branchText: string): unknown[] {
  const seen = new Set(entriesOf(baseText).map(canonical));
  const out: unknown[] = [];
  for (const entry of entriesOf(branchText)) {
    const key = canonical(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

/** `text` with `entries` appended in the scanner's own YAML form (`appendObservations`). */
export function withEntries(text: string, entries: unknown[]): string {
  if (entries.length === 0) return text;
  const prefix = text === "" || text.endsWith("\n") ? text : `${text}\n`;
  return `${prefix}${stringify(entries, { lineWidth: 0 })}`;
}

/**
 * What a scan appended to a file: the text after `before`. Throws when `after` does not start
 * with `before`, which would mean an existing entry was edited, never something to carry on.
 */
export function appendedText(before: string, after: string): string {
  if (!after.startsWith(before)) {
    throw new Error("the scan changed an existing observation instead of appending");
  }
  return after.slice(before.length);
}

/** `appended` (from `appendedText`) put at the end of `base`. */
export function onto(base: string, appended: string): string {
  if (appended === "") return base;
  const prefix = base === "" || base.endsWith("\n") ? base : `${base}\n`;
  return `${prefix}${appended}`;
}
