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
import type { Actor, ActorRole, ID, SessionUser } from "@repo/types";
import { ApiError, USING_API, api, currentSessionCookie } from "./client";

// Re-exported so existing callers keep importing these from @repo/data, while
// the API imports them from @repo/types without pulling in the seed store.
export type { Actor, SessionUser };
export type Role = ActorRole;

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
/**
 * Asks the backend who the current request belongs to.
 *
 * Lives here rather than being registered from `instrumentation.ts`, which was
 * the original design and does not work: Next builds instrumentation as its own
 * module graph, so the registration wrote to a different copy of this module
 * than the screens import from, and every request came back signed out.
 *
 * No memoisation is needed. Next automatically deduplicates identical `GET`
 * fetches within a single render pass, so a page whose forty components each
 * ask who is signed in makes one request.
 */
async function resolveFromRequest(): Promise<SessionUser | null> {
  if (!USING_API) return null;

  const cookie = await currentSessionCookie();
  if (!cookie) return null;

  try {
    return await api<SessionUser>("/me", { headers: { cookie } });
  } catch (error) {
    // An expired or unknown session is the normal state of a signed-out
    // visitor, not a failure. Anything else is worth seeing in the logs, but
    // still resolves to "nobody" — a signed-out render is always valid.
    if (!(error instanceof ApiError) || !error.isUnauthorised) {
      console.error("Could not resolve the session:", error);
    }
    return null;
  }
}

export async function getActor(): Promise<Actor | null> {
  if (resolver) return resolver();
  return (await resolveFromRequest())?.actor ?? null;
}

/**
 * Who is signed in, with the name and avatar a screen needs to show them.
 *
 * Returns null where nobody is, and the seeded demo person where a demo session
 * is permitted — so a header can say who it is without every caller repeating
 * that decision.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!USING_API) return demoSessionUser();

  const session = await resolveFromRequest();
  if (session) return session;

  return demoSessionAllowed() ? demoSessionUser() : null;
}

function demoSessionUser(): SessionUser {
  return {
    actor: DEMO_ACTORS.client,
    name: "Priya Sharma",
    mobile: "",
    avatarUrl: null,
  };
}

/**
 * Whether an unauthenticated caller may fall back to a seeded demo identity.
 *
 * True when there is no backend at all — that is the whole preview, and there
 * is nobody's data to leak because there is no data but the seed.
 *
 * It stays true during the migration window if `NEXT_PUBLIC_ALLOW_DEMO_SESSION`
 * is set, because the surfaces move to the API one at a time: the catalogue can
 * be live on Postgres while the account pages are still on seed data, and
 * without this flag turning the API on would break every signed-in screen until
 * authentication lands.
 *
 * It is never true in a production build. That is the point of the second
 * condition — the flag is an aid for a half-migrated development environment,
 * not a way to run without auth.
 */
function demoSessionAllowed(): boolean {
  if (!USING_API) return true;
  if (process.env.NODE_ENV === "production") return false;
  return process.env.NEXT_PUBLIC_ALLOW_DEMO_SESSION === "true";
}

/**
 * Whether this deployment needs a real session before it will show anything
 * personal.
 *
 * Screens use it to decide between sending a signed-out visitor to the sign-in
 * page and rendering the demo identity. Without it a layout cannot tell "nobody
 * is signed in" from "nobody needs to be".
 */
export function authenticationRequired(): boolean {
  return !demoSessionAllowed();
}

/**
 * The current caller in a known role.
 *
 * Where a demo identity is permitted this hands back the seeded one for that
 * role, so each surface behaves as the right person with no plumbing. Otherwise
 * no session means no data, which is the behaviour that has to hold once real
 * accounts exist.
 */
async function actorAs<R extends Role>(role: R): Promise<Extract<Actor, { role: R }>> {
  type Wanted = Extract<Actor, { role: R }>;
  const actor = await getActor();

  if (!actor) {
    if (!demoSessionAllowed()) throw new NotAuthenticatedError();
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
  if (!demoSessionAllowed()) throw new NotAuthenticatedError();
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
  if (!demoSessionAllowed()) throw new NotAuthenticatedError();
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
