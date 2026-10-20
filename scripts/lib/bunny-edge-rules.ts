import { PLAUSIBLE_EVENT_PATH } from "../../src/lib/analytics";

/**
 * The Bunny pull zone edge rules this repository owns. Each carries `MANAGED_PREFIX` in its
 * description; the sync creates, updates and deletes only those, so rules added by hand in the
 * Bunny dashboard (such as the redirects in docs/deploy.md) are left alone.
 *
 * API reference: https://docs.bunny.net/reference/pullzonepublic_addedgerule
 */
export const MANAGED_PREFIX = "[repo] ";

// Edge rule enums (Bunny API)
const Action = { OriginUrl: 2, OverrideCacheTime: 3, SetRequestHeader: 6, StripCookies: 37 };
const Trigger = { Url: 0 };
const Match = { Any: 0 };

export interface ExtraAction {
  ActionType: number;
  ActionParameter1: string | null;
  ActionParameter2: string | null;
  ActionParameter3: null;
}

export interface EdgeRule {
  Guid?: string | null;
  Description: string;
  Enabled: boolean;
  ActionType: number;
  ActionParameter1: string | null;
  ActionParameter2: string | null;
  ActionParameter3: null;
  Triggers: {
    Type: number;
    PatternMatches: string[];
    PatternMatchingType: number;
    Parameter1: null;
  }[];
  TriggerMatchingType: number;
  ExtraActions: ExtraAction[];
}

const extra = (type: number, p1: string | null = null, p2: string | null = null): ExtraAction => ({
  ActionType: type,
  ActionParameter1: p1,
  ActionParameter2: p2,
  ActionParameter3: null,
});

export function edgeRules(): EdgeRule[] {
  return [
    // Plausible proxy (https://plausible.io/docs/proxy/introduction). Host is set in case the
    // pull zone forwards the visitor's; X-Forwarded-For carries the visitor's IP, without which
    // Plausible sees every visit come from the CDN and its bot filter drops them.
    {
      Description: `${MANAGED_PREFIX}Plausible events`,
      Enabled: true,
      ActionType: Action.OriginUrl,
      ActionParameter1: "https://plausible.io/api/event",
      ActionParameter2: null,
      ActionParameter3: null,
      Triggers: [
        {
          Type: Trigger.Url,
          PatternMatches: [`*${PLAUSIBLE_EVENT_PATH}`],
          PatternMatchingType: Match.Any,
          Parameter1: null,
        },
      ],
      TriggerMatchingType: Match.Any,
      ExtraActions: [
        extra(Action.SetRequestHeader, "Host", "plausible.io"),
        extra(Action.SetRequestHeader, "X-Forwarded-For", "%{User.IP}"),
        extra(Action.StripCookies),
        extra(Action.OverrideCacheTime, "0"),
      ],
    },
  ];
}

export type Api = (method: string, path: string, body?: unknown) => Promise<unknown>;

/** Bring the zone's managed rules in line with `rules`; returns one line per change. */
export async function syncEdgeRules(api: Api, zone: string, rules: EdgeRule[]): Promise<string[]> {
  const info = (await api("GET", `/pullzone/${zone}`)) as {
    EdgeRules?: { Guid: string; Description?: string }[];
  };
  const managed = (info.EdgeRules ?? []).filter((r) =>
    (r.Description ?? "").startsWith(MANAGED_PREFIX),
  );
  const byDescription = new Map(managed.map((r) => [r.Description, r]));
  const log: string[] = [];
  for (const rule of rules) {
    const current = byDescription.get(rule.Description);
    await api("POST", `/pullzone/${zone}/edgerules/addOrUpdate`, {
      ...rule,
      Guid: current?.Guid ?? null,
    });
    log.push(`${current ? "updated" : "created"}  ${rule.Description}`);
    byDescription.delete(rule.Description);
  }
  for (const stale of byDescription.values()) {
    await api("DELETE", `/pullzone/${zone}/edgerules/${stale.Guid}`);
    log.push(`deleted  ${stale.Description}`);
  }
  return log;
}
