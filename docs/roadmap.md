# Roadmap

The constitution holds the rules every feature follows. This roadmap is the part that changes:
what comes next, in what order, and why. Each feature gets its own spec under `specs/` when work
on it starts. Implemented features leave this list; their specs under `specs/` and the live site
describe them.

| # | Feature | Why this order | Status |
|---|---|---|---|
| 019 | **Wider MCP coverage** | The atlas is only as useful as its rows and columns. Grow it in both directions: more public MCP servers, each with evidenced access and auth classes, and more feature checks, covering requirements of the MCP Authorization specification that are still read by hand or not at all, and the features each new revision adds. Passive checks come first. The longer aim is a full review that goes beyond public metadata; how to run one automatically and responsibly is still open, and its spec settles that against the constitution before any such check runs, as 008 did for the challenge request. | Planned |
| 020 | **Agentic correctness and completeness checks** | More rows and columns mean more cells that can be wrong, stale or missing. Extend the agentic review from 018 so agents check that each observation's evidence still says what the cell claims, that each citation resolves, which server and feature pairs have no observation yet, and which listed endpoints or revisions have moved. Agents propose by pull request and never merge; a maintainer reviews every change. | Planned |
| 021 | **Talks and presentations from the observations** | The dataset now holds dated observations across many servers and nightly runs. Turn them into talks and slide decks on what the atlas shows: which requirements servers meet, where they diverge and how that changed over time. Each figure on a slide is built from a dated snapshot of the data and cites the observations behind it, so a claim in a talk traces back to a cell. | Planned |

Review after each feature: does it still pass the three honesty tests, and did it make the shared
model better or worse?
