# Feature Specification: One matrix, one ledger

**Feature Branch**: `claude/project-thread-folka8`

**Created**: 2026-11-10, rewritten 2026-11-11

**Amends**: 016-visual-redesign plan 3.3 (type), the home page of WP3 and the site map; removes
the breach pages of roadmap 005 from the site.

## Why

A first version of this change gave the home page a look of its own: a one-ink "print" of the
matrix, a ranking and a feed. The owner reviewed it on 11 November 2026 and rejected it: the
monochrome print read worse than the matrix's own cells, its caption explained nothing, the head
had width limits no other page had, the home page and `/mcp/` showed the same matrix twice, and
the result was one redesigned page beside an unchanged site. The owner asked for one concept
for every page, built around the two things the lab owns: the MCP authorization matrix and the
ledger of status changes behind it, and for the breach pages to go.

## Alternatives weighed

| Option | Why not, or why |
|---|---|
| Keep a landing page above `/mcp/` | Two pages with one matrix; the owner named the overlap as a defect. |
| Keep the one-ink print as the home picture | Rejected by the owner; colour and `StatusCell`'s forms are how the site reads status. |
| Rank servers by changes or support | A score by another name; the site promises neutrality (017). |
| Requirements as rows, servers as columns | Reads well with 21 servers, not with the list growing; the table, its island and its tests assume servers as rows. |
| **One matrix, one ledger** | **Chosen.** The matrix is the home page; the ledger is its history; every other page is a cut through one of the two, in one frame. |

## Requirements

- **FR-001**: `/` MUST be the matrix for the current revision. `/mcp/` MUST redirect to it.
- **FR-002**: Every page MUST carry a record line under the header: the section, the time of the
  newest observation in UTC, and the current revision as a link.
- **FR-003**: `/ledger/` MUST list every status change among the listed servers, newest first,
  one rule per UTC day. The home page MUST show the newest lines below the matrix and link to the
  rest; a server's page MUST show its changes, a requirement's page its changes.
- **FR-004**: A ledger line MUST name what changed, the old and the new status with `StatusCell`,
  and its evidence: the method, how often the cell was observed, the source where the observation
  has a URL, and the earlier observations in a `<details>` disclosure. Three or more changes of
  one server on one day fold into one line on pages that list every server.
- **FR-005**: Scan runs after the newest change MUST be stated on the home page as a line of their
  own ("no status changed"). A first observation of a server is not a status change, but that
  line MUST name how many servers those runs observed for the first time, so a run that adds
  servers never reads as a run where nothing happened (amended 2026-11-12).
- **FR-006**: On the home page, cells that changed on the newest day of the ledger MUST carry a
  small ink dot in the corner, named in the cell's accessible label, and the head MUST say how
  many and link to the ledger section.
- **FR-007**: The ledger page, a server's page and a requirement's page MUST show the matrix in
  small in the page head, in the matrix's own colours and distinctions, with the page's cells,
  row or column lit. It links to the matrix.
- **FR-008**: The page head MUST use one width on every page: title, lede and facts in the wide
  column of an 8/3 grid, the optional small matrix in the narrow one.
- **FR-009**: h1 and h2 MUST be set in Newsreader 400, self-hosted and preloaded; an h2 drawn at
  `--h3` size or below stays in Geist 500. Figures in `dl.facts` are set in the serif.
- **FR-010**: The breach pages and their export MUST be removed from the site and `/breaches/`
  MUST redirect to `/`. The vulnerability data and its library stay in the repository.
- **FR-011**: Nothing here ranks a server. Every page MUST read fully without JavaScript.

## Out of scope

Rebuilding the body of the server page (profile, status panel, tables) around its row; replacing
the remaining grey panels with rules; a new layout for the standards and explorer pages beyond
the shared frame. Each is its own change.
