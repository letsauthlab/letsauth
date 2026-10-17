import { z } from "zod";
import { observationMethod } from "./observation";
import { httpsUrl, isoDate, isoDateTime, kebabId } from "./spec";

export const serverTransport = z.enum(["streamable-http", "sse", "stdio-only"]);
export type ServerTransport = z.infer<typeof serverTransport>;

export const serverListed = z.enum(["opt-in", "public-directory", "maintainer-added"]);
export type ServerListed = z.infer<typeof serverListed>;

/**
 * Who can connect (009). `public`: anyone, creating an account by self-service where one is
 * needed. `closed`: an existing contract, a tenant an admin must enable, a sales process or a
 * private beta stands in the way. A catalog of approved clients is not an obstacle to the person
 * (any account connects through a listed client), so it does not make a server closed; the
 * evidence note records it. `unknown`: not yet established.
 */
export const accessClass = z.enum(["public", "closed", "unknown"]);
export type AccessClass = z.infer<typeof accessClass>;

/**
 * How the endpoint authenticates clients (009). `oauth`: an OAuth 2.x authorization obtained
 * through the server's authorization server. `api-key`: a static credential the user pastes into
 * the client. `none`: no authentication. `unknown`: not yet established.
 */
export const authClass = z.enum(["oauth", "api-key", "none", "unknown"]);
export type AuthClass = z.infer<typeof authClass>;

/**
 * A dated, evidenced statement about a server as a whole, where an observation is one about a
 * feature. It is written by a person (or recorded from a vendor page) and corrected in place by
 * pull request; git keeps the history. `unknown` is a real value, written with the evidence of
 * what was looked at.
 */
function classification<T extends z.ZodEnum>(values: T) {
  return z.object({
    class: values,
    method: observationMethod,
    evidence: z.string().min(1, "required (URL or note)"),
    observedAt: isoDateTime,
    observedBy: z.string().min(1),
  });
}

export const accessSchema = classification(accessClass);
export type Access = z.infer<typeof accessSchema>;
export const authSchema = classification(authClass);
export type Auth = z.infer<typeof authSchema>;

export const serverSchema = z
  .object({
    id: kebabId,
    name: z.string().min(1),
    vendor: z.string().min(1).optional(),
    url: httpsUrl,
    homepage: httpsUrl.optional(),
    transport: serverTransport,
    listed: serverListed,
    source: httpsUrl.optional(),
    access: accessSchema.optional(),
    auth: authSchema.optional(),
    withdrawn: z
      .object({
        at: isoDate,
        reason: z.string().min(1),
      })
      .optional(),
    notes: z.string().min(1).optional(),
  })
  .superRefine((server, ctx) => {
    if (server.listed !== "opt-in" && !server.source) {
      ctx.addIssue({
        code: "custom",
        path: ["source"],
        message: `required when listed is "${server.listed}"`,
      });
    }
  });
export type Server = z.infer<typeof serverSchema>;
