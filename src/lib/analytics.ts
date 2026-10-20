/**
 * Plausible, sent by the site's own module to the site's own address. A Bunny edge rule forwards
 * `PLAUSIBLE_EVENT_PATH` to plausible.io (scripts/lib/bunny-edge-rules.ts), so no page loads a
 * third-party script and blocklists that match plausible.io do not drop the count.
 *
 * One pageview per shown document. A page prerendered by speculation rules runs its scripts
 * before the reader opens it, or although they never do; it waits for `prerenderingchange`.
 * A page restored from the back/forward cache counts again, as Plausible's own script does.
 *
 * Only the browser bundle runs `startAnalytics`; the build imports nothing here that fetches.
 */

/** Needs a file extension: Bunny answers an extensionless path with a 301 before an edge rule. */
export const PLAUSIBLE_EVENT_PATH = "/r/e.json";

export interface AnalyticsConfig {
  domain: string;
  endpoint: string;
  /** The production hostname; local, preview and CI builds never report. */
  host: string;
  notFound: boolean;
}

export type Props = Record<string, string>;
export type Send = (name: string, props?: Props) => void;

/** Read from the data attributes `Analytics.astro` writes. */
export function readConfig(el: HTMLElement | null): AnalyticsConfig | null {
  const d = el?.dataset;
  if (!d?.domain || !d.endpoint || !d.host) return null;
  return { domain: d.domain, endpoint: d.endpoint, host: d.host, notFound: "notFound" in d };
}

const DOWNLOAD = /\.(json|csv|pdf|zip|png|svg)$/i;

/** The event a click on a link records: outbound links and the JSON exports, nothing else. */
export function linkEvent(
  href: string,
  here: string,
  download = false,
): { name: string; props: Props } | null {
  let url: URL;
  try {
    url = new URL(href, here);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.host !== new URL(here).host)
    return { name: "Outbound Link: Click", props: { url: url.href } };
  if (download || DOWNLOAD.test(url.pathname))
    return { name: "File Download", props: { url: url.href } };
  return null;
}

type Win = Pick<
  Window,
  "document" | "location" | "navigator" | "innerWidth" | "addEventListener"
> & {
  fetch: typeof fetch;
  localStorage?: Storage;
};

function ignored(win: Win): boolean {
  try {
    // Plausible's own opt-out key, so one setting excludes a browser from every site.
    return win.localStorage?.getItem("plausible_ignore") === "true";
  } catch {
    return false;
  }
}

/** Starts reporting and returns the sender, or null when this page must not report. */
export function startAnalytics(win: Win, config: AnalyticsConfig): Send | null {
  if (win.location.hostname !== config.host || win.navigator.webdriver || ignored(win)) return null;
  const doc = win.document as Document & { prerendering?: boolean };
  const shown = new Promise<void>((resolve) => {
    if (doc.prerendering)
      doc.addEventListener("prerenderingchange", () => resolve(), { once: true });
    else resolve();
  });
  const send: Send = (name, props) => {
    void shown.then(() => {
      const body = {
        n: name,
        u: win.location.href,
        d: config.domain,
        r: doc.referrer || null,
        w: win.innerWidth,
        ...(props ? { p: props } : {}),
      };
      // keepalive lets an outbound click report while the page unloads.
      win
        .fetch(config.endpoint, {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "Content-Type": "text/plain" },
          keepalive: true,
          credentials: "omit",
        })
        .catch(() => {});
    });
  };

  send("pageview");
  if (config.notFound) send("404", { path: win.location.pathname });
  win.addEventListener("pageshow", (event) => {
    if ((event as PageTransitionEvent).persisted) send("pageview");
  });

  const onClick = (event: Event) => {
    const e = event as MouseEvent;
    if (e.type === "auxclick" && e.button !== 1) return;
    const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!link) return;
    const hit = linkEvent(link.href, win.location.href, link.hasAttribute("download"));
    if (hit) send(hit.name, hit.props);
  };
  doc.addEventListener("click", onClick);
  doc.addEventListener("auxclick", onClick);
  return send;
}
