import type { FeatureLevel, ObservationStatus } from "../schema";

/**
 * The scan summary (spec 017, replacing the 004 grade). Applied to one report's checks with the
 * level each feature has in the judged revision. It counts the statuses the rows show, per
 * requirement level, and adds nothing of its own: no letter, no score, no single verdict, and
 * nothing to sort servers by. `unknown` is counted as unknown, never as unsupported.
 */

export interface Summarizable {
  /** The feature id; needed for the either-or rule below. */
  feature?: string;
  name: string;
  level: FeatureLevel;
  status: ObservationStatus;
}

export interface LevelTally {
  level: FeatureLevel;
  total: number;
  /** Statuses with at least one check, in STATUS order. */
  counts: { status: ObservationStatus; n: number }[];
}

export interface OpenCheck {
  feature?: string;
  name: string;
  level: FeatureLevel;
  /** The status the check counts with (the either-or rule may differ from the row). */
  status: ObservationStatus;
}

export interface Summary {
  state: "scanned" | "not-scanned" | "no-oauth";
  /** The counts in one line of words, or "Not scanned" / "No OAuth". */
  label: string;
  tallies: LevelTally[];
  /** Checks that are not supported (and apply), in report order, with the status they count with. */
  open: OpenCheck[];
  /** Plain sentences: how the either-or rule counted a check, or why there are no counts. */
  notes: string[];
}

export const SUMMARY_RULE: readonly string[] = [
  "Each check shows the status of its newest scanner observation, with the evidence and the date.",
  "The summary counts those statuses for each requirement level: MUST, SHOULD and MAY. It adds nothing the rows do not show.",
  "There is no grade and no score. The levels are not added up into one number, and the atlas never sorts servers by a scan.",
  "Unknown means the scanner could not establish the check. It is counted as unknown, never as unsupported.",
  "Some MUST requirements can be met in either of two ways. Protected resource metadata may be served at a well-known location or announced in the WWW-Authenticate challenge the endpoint returns to an unauthenticated request; the scanner reads both. When one way is supported, the other counts as supported too. When one way is unknown, a failing other way counts as unknown.",
  "Deprecated requirements are listed and counted under their own level.",
  "Servers whose auth class is API key or no authentication are not scanned: there is no OAuth authorization to check. The class is an evidenced statement on the server, not the directory's claim.",
];

/**
 * MUST-level requirements a server meets through either of two mechanisms (feature → its
 * alternative, in both directions). The specification asks for one of them, so one failing
 * alone fails nothing.
 */
export const EITHER_OR: Readonly<Record<string, string>> = {
  "mcp.prm.well-known": "mcp.prm.www-authenticate",
  "mcp.prm.www-authenticate": "mcp.prm.well-known",
};

const LEVELS: FeatureLevel[] = ["MUST", "SHOULD", "MAY", "DEPRECATED", "REMOVED"];
const STATUSES: ObservationStatus[] = [
  "supported",
  "partial",
  "unsupported",
  "unknown",
  "not-applicable",
];
const WORD: Record<ObservationStatus, string> = {
  supported: "supported",
  partial: "partial",
  unsupported: "unsupported",
  unknown: "unknown",
  "not-applicable": "not applicable",
};

const failing = (s: ObservationStatus) => s === "unsupported" || s === "partial";

/**
 * The status a check counts with under the either-or rule; the alternative may be absent. A
 * member that is not supported counts as supported when the other is; a failing member counts
 * as unknown while the other is unknown; both failing fail.
 */
export function effective(c: Summarizable, checks: readonly Summarizable[]): ObservationStatus {
  const other = c.feature ? EITHER_OR[c.feature] : undefined;
  if (!other || c.status === "supported") return c.status;
  const alt = checks.find((x) => x.feature === other)?.status ?? "unknown";
  if (alt === "supported") return "supported";
  if (!failing(c.status)) return c.status;
  return failing(alt) ? c.status : "unknown";
}

/** One level's counts in words: `MUST 9 supported, 1 unsupported`. */
export const tallyLine = (t: LevelTally) =>
  `${t.level} ${t.counts.map((c) => `${c.n} ${WORD[c.status]}`).join(", ")}`;

export function summarize(input: readonly Summarizable[]): Summary {
  const notes: string[] = [];
  const checks = input.map((c) => {
    const status = effective(c, input);
    if (status !== c.status) {
      const other = input.find((x) => x.feature === (c.feature && EITHER_OR[c.feature]));
      const otherName = other?.name ?? "the other way";
      notes.push(
        status === "supported"
          ? `${c.name} counts as supported because ${otherName} is supported; the specification asks for one of the two.`
          : `${c.name} counts as unknown while ${otherName} is unknown; the specification asks for one of the two.`,
      );
    }
    return { ...c, status };
  });
  const tallies: LevelTally[] = LEVELS.flatMap((level) => {
    const at = checks.filter((c) => c.level === level);
    if (at.length === 0) return [];
    const counts = STATUSES.map((status) => ({
      status,
      n: at.filter((c) => c.status === status).length,
    })).filter((c) => c.n > 0);
    return [{ level, total: at.length, counts }];
  });
  const open = checks
    .filter((c) => c.status !== "supported" && c.status !== "not-applicable")
    .map(({ feature, name, level, status }) => ({ feature, name, level, status }));
  return {
    state: "scanned",
    label: tallies.map(tallyLine).join(" · "),
    tallies,
    open,
    notes,
  };
}

/** The summary shown for a server that has no scanner observation at all. */
export const NOT_SCANNED: Summary = {
  state: "not-scanned",
  label: "Not scanned",
  tallies: [],
  open: [],
  notes: [],
};

/**
 * The summary shown for a server whose auth class says it uses no OAuth (009); such servers are
 * not scanned. `how` is the class as the server file states it, for the note.
 */
export function noOAuth(how: "api-key" | "none"): Summary {
  return {
    state: "no-oauth",
    label: "No OAuth",
    tallies: [],
    open: [],
    notes: [
      how === "api-key"
        ? "Auth class API key: there is no OAuth authorization to check."
        : "Auth class no authentication: there is no OAuth authorization to check.",
    ],
  };
}
