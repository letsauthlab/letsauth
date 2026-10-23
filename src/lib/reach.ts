/**
 * Plausible through the site's own address. Pages load the site's personal Plausible script from
 * `PLAUSIBLE_SCRIPT_PATH` and it sends events to `PLAUSIBLE_EVENT_PATH`; Bunny edge rules forward
 * both to plausible.io (scripts/lib/bunny-edge-rules.ts), so blocklists that match plausible.io do
 * not drop the count. Outbound links and file downloads are the script's own, switched on in the
 * Plausible site settings.
 *
 * Pageviews are sent from here, not by the script (`autoCapturePageviews: false`): one per shown
 * document. A page prerendered by speculation rules runs its scripts before the reader opens it,
 * or although they never do; it waits for `prerenderingchange`. A page restored from the
 * back/forward cache counts again, as Plausible's own capture does, and so does a page an island
 * swaps in place (the explorer's toggles), which says so with `SOFT_NAVIGATION`.
 *
 * Bundled file names come from module and component names, and blocklists match words such as
 * "analytics", "tracking" or "plausible" in a path: this module and `Reach.astro` keep neutral
 * names so the pageview code is not blocked while the proxied script gets through.
 */

/** Paths need a file extension: Bunny answers an extensionless path with a 301 before a rule. */
export const PLAUSIBLE_SCRIPT_PATH = "/r/s.js";
export const PLAUSIBLE_EVENT_PATH = "/r/e.json";
/** The personal script from Plausible's site settings, "Site installation". */
export const PLAUSIBLE_SCRIPT = "pa-dijXYLvcgUmFUPtPr7i0G.js";

/** The window event an island dispatches after it pushed a new URL and swapped the page in place. */
export const SOFT_NAVIGATION = "letsauth:navigate";

/**
 * The inline snippet that queues calls until the script has loaded and configures it, as in
 * https://plausible.io/docs/proxy/guides/nginx. Plausible's default download extensions miss the
 * JSON exports, and the option replaces that list.
 */
export function plausibleInit(): string {
  const options = {
    endpoint: PLAUSIBLE_EVENT_PATH,
    autoCapturePageviews: false,
    fileDownloads: { fileExtensions: ["json", "csv", "pdf", "zip"] },
  };
  return `window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init(${JSON.stringify(options)});`;
}

export interface AnalyticsConfig {
  /** The production hostname; local, preview and CI builds never report. */
  host: string;
  notFound: boolean;
}

export type Props = Record<string, string>;
/** `window.plausible`. */
export type Track = (name: string, options?: { props?: Props }) => void;

/** Read from the data attributes `Reach.astro` writes. */
export function readConfig(el: HTMLElement | null): AnalyticsConfig | null {
  const d = el?.dataset;
  if (!d?.host) return null;
  return { host: d.host, notFound: "notFound" in d };
}

/** The site answers on both letsauth.eu and www.letsauth.eu; either is production. */
const bare = (host: string) => host.replace(/^www\./, "");

type Win = Pick<Window, "document" | "location" | "navigator" | "addEventListener">;

/** Sends the pageviews; returns false when this page must not report. */
export function startAnalytics(win: Win, config: AnalyticsConfig, track: Track): boolean {
  if (bare(win.location.hostname) !== bare(config.host) || win.navigator.webdriver) return false;
  const doc = win.document as Document & { prerendering?: boolean };
  const pageview = () => {
    track("pageview");
    if (config.notFound) track("404", { props: { path: win.location.pathname } });
  };
  if (doc.prerendering) doc.addEventListener("prerenderingchange", pageview, { once: true });
  else pageview();
  win.addEventListener("pageshow", (event) => {
    if ((event as PageTransitionEvent).persisted) track("pageview");
  });
  win.addEventListener(SOFT_NAVIGATION, () => track("pageview"));
  return true;
}
