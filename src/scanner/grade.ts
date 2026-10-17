import type { FeatureLevel, ObservationStatus } from "../schema";

/**
 * The grade rule (spec FR-008). Applied to one report's checks with the level each feature has in
 * the judged revision. Derived from the statuses alone, published next to every grade, never
 * used to rank servers. `unknown` never lowers a grade: a MUST unknown withholds it instead.
 */

export type GradeLetter = "A" | "B" | "C" | "F";

export interface Grade {
  letter: GradeLetter | null;
  /** "A" … "F", "Withheld", "Not scanned" or "No OAuth". */
  label: string;
  reasons: string[];
}

export interface Gradable {
  /** The feature id; needed for the either-or rule below. */
  feature?: string;
  name: string;
  level: FeatureLevel;
  status: ObservationStatus;
}

export const GRADE_RULE: readonly string[] = [
  "F when a MUST-level check is unsupported or partial.",
  "Withheld (no letter) when a MUST-level check is unknown: the scanner could not establish it.",
  "C when every MUST-level check is supported and a SHOULD-level check is unsupported or partial.",
  "B when every MUST-level check is supported, no SHOULD-level check fails, and a SHOULD-level check is unknown.",
  "A when every MUST-level and SHOULD-level check is supported.",
  "A MUST the server may meet in either of two ways is met when either way is supported, and counts as unknown, not unsupported, while the other way is unknown: protected resource metadata may be served at a well-known location or announced in the WWW-Authenticate challenge the endpoint returns to an unauthenticated request; the scanner reads both.",
  "MAY-level and deprecated requirements are listed and never change the grade.",
  "Servers whose auth class is API key or no authentication are not graded: there is no OAuth authorization to check. The class is an evidenced statement on the server, not the directory's claim.",
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

const failing = (s: ObservationStatus) => s === "unsupported" || s === "partial";

/**
 * The status a check counts with under the either-or rule; the alternative may be absent. A
 * member that is not supported counts as supported when the other is; a failing member counts
 * as unknown while the other is unknown; both failing fail.
 */
function effective(c: Gradable, checks: readonly Gradable[]): ObservationStatus {
  const other = c.feature ? EITHER_OR[c.feature] : undefined;
  if (!other || c.status === "supported") return c.status;
  const alt = checks.find((x) => x.feature === other)?.status ?? "unknown";
  if (alt === "supported") return "supported";
  if (!failing(c.status)) return c.status;
  return failing(alt) ? c.status : "unknown";
}

export function grade(input: readonly Gradable[]): Grade {
  const checks = input.map((c) => ({ ...c, status: effective(c, input) }));
  const must = checks.filter((c) => c.level === "MUST");
  const should = checks.filter((c) => c.level === "SHOULD");
  const mustFail = must.filter((c) => failing(c.status));
  if (mustFail.length > 0) {
    return {
      letter: "F",
      label: "F",
      reasons: mustFail.map((c) => `MUST-level check ${c.status}: ${c.name}`),
    };
  }
  const mustUnknown = must.filter((c) => c.status === "unknown");
  if (mustUnknown.length > 0) {
    return {
      letter: null,
      label: "Withheld",
      reasons: mustUnknown.map((c) => `MUST-level check unknown: ${c.name}`),
    };
  }
  const shouldFail = should.filter((c) => failing(c.status));
  if (shouldFail.length > 0) {
    return {
      letter: "C",
      label: "C",
      reasons: shouldFail.map((c) => `SHOULD-level check ${c.status}: ${c.name}`),
    };
  }
  const shouldUnknown = should.filter((c) => c.status === "unknown");
  if (shouldUnknown.length > 0) {
    return {
      letter: "B",
      label: "B",
      reasons: shouldUnknown.map((c) => `SHOULD-level check unknown: ${c.name}`),
    };
  }
  return {
    letter: "A",
    label: "A",
    reasons: ["Every MUST-level and SHOULD-level check is supported."],
  };
}

/** The grade shown for a server that has no scanner observation at all. */
export const NOT_SCANNED: Grade = { letter: null, label: "Not scanned", reasons: [] };

/**
 * The grade shown for a server whose auth class says it uses no OAuth (009); such servers are
 * not scanned. `how` is the class as the server file states it, for the reason line.
 */
export function noOAuth(how: "api-key" | "none"): Grade {
  return {
    letter: null,
    label: "No OAuth",
    reasons: [
      how === "api-key"
        ? "Auth class API key: there is no OAuth authorization to grade."
        : "Auth class no authentication: there is no OAuth authorization to grade.",
    ],
  };
}
