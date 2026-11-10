# Feature Specification: Home as a ledger

**Feature Branch**: `claude/project-thread-folka8`

**Created**: 2026-11-10

**Amends**: 016-visual-redesign plan 3.3 (type) and the home page of WP3.

## Why

After the redesign and the unslop pass, the data views were distinct but the frame around them
was a standard landing page: a split hero with the product picture in a rounded card, a 4-up
stat row, two panels side by side, and Geist everywhere, the default face of the Next.js world.
The owner reviewed an analysis of forck.live (a newsroom aggregator that reads like a printed
weekly) and a mockup of the home page built from that analysis, and approved it on 10 November
2026, including a serif for headings.

The "Latest observations" panel showed activity, not change: six rows of passive scans, all
supported. The append-only history holds 124 status changes, and the home page showed none.

## Alternatives weighed

| Option | Why not, or why |
|---|---|
| Keep the layout, add motion | Motion was not the problem; forck.live itself has very little. |
| Copy forck.live's frame (dark warm paper, red print masthead, "The Week of") | Copying; and it fights the cool graphite and teal the lab already owns. |
| Rank servers by changes or support | A score by another name; the site promises neutrality (017). |
| **Ledger: the run as the edition, the matrix as a print, changes first, requirements ranked** | **Chosen.** Every element comes from the lab's own data, and nothing ranks a server. |

## Requirements

- **FR-001**: The home page MUST open with a dateline in the eyebrow's place: the newest
  observation's time in UTC and the current revision.
- **FR-002**: The facts MUST be one line of mono figures under the lede, not a row of panels.
- **FR-003**: The matrix MUST be drawn as a print in one ink (`--signal`), the status carried by
  shape (filled, half, cross, dashed ring, dot, dash), servers across and requirements down,
  with a caption above and a key below, no card.
- **FR-004**: Cells whose status changed on or after the oldest day shown in the feed MUST carry a
  ring, and the caption MUST say since when.
- **FR-005**: "Since the last run" MUST list status changes newest first, grouped by UTC day in a
  margin of dates, at most eight lines; three or more changes of one server on one day fold into
  one line with the cells in a disclosure. Scan runs after the newest change MUST be stated as a
  line of their own ("no status changed").
- **FR-006**: Each change line MUST name the server, the requirement (id, level, party), the old and
  new status with `StatusCell`, the method and the number of observations, and MUST offer the
  earlier observations of the cell in a `<details>` disclosure (the evidence stack).
- **FR-007**: "Missing most often" MUST rank requirements, never servers, by the number of servers
  whose current cell is unsupported, with the rule stated above the list and a bar whose length
  is the count.
- **FR-008**: h1 and h2 MUST be set in Newsreader 400, self-hosted and preloaded; an h2 drawn at
  `--h3` size or below stays in Geist 500.
- **FR-009**: Motion M20 (scan line and rings) and M21 (new status rising into place) MUST run once
  on load, only under `prefers-reduced-motion: no-preference`, and MUST show their end state
  otherwise. The page MUST read fully without JavaScript and ship no script.

## Out of scope

The evidence stack on the server page, section prints for the other roots (WP8), and an
"as Markdown / llms.txt" line for agents. Each is its own change.
