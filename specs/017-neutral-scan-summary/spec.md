# Feature Specification: Neutral scan summary

**Feature Branch**: `claude/project-thread-vg8kgo`

**Created**: 2026-10-22

**Supersedes**: 004-scanner FR-008 (the grade rule) and the grade part of FR-009.

## Why

The scanner graded every OAuth server A, B, C or F and showed the letter next to each name in
the atlas matrix, on the server page and at the top of each report. The owner found the letters
too aggressive, and they sit badly with the site's own promise: "Neutral. Nothing is ranked or
scored." A letter is a score, and an F in the threat colour next to a company's name reads as a
verdict, whatever the rule behind it says. It also adds nothing a reader cannot see: the matrix
row already shows every status the grade was derived from.

## Alternatives weighed

| Option | Used by | Why not, or why |
|---|---|---|
| Keep A–F, soften the colours | SSL Labs, securityheaders.com | Still a score and an implied ranking; the colour was only part of the problem. |
| Pass / fail conformance verdict | OpenID certification, conformance badges | Binary and still a judgement; the scanner reads public metadata only, so it cannot certify. |
| Percentage or points ("86 %") | internet.nl, Mozilla Observatory | A score by another name, and it adds MUST and MAY into one number. |
| Descriptive tiers ("meets every MUST") | some vendor scorecards | Hides the order of a grade inside words; still invites comparing servers. |
| **Status counts per requirement level** | W3C implementation reports, wpt.fyi, caniuse | **Chosen.** Counts what the rows show, keeps MUST, SHOULD and MAY apart, adds no verdict, and uses the status glyphs the site already has. |

## Requirements

- **FR-001**: A scan report MUST summarize its checks as counts of each status per requirement
  level (MUST, SHOULD, MAY, DEPRECATED), with the number of checks at each level, and name the
  checks that are not supported under their level. It MUST NOT show a letter, score, percentage,
  or single verdict, and MUST NOT combine levels into one number.
- **FR-002**: `unknown` MUST be counted as unknown, never as unsupported. The either-or rule of
  008 FR-005 applies to the counts (protected resource metadata at a well-known location or in
  the `WWW-Authenticate` challenge), and the summary MUST say in a sentence when a count differs
  from its row because of it.
- **FR-003**: The rule for the summary MUST be published on the scanner page and on every report,
  and MUST state that there is no grade and no score.
- **FR-004**: The atlas matrix MUST NOT show a grade. Next to each server name it links the scan
  report with a quiet text link; the row's cells are the result. The site MUST NOT order or rank
  servers by a scan anywhere.
- **FR-005**: The server page MUST show how many checks the scan ran and when, with a link to the
  report, and no grade.
- **FR-006**: The JSON report replaces `grade` with `summary` (`state`, `label`, `tallies`,
  `open`, `notes`) and bumps `version` to 2. The nightly pull request's table and the
  `pnpm scan` output use the same summary.

## Success criteria

- **SC-001**: No page, JSON file or scanner output contains a grade letter or the word "grade"
  for a server.
- **SC-002**: Unit tests cover the counts for every MUST and SHOULD status pair, the either-or
  rule in both directions, and the not-scanned and no-OAuth states.
