/**
 * Server-side sessions.
 *
 * The cookie carries a random opaque token; the database holds a SHA-256 of it.
 * A leaked backup therefore hands nobody a working session, and revoking one is
 * a single UPDATE — which matters, because suspending a vendor has to log them
 * out of a portal they are looking at, not the next time a token expires.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import type { Actor, SessionUser } from "@repo/types";
import { db } from "../../db/client";
import * as t from "../../db/schema";
import { config } from "../../lib/config";

/** The cookie name, shared with the frontends' session resolver. */
export const SESSION_COOKIE = "aangan_session";

/**
 * Where the session token comes from.
 *
 * Two carriers, one session. The web frontends send a cookie, because they are
 * browsers. The mobile apps send `Authorization: Bearer`, because they are not
 * — and a native client holding a cookie jar inherits SameSite, Secure and
 * domain questions that mean nothing to it, while making "am I signed in" a
 * property of the jar rather than a value the app owns and can clear.
 *
 * What deliberately does **not** change is everything behind this line. The
 * token is still 32 random bytes, the database still holds only its SHA-256,
 * revocation is still a single UPDATE that takes effect on the next request,
 * and the row-level-security identity is still derived from the same lookup.
 * This is a second envelope, not a second scheme — in particular it is not a
 * JWT, because suspending a vendor has to log them out of the portal they are
 * looking at rather than at the next expiry.
 *
 * The header wins when both are present, which only happens in a test.
 */
export function sessionTokenFrom(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;

  if (header) {
    const [scheme, ...rest] = header.split(" ");
    if (scheme?.toLowerCase() === "bearer") {
      const token = rest.join(" ").trim();
      if (token) return token;
    }
  }

  return request.cookies?.[SESSION_COOKIE];
}

/**
 * Whether this caller wants the token in the response body.
 *
 * A cookie is still set either way — it costs nothing and keeps the web
 * frontends working unchanged — but a client that asks gets the value it needs
 * to put in a header next time. Asking is explicit so the token is never
 * returned to a browser that did not want it and would only leave it lying in
 * a JavaScript variable.
 */
export function wantsTokenInBody(request: FastifyRequest): boolean {
  const client = request.headers["x-client"];
  const value = Array.isArray(client) ? client[0] : client;
  return value?.toLowerCase() === "mobile";
}

const SESSION_DAYS = 30;

/**
 * SHA-256 rather than argon2 here, deliberately.
 *
 * A session token is 32 bytes of real randomness, so there is no dictionary to
 * attack and nothing for a slow hash to buy — and this runs on every single
 * request, where argon2 would cost tens of milliseconds each time.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface IssuedSession {
  token: string;
  expiresAt: Date;
}

export async function createSession(
  userId: string,
  context: { userAgent?: string; ip?: string } = {},
): Promise<IssuedSession> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await db.insert(t.sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: expiresAt.toISOString(),
    userAgent: context.userAgent ?? null,
    ip: context.ip ?? null,
  });

  return { token, expiresAt };
}

/**
 * Resolves a cookie value to the caller.
 *
 * Returns null for anything wrong — unknown, expired, revoked, or belonging to
 * a user who has since been blocked. The caller cannot tell which, and does not
 * need to.
 */
export async function resolveSession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;

  const [row] = await db
    .select({
      sessionId: t.sessions.id,
      user: t.users,
      clientId: t.clients.id,
      professionalId: t.professionals.id,
      salesAgentId: t.salesAgents.id,
    })
    .from(t.sessions)
    .innerJoin(t.users, eq(t.users.id, t.sessions.userId))
    .leftJoin(t.clients, eq(t.clients.userId, t.users.id))
    .leftJoin(t.professionals, eq(t.professionals.userId, t.users.id))
    .leftJoin(t.salesAgents, eq(t.salesAgents.userId, t.users.id))
    .where(
      and(
        eq(t.sessions.tokenHash, hashToken(token)),
        isNull(t.sessions.revokedAt),
        gt(t.sessions.expiresAt, sql`now()`),
        eq(t.users.status, "active"),
        isNull(t.users.deletedAt),
      ),
    )
    .limit(1);

  if (!row) return null;

  // Fire and forget: knowing when a session was last used is worth having for
  // support, but not worth making every request wait for a write.
  void db
    .update(t.sessions)
    .set({ lastSeenAt: new Date().toISOString() })
    .where(eq(t.sessions.id, row.sessionId))
    .catch(() => {});

  const actor = toActor(row);
  if (!actor) return null;

  return {
    actor,
    name: row.user.name,
    mobile: row.user.mobile,
    /**
     * Having a number and having proved it are separate answers.
     *
     * Ops type numbers in from a phone call, so a present `mobile` is not by
     * itself evidence the account holder confirmed it. A screen that showed one
     * of those as verified would be telling the person something we do not know.
     */
    mobileVerified: row.user.mobileVerifiedAt !== null,
    /**
     * Carried on the session so every client knows what is still unanswered
     * without a second call. Null is what the "where are you?" prompts key off.
     */
    cityId: row.user.cityId,
    avatarUrl: row.user.avatarUrl,
  };
}

function toActor(row: {
  user: typeof t.users.$inferSelect;
  clientId: string | null;
  professionalId: string | null;
  salesAgentId: string | null;
}): Actor | null {
  const { user } = row;

  switch (user.role) {
    case "client":
      // A client row missing its profile is a broken account, not a session
      // with unlimited scope. Refuse rather than guess.
      return row.clientId ? { role: "client", userId: user.id, clientId: row.clientId } : null;
    case "professional":
      return row.professionalId
        ? { role: "professional", userId: user.id, professionalId: row.professionalId }
        : null;
    case "sales_agent":
      return row.salesAgentId
        ? { role: "sales_agent", userId: user.id, salesAgentId: row.salesAgentId }
        : null;
    case "admin":
      return { role: "admin", userId: user.id };
    default:
      return null;
  }
}

export async function revokeSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await db
    .update(t.sessions)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(t.sessions.tokenHash, hashToken(token)));
}

/** Every session for a user. Used when an account is suspended or blocked. */
export async function revokeAllSessions(userId: string): Promise<void> {
  await db
    .update(t.sessions)
    .set({ revokedAt: new Date().toISOString() })
    .where(and(eq(t.sessions.userId, userId), isNull(t.sessions.revokedAt)));
}

/** How the cookie is set, in one place so the flags cannot drift between routes. */
export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    // Lax rather than Strict: the customer site links out to payment pages and
    // email, and Strict would drop the session on the way back.
    sameSite: "lax" as const,
    secure: config.isProduction,
    path: "/",
    expires: expiresAt,
  };
}
