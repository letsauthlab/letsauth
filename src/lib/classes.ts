import type { AccessClass, AuthClass, Server } from "../schema";

/**
 * The two classes a server carries as a whole (009): who can connect (`access`) and how the
 * endpoint authenticates clients (`auth`). Both are evidenced statements on the server file. A
 * server without one is `unknown` and *derived*, like a matrix cell without an observation: the
 * pages draw it faint and never read silence as a verdict.
 */

export interface ClassView<T extends string> {
  value: T;
  /** True when the server file carries no statement and `unknown` was derived. */
  derived: boolean;
}

export function accessOf(server: Pick<Server, "access">): ClassView<AccessClass> {
  return server.access
    ? { value: server.access.class, derived: false }
    : { value: "unknown", derived: true };
}

export function authOf(server: Pick<Server, "auth">): ClassView<AuthClass> {
  return server.auth
    ? { value: server.auth.class, derived: false }
    : { value: "unknown", derived: true };
}

export const ACCESS_ORDER: AccessClass[] = ["public", "closed", "unknown"];
export const AUTH_ORDER: AuthClass[] = ["oauth", "api-key", "none", "unknown"];

export const ACCESS_LABEL: Record<AccessClass, string> = {
  public: "Public",
  closed: "Closed",
  unknown: "Unknown",
};

export const AUTH_LABEL: Record<AuthClass, string> = {
  oauth: "OAuth",
  "api-key": "API key",
  none: "No authentication",
  unknown: "Unknown",
};

/** One sentence per class, for legends, filters and the server page. */
export const ACCESS_DESCRIPTION: Record<AccessClass, string> = {
  public:
    "Anyone can connect; where an account is needed, anyone can create one by self-service sign-up.",
  closed:
    "Connecting needs something not available by self-service: an existing contract, a tenant an admin must enable, a sales process or a private beta. A catalog of approved clients is not one: any account connects through a listed client.",
  unknown: "Not yet established; the evidence says what was looked at.",
};

export const AUTH_DESCRIPTION: Record<AuthClass, string> = {
  oauth: "An OAuth 2.x authorization obtained through the server's authorization server.",
  "api-key":
    "A static credential (API key, personal or private app token) the user pastes into the client.",
  none: "The listed endpoint accepts requests without any credential.",
  unknown: "Not yet established; the evidence says what was looked at.",
};

/**
 * True when the server's auth class says there is no OAuth authorization to judge: the scanner
 * does not scan it and the scan summary reads "No OAuth". An `unknown` class is scanned like OAuth, so
 * the scan can say what the endpoint's challenge suggests.
 */
export function hasNoOAuth(server: Pick<Server, "auth">): boolean {
  const auth = authOf(server).value;
  return auth === "api-key" || auth === "none";
}

/** Counts per class over the listed servers, in class order, for the atlas head and legends. */
export function countBy<T extends string>(
  servers: readonly Server[],
  order: readonly T[],
  pick: (s: Server) => ClassView<T>,
): { value: T; count: number }[] {
  const counts = new Map<T, number>(order.map((v) => [v, 0]));
  for (const s of servers) {
    const v = pick(s).value;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return order.map((value) => ({ value, count: counts.get(value) ?? 0 }));
}
