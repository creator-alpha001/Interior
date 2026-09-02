/**
 * Who is calling.
 *
 * Data functions must never take the caller's own id as a parameter. A function
 * shaped `listLeadsForClient(clientId)` is one careless call site away from
 * handing one customer another customer's leads, and once it becomes an HTTP
 * request that call site is the browser. So callers ask *this* module who is
 * signed in, and are told.
 *
 * Until authentication exists, that answer is a fixed demo identity per role.
 * Nothing else in the codebase knows that — swap the resolver and every screen,
 * action and repository function stays exactly as it is.
 */
import type { ID } from "@repo/types";
import { USING_API } from "./client";

export type Role = "client" | "professional" | "sales_agent" | "admin";

export type Actor =
  | { role: "client"; userId: ID; clientId: ID }
  | { role: "professional"; userId: ID; professionalId: ID }
  | { role: "sales_agent"; userId: ID; salesAgentId: ID }
  | { role: "admin"; userId: ID };

/**
 * The demo identities each surface runs as until authentication exists. Named
 * explicitly so a search for "DEMO_ACTORS" finds every place that has to change.
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
  sales_agent: {
    role: "sales_agent",
    userId: "user-sales-kavita",
    salesAgentId: "sales-kavita",
  },
  admin: {
    role: "admin",
    userId: "user-admin",
  },
} as const satisfies Record<Role, Actor>;

/**
 * Thrown where an action needs an identity the current session does not have.
 * Every app should render this as "please sign in" rather than a crash — which
 * is what real auth will require anyway.
 */
export class NotAuthenticatedError extends Error {
  constructor(message = "No signed-in user for this action") {
    super(message);
    this.name = "NotAuthenticatedError";
  }
}

/** Signed in, but not as the kind of user this operation needs. */
export class WrongRoleError extends NotAuthenticatedError {
  constructor(expected: Role, actual: Role) {
    super(`This needs a ${expected} session; the caller is a ${actual}`);
    this.name = "WrongRoleError";
  }
}

/* ------------------------------------------------------------------ *
 * The resolver
 * ------------------------------------------------------------------ */

export type SessionResolver = () => Promise<Actor | null> | Actor | null;

let resolver: SessionResolver | null = null;

/**
 * Registers how this process finds the signed-in user.
 *
 * Called once, from each app's `instrumentation.ts`, with a function that reads
 * the request — `cookies()` from `next/headers`, a JWT, whatever auth turns out
 * to be. The function is invoked per request, so it sees request-scoped context
 * even though it was registered at startup.
 *
 * With no resolver registered the demo identities below are used, which is what
 * keeps the seed-data preview working with no auth at all.
 */
export function configureSession(fn: SessionResolver): void {
  resolver = fn;
}

/** The current caller, or null when nobody is signed in. */
export async function getActor(): Promise<Actor | null> {
  return resolver ? await resolver() : null;
}

/**
 * The current caller in a known role.
 *
 * In demo mode this hands back the seeded identity for that role, so each
 * surface behaves as the right person without any plumbing. Once a backend is
 * configured the fallback is gone: no session means no data, which is the
 * behaviour that has to hold in production.
 */
async function actorAs<R extends Role>(role: R): Promise<Extract<Actor, { role: R }>> {
  type Wanted = Extract<Actor, { role: R }>;
  const actor = await getActor();

  if (!actor) {
    if (USING_API) throw new NotAuthenticatedError();
    return DEMO_ACTORS[role] as unknown as Wanted;
  }

  // Staff roles overlap: an admin may do anything a sales agent may do.
  if (role === "sales_agent" && actor.role === "admin") {
    return {
      role: "sales_agent",
      userId: actor.userId,
      salesAgentId: actor.userId,
    } as unknown as Wanted;
  }

  if (actor.role !== role) throw new WrongRoleError(role, actor.role);
  return actor as Wanted;
}

/* ------------------------------------------------------------------ *
 * What call sites actually use
 * ------------------------------------------------------------------ */

/** The signed-in customer. Throws rather than guessing. */
export async function currentClientId(): Promise<ID> {
  return (await actorAs("client")).clientId;
}

/** The signed-in professional. */
export async function currentProfessionalId(): Promise<ID> {
  return (await actorAs("professional")).professionalId;
}

/** The signed-in sales agent — or an admin acting as one. */
export async function currentAgentId(): Promise<ID> {
  return (await actorAs("sales_agent")).salesAgentId;
}

/**
 * The signed-in user's id, whoever they are. For records that reference a user
 * rather than a role — notifications, support tickets, audit trails.
 */
export async function currentUserId(): Promise<ID> {
  const actor = await getActor();
  if (actor) return actor.userId;
  if (USING_API) throw new NotAuthenticatedError();
  return DEMO_ACTORS.client.userId;
}

/**
 * The signed-in staff member's user id. Distinct from `currentUserId` because
 * an ops write attributed to a customer would be a silent authorisation hole.
 */
export async function currentStaffUserId(): Promise<ID> {
  const actor = await getActor();
  if (actor) {
    if (actor.role !== "admin" && actor.role !== "sales_agent") {
      throw new WrongRoleError("admin", actor.role);
    }
    return actor.userId;
  }
  if (USING_API) throw new NotAuthenticatedError();
  return DEMO_ACTORS.admin.userId;
}

/* ------------------------------------------------------------------ *
 * Narrowing helpers, for code that already holds an Actor
 * ------------------------------------------------------------------ */

export function requireClient(actor: Actor): ID {
  if (actor.role !== "client") throw new WrongRoleError("client", actor.role);
  return actor.clientId;
}

export function requireProfessional(actor: Actor): ID {
  if (actor.role !== "professional") throw new WrongRoleError("professional", actor.role);
  return actor.professionalId;
}

export function requireStaff(actor: Actor): ID {
  if (actor.role !== "sales_agent" && actor.role !== "admin") {
    throw new WrongRoleError("admin", actor.role);
  }
  return actor.userId;
}
