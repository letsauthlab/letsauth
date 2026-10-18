import type {
  ActorKind,
  FeatureCategory,
  FeatureParty,
  ObservationStatus,
  RelationType,
  SpecBody,
  SpecFamily,
  SpecMaturity,
  ToggleKind,
  VulnerabilityClass,
} from "../schema";

export const ACTOR_KIND_LABEL: Record<ActorKind, string> = {
  user: "User",
  agent: "Agent",
  "mcp-client": "MCP client",
  "mcp-server": "MCP server",
  "authorization-server": "Authorization server",
  resource: "Resource",
  idp: "Identity provider",
};

export const TOGGLE_KIND_LABEL: Record<ToggleKind, string> = {
  attack: "Attack",
  misconfiguration: "Misconfiguration",
};

export const VULNERABILITY_CLASS_LABEL: Record<VulnerabilityClass, string> = {
  "confused-deputy": "Confused deputy",
  "token-passthrough": "Token passthrough",
  "audience-missing": "Missing audience check",
  "scope-accumulation": "Scope accumulation",
  "consent-bypass": "Consent bypass",
  "issuer-confusion": "Issuer confusion",
  "redirect-uri": "Unchecked redirect URI",
  "pkce-bypass": "PKCE bypass",
  "untrusted-metadata": "Untrusted metadata",
  "tenant-isolation": "Tenant isolation",
  "token-theft": "Token theft",
  other: "Other",
};

export const STATUS_META: Record<ObservationStatus, { glyph: string; label: string }> = {
  supported: { glyph: "✓", label: "Supported" },
  partial: { glyph: "◐", label: "Partial" },
  unsupported: { glyph: "✕", label: "Unsupported" },
  unknown: { glyph: "?", label: "Unknown" },
  "not-applicable": { glyph: "–", label: "Not applicable" },
};

export const STATUS_ORDER: ObservationStatus[] = [
  "supported",
  "partial",
  "unsupported",
  "unknown",
  "not-applicable",
];

export const CATEGORY_LABEL: Record<FeatureCategory, string> = {
  discovery: "Discovery",
  registration: "Registration",
  authorization: "Authorization",
  token: "Tokens",
  session: "Session",
  transport: "Transport",
  delegation: "Delegation",
  consent: "Consent",
};

export const PARTY_LABEL: Record<FeatureParty, string> = {
  "mcp-server": "MCP server",
  "authorization-server": "Authorization server",
  client: "Client",
};

export const PARTY_SHORT: Record<FeatureParty, string> = {
  "mcp-server": "RS",
  "authorization-server": "AS",
  client: "C",
};

export const METHOD_LABEL = {
  manual: "Manual check",
  "vendor-claim": "Vendor claim",
  "passive-scan": "Passive scan",
  "active-scan": "Active scan",
} as const;

export const BODY_LABEL: Record<SpecBody, string> = {
  "ietf-oauth": "IETF OAuth",
  "ietf-wimse": "IETF WIMSE",
  "ietf-other": "IETF (other)",
  openid: "OpenID Foundation",
  mcp: "MCP",
  a2a: "A2A",
  vendor: "Vendor",
  eu: "European Union",
  other: "Other bodies",
};

export const BODY_SHORT: Record<SpecBody, string> = {
  "ietf-oauth": "IETF OAuth",
  "ietf-wimse": "IETF WIMSE",
  "ietf-other": "IETF",
  openid: "OpenID",
  mcp: "MCP",
  a2a: "A2A",
  vendor: "Vendor",
  eu: "EU",
  other: "Other",
};

export const FAMILY_LABEL: Record<SpecFamily, string> = {
  protocol: "Protocol",
  profile: "Profile",
  discovery: "Discovery",
  "credential-format": "Credential format",
  regulation: "Regulation",
  guidance: "Guidance",
};

export const MATURITY_LABEL: Record<SpecMaturity, string> = {
  "individual-draft": "Individual draft",
  "working-group-draft": "Working group draft",
  candidate: "Candidate",
  published: "Published",
  "in-force": "In force",
  expired: "Expired",
  withdrawn: "Withdrawn",
};

/** Short tag shown inside a map node. */
export const MATURITY_TAG: Record<SpecMaturity, string> = {
  "individual-draft": "draft",
  "working-group-draft": "WG draft",
  candidate: "candidate",
  published: "published",
  "in-force": "in force",
  expired: "expired",
  withdrawn: "withdrawn",
};

export const MATURITY_ORDER: SpecMaturity[] = [
  "individual-draft",
  "working-group-draft",
  "candidate",
  "published",
  "in-force",
  "expired",
  "withdrawn",
];

/** Verb phrases per relation type: `forward` reads from `from`, `backward` from `to`. */
export const RELATION_LABEL: Record<RelationType, { forward: string; backward: string }> = {
  "builds-on": { forward: "builds on", backward: "is built on by" },
  profiles: { forward: "profiles", backward: "is profiled by" },
  references: { forward: "references", backward: "is referenced by" },
  replaces: { forward: "replaces", backward: "is replaced by" },
  "competes-with": { forward: "competes with", backward: "competes with" },
  "solves-same-problem-as": {
    forward: "solves the same problem as",
    backward: "solves the same problem as",
  },
};

export const RELATION_DESCRIPTION: Record<RelationType, string> = {
  "builds-on": "Depends on the other document's mechanisms and cannot be used without them.",
  profiles: "Narrows the other document's options for one setting without changing it.",
  references: "Cites the other document normatively or for a specific mechanism.",
  replaces: "Supersedes the other document; the older one stays for history.",
  "competes-with": "Proposes a different answer to the same question; the note says how.",
  "solves-same-problem-as":
    "Addresses the same need by a different route without competing for adoption.",
};
