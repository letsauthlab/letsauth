/**
 * The scanner's identity. Bump SCANNER_VERSION when a check's logic or evidence format changes:
 * the append rule (observations.ts) re-observes every cell written by an older version.
 */
export const SCANNER_NAME = "letsauth-scanner";
export const SCANNER_VERSION = "0.3.1";
export const SCANNER_ID = `${SCANNER_NAME}/${SCANNER_VERSION}`;
/** The `observedBy` value on every observation the scanner writes. */
export const OBSERVER = `scanner@${SCANNER_VERSION}`;
/** Names the project and links to the page that explains the scanner and how to opt out. */
export const USER_AGENT = `${SCANNER_ID} (+https://letsauth.eu/mcp/scanner/)`;
