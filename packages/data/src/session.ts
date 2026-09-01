/**
 * Who is calling.
 *
 * Today this returns a fixed demo identity per app. With a backend it reads the
 * session — a cookie, a JWT, whatever auth turns out to be — and everything
 * downstream stays as it is, because callers already ask this rather than
 * hardcoding an id.
 *
 * The point of putting it here now is that the *shape* is right: data functions
 * should not take a `clientId` parameter that any caller could set to anyone
 * else's id. They should ask who is calling and be told.
 */
import type { ID } from "@repo/types";

export type Actor =
  | { role: "client"; userId: ID; clientId: ID }
  | { role: "professional"; userId: ID; professionalId: ID }
  | { role: "sales_agent"; userId: ID; salesAgentId: ID }
  | { role: "admin"; userId: ID };

/**
 * The demo identities each app runs as until authentication exists. Named
 * explicitly so a search for "demo" finds every place that has to change.
 */
export const DEMO_ACTORS = {
  client: {
    role: "client",
    userId: "user-client-priya",
    clientId: "client-priya",
  },
  professional: {
    role: "professional",
    userId: "user-pro-aarohi",
    professionalId: "pro-aarohi",
  },
  salesAgent: {
    role: "sales_agent",
    userId: "user-sales-kavita",
    salesAgentId: "sales-kavita",
  },
  admin: {
    role: "admin",
    userId: "user-admin",
  },
} as const satisfies Record<string, Actor>;

/**
 * Thrown where an action needs an identity the current session does not have.
 * Every app should render this as "please sign in" rather than a crash — which
 * is the behaviour real auth will require anyway.
 */
export class NotAuthenticatedError extends Error {
  constructor(message = "No signed-in user for this action") {
    super(message);
    this.name = "NotAuthenticatedError";
  }
}

/**
 * Narrowing helpers, so a call site that needs a client id says so and fails
 * loudly rather than silently operating on the wrong person's data.
 */
export function requireClient(actor: Actor): ID {
  if (actor.role !== "client") throw new NotAuthenticatedError("A client session is required");
  return actor.clientId;
}

export function requireProfessional(actor: Actor): ID {
  if (actor.role !== "professional") {
    throw new NotAuthenticatedError("A professional session is required");
  }
  return actor.professionalId;
}

export function requireStaff(actor: Actor): ID {
  if (actor.role !== "sales_agent" && actor.role !== "admin") {
    throw new NotAuthenticatedError("A staff session is required");
  }
  return actor.userId;
}
