<script lang="ts">
/**
 * The scan report (research R10): the report page renders this at build time with no client
 * directive, so plain HTML and no JavaScript is shipped. No browser API is used here.
 */
import type { Report } from "../scanner/report";

interface Props {
  report: Report;
  /** The newest scanner observation date, for recorded reports. */
  scannedAt?: string;
}

const { report, scannedAt }: Props = $props();

const PARTY_LABEL: Record<string, string> = {
  "mcp-server": "MCP server",
  "authorization-server": "Authorization server",
};
const STATUS_LABEL: Record<string, string> = {
  supported: "Supported",
  partial: "Partial",
  unsupported: "Unsupported",
  unknown: "Unknown",
  "not-applicable": "Not applicable",
};

const parties = ["mcp-server", "authorization-server"] as const;
const notScanned = $derived(!report.checks.some((c) => c.observedAt));
const gradeWord = $derived(
  report.grade.letter ? `Grade ${report.grade.letter}` : report.grade.label,
);

function splitEvidence(text: string): { url?: string; note: string } {
  const m = text.match(/^(https:\/\/\S+)\s*(.*)$/s);
  if (!m) return { note: text };
  return { url: m[1], note: (m[2] ?? "").replace(/^—\s*/, "") };
}
</script>

<section class="report" data-report aria-label="Scan report">
  <div class="grade" data-grade-label={report.grade.label}>
    <span class={`tile tile-${report.grade.letter ?? "none"}`} aria-hidden="true">
      {report.grade.letter ?? "–"}
    </span>
    <div class="grade__text">
      <p class="grade__word" data-grade-letter={report.grade.letter ?? undefined}>{gradeWord}</p>
      {#if notScanned}
        <p class="grade__note" id="not-scanned">
          No passive scan recorded yet for this server. The nightly run adds one when it can read
          the server's metadata; until then the atlas page shows what documentation says.
        </p>
      {:else}
        <ul class="grade__reasons">
          {#each report.grade.reasons as reason}
            <li>{reason}</li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>

  {#each parties as party}
    {@const rows = report.checks.filter((c) => c.party === party)}
    {#if rows.length > 0}
      <div class="table-wrap">
        <table class="checks">
          <caption>{PARTY_LABEL[party]} requirements</caption>
          <thead>
            <tr>
              <th scope="col">Requirement</th>
              <th scope="col">Level</th>
              <th scope="col">Status</th>
              <th scope="col">Evidence</th>
              <th scope="col">Observed</th>
            </tr>
          </thead>
          <tbody>
            {#each rows as c (c.feature)}
              {@const ev = splitEvidence(c.evidence)}
              {@const observed = Boolean(c.observedAt)}
              <tr data-check={c.feature} data-status={c.status}>
                <th scope="row">
                  <a href={`/mcp/features/${c.feature}/`}>{c.name}</a>
                  <span class="meta">
                    <code>{c.feature}</code> ·
                    <a href={c.citation} rel="noopener">{c.section}</a>
                  </span>
                </th>
                <td>
                  <span class={`level level-${c.level}`} title={c.levelNote}>{c.level}</span>
                </td>
                <td>
                  <span
                    class={`status status-${c.status}`}
                    class:derived={!observed}
                    title={observed ? STATUS_LABEL[c.status] : `${STATUS_LABEL[c.status]} (no scanner observation)`}
                  >
                    <span class="glyph" aria-hidden="true"></span>
                    {STATUS_LABEL[c.status]}
                  </span>
                </td>
                <td class="evidence">
                  {#if ev.url}
                    <a href={ev.url} rel="noopener">source</a>
                    {#if ev.note}<span class="meta">{ev.note}</span>{/if}
                  {:else if ev.note}
                    {ev.note}
                  {:else}
                    <span class="muted">no scanner observation</span>
                  {/if}
                </td>
                <td>
                  {#if c.observedAt}
                    <time datetime={c.observedAt}>{c.observedAt.slice(0, 10)}</time>
                  {:else}
                    <span class="muted">–</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/each}


  <p class="foot muted">
    Judged against MCP Authorization {report.revision.revision}
    {#if scannedAt}· newest scanner observation <time datetime={scannedAt}>{scannedAt.slice(0, 10)}</time>{/if}
    · method passive scan · {report.scanner}
  </p>
</section>

<style>
  .report {
    display: grid;
    gap: var(--space-4);
  }
  .grade {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-4) var(--space-5);
    align-items: start;
    padding: var(--space-5);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--bg-elevated);
    box-shadow: var(--shadow-sm), var(--inset-highlight);
  }
  /* The letter is always accompanied by its word and reasons; colour is a second channel. */
  .tile {
    --c: var(--ink-muted);
    display: inline-grid;
    place-items: center;
    width: 4.5rem;
    height: 4.5rem;
    border-radius: var(--radius-lg);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 2.6rem;
    line-height: 1;
    letter-spacing: var(--tracking-tight);
    color: var(--c);
    border: 2px solid color-mix(in oklch, var(--c) 45%, transparent);
    background: color-mix(in oklch, var(--c) 10%, transparent);
  }
  .tile-A {
    --c: var(--status-supported);
  }
  .tile-B {
    --c: var(--accent);
  }
  .tile-C {
    --c: var(--status-partial);
  }
  .tile-F {
    --c: var(--status-unsupported);
  }
  .tile-none {
    border-style: dashed;
  }
  .grade__word {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: var(--text-lg);
    margin: 0 0 var(--space-2);
  }
  .grade__reasons {
    margin: 0;
    padding-left: 1.2em;
    font-size: var(--text-sm);
    color: var(--ink-muted);
  }
  .grade__reasons li {
    margin-bottom: var(--space-1);
  }
  .grade__note {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--ink-muted);
  }
  .table-wrap {
    overflow-x: auto;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--bg-elevated);
    box-shadow: var(--shadow-sm), var(--inset-highlight);
  }
  .checks {
    margin: 0;
  }
  .checks caption {
    text-align: left;
    padding: var(--space-3) var(--space-4);
    font-family: var(--font-display);
    font-weight: 600;
    font-size: var(--text-md);
    border-bottom: 1px solid var(--line);
  }
  .checks thead th {
    background: var(--bg-sunken);
    border-bottom: 1px solid var(--line);
    padding-block: var(--space-2);
  }
  .checks th,
  .checks td {
    padding-inline: var(--space-4);
    border-bottom-color: var(--line-soft);
    vertical-align: top;
  }
  .checks tbody tr:last-child > * {
    border-bottom: 0;
  }
  .checks th[scope="row"] {
    text-transform: none;
    letter-spacing: 0;
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink);
    min-width: 16rem;
  }
  .checks th[scope="row"] > a {
    color: var(--ink);
    text-decoration: none;
  }
  .checks th[scope="row"] > a:hover {
    color: var(--accent);
    text-decoration: underline;
  }
  .meta {
    display: block;
    font-weight: 400;
    font-size: var(--text-xs);
    color: var(--ink-muted);
    margin-top: var(--space-1);
    line-height: 1.5;
  }
  .meta code {
    font-size: 0.85em;
  }
  .evidence {
    min-width: 14rem;
    max-width: 26rem;
    overflow-wrap: anywhere;
    font-size: var(--text-sm);
  }
  .muted {
    color: var(--ink-muted);
  }
  /* Status chip: filled for an observed status, a dashed ring for a recorded unknown, a faint
     dot when nothing was observed. Same distinction as StatusCell in the atlas. */
  .status {
    --c: var(--status-unknown);
    display: inline-flex;
    align-items: center;
    gap: 0.45em;
    font-size: var(--text-sm);
    font-weight: 500;
    white-space: nowrap;
    line-height: 1;
  }
  .status .glyph {
    flex: none;
    width: 1.15rem;
    height: 1.15rem;
    border-radius: 5px;
    background: var(--c);
    box-shadow:
      inset 0 1px 0 0 color-mix(in oklch, white 22%, transparent),
      0 1px 2px color-mix(in oklch, var(--c) 35%, transparent);
  }
  .status-supported {
    --c: var(--status-supported);
  }
  .status-partial {
    --c: var(--status-partial);
  }
  .status-unsupported {
    --c: var(--status-unsupported);
  }
  .status-unknown .glyph,
  .status-not-applicable .glyph {
    background: transparent;
    box-shadow: none;
    border: 1.5px dashed var(--c);
    border-radius: 50%;
  }
  .status.derived .glyph {
    border: 0;
    display: grid;
    place-items: center;
  }
  .status.derived .glyph::before {
    content: "";
    width: 0.35rem;
    height: 0.35rem;
    border-radius: 50%;
    background: var(--ink-faint);
    opacity: 0.6;
  }
  .foot {
    font-size: var(--text-xs);
    margin: 0;
    max-width: none;
  }
  @media (max-width: 40rem) {
    .grade {
      grid-template-columns: 1fr;
    }
  }
</style>
