/**
 * Well-known metadata locations, derived exactly as the MCP Authorization specification tells
 * clients to derive them (research R4). Nothing else is ever fetched.
 */

const PRM = "/.well-known/oauth-protected-resource";
const AS = "/.well-known/oauth-authorization-server";
const OIDC = "/.well-known/openid-configuration";

/** The path of a URL without its trailing slashes, query or fragment; "" for the root. */
function cleanPath(url: URL): string {
  return url.pathname.replace(/\/+$/, "");
}

/** RFC 8414 §3.3 requires an identical issuer string, without URL normalization. */
export function sameIssuer(a: string, b: string): boolean {
  return a === b;
}

/**
 * Protected resource metadata (RFC 9728 §3): the path-aware location first, then the root. One
 * entry when the server URL has no path.
 */
export function wellKnownPrmUrls(serverUrl: string): string[] {
  const url = new URL(serverUrl);
  const path = url.pathname === "/" ? "" : url.pathname;
  const root = `${url.origin}${PRM}`;
  return path === "" ? [root] : [`${url.origin}${PRM}${path}`, root];
}

/**
 * Authorization server metadata: the three locations the MCP specification names, in order
 * (RFC 8414 path-insertion, OpenID Connect Discovery path-insertion, OpenID Connect Discovery
 * path-appended). Two when the issuer has no path.
 */
export function wellKnownAsUrls(issuer: string): string[] {
  const url = new URL(issuer);
  const path = cleanPath(url);
  if (path === "") return [`${url.origin}${AS}`, `${url.origin}${OIDC}`];
  return [
    `${url.origin}${AS}${path}`,
    `${url.origin}${OIDC}${path}`,
    `${url.origin}${path}${OIDC}`,
  ];
}
