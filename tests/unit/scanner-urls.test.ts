import { describe, expect, it } from "vitest";
import { sameIssuer, wellKnownAsUrls, wellKnownPrmUrls } from "@/scanner/urls";

describe("well-known locations (research R4)", () => {
  it("derives the path-aware PRM location first, then the root", () => {
    expect(wellKnownPrmUrls("https://h.example/p/a/t/h")).toEqual([
      "https://h.example/.well-known/oauth-protected-resource/p/a/t/h",
      "https://h.example/.well-known/oauth-protected-resource",
    ]);
  });

  it("preserves the resource path including trailing slash, dropping query and fragment", () => {
    expect(wellKnownPrmUrls("https://h.example/mcp/?x=1#f")).toEqual([
      "https://h.example/.well-known/oauth-protected-resource/mcp/",
      "https://h.example/.well-known/oauth-protected-resource",
    ]);
  });

  it("yields one PRM location for a URL without a path", () => {
    expect(wellKnownPrmUrls("https://h.example")).toEqual([
      "https://h.example/.well-known/oauth-protected-resource",
    ]);
    expect(wellKnownPrmUrls("https://h.example/")).toEqual([
      "https://h.example/.well-known/oauth-protected-resource",
    ]);
  });

  it("derives the three AS locations in the order the MCP specification names", () => {
    expect(wellKnownAsUrls("https://a.example/i")).toEqual([
      "https://a.example/.well-known/oauth-authorization-server/i",
      "https://a.example/.well-known/openid-configuration/i",
      "https://a.example/i/.well-known/openid-configuration",
    ]);
  });

  it("derives two AS locations for an issuer without a path", () => {
    expect(wellKnownAsUrls("https://a.example")).toEqual([
      "https://a.example/.well-known/oauth-authorization-server",
      "https://a.example/.well-known/openid-configuration",
    ]);
  });

  it("compares issuer strings exactly", () => {
    expect(sameIssuer("https://a.example/", "https://a.example")).toBe(false);
    expect(sameIssuer("https://a.example/", "https://a.example/")).toBe(true);
    expect(sameIssuer("https://a.example/x", "https://a.example/y")).toBe(false);
  });
});
