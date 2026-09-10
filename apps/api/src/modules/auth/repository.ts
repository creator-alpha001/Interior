/**
 * Finding and creating accounts at sign-in.
 *
 * Signing up and signing in are the same action for customers: an unrecognised
 * mobile number becomes an account. A vendor is different — a professional
 * record is created by ops after verification, so someone who is not yet a
 * vendor simply signs in as a customer, and /partner stays behind that gate.
 */
import { and, eq, isNull } from "drizzle-orm";
import argon2 from "argon2";
import { authenticator } from "otplib";
import type { Actor } from "@repo/types";
import { db, transaction } from "../../db/client";
import * as t from "../../db/schema";
import { NotAuthenticatedError, ValidationError } from "../../lib/errors";

/**
 * The actor for a mobile number, creating a customer account if there is none.
 *
 * Deliberately does not accept a role: a caller cannot ask to be created as a
 * vendor or an admin. Those are made by ops.
 */
export async function actorForMobile(
  mobile: string,
  profile: { name?: string; cityId?: string },
): Promise<Actor> {
  const existing = await findActorByMobile(mobile);
  if (existing) return existing;

  return transaction(async (tx) => {
    // Every user needs a city, and the form may not have asked. Falling back to
    // the first active city keeps signup to one screen; ops correct it on the
    // scoping call, which happens for every lead anyway.
    let cityId = profile.cityId;
    if (!cityId) {
      const [city] = await tx
        .select({ id: t.cities.id })
        .from(t.cities)
        .where(eq(t.cities.isActive, true))
        .limit(1);
      if (!city) throw new Error("No active city configured");
      cityId = city.id;
    }

    const [user] = await tx
      .insert(t.users)
      .values({
        name: profile.name?.trim() || "New customer",
        mobile,
        role: "client",
        cityId,
        status: "active",
      })
      .returning({ id: t.users.id });

    const [client] = await tx
      .insert(t.clients)
      .values({
        userId: user!.id,
        referralCode: buildReferralCode(profile.name, mobile),
      })
      .returning({ id: t.clients.id });

    return { role: "client", userId: user!.id, clientId: client!.id } satisfies Actor;
  });
}

/**
 * A referral code somebody can read out over the phone.
 *
 * First name plus the last four digits of the number: memorable, unique enough
 * in practice, and the unique index catches the rest.
 */
function buildReferralCode(name: string | undefined, mobile: string): string {
  const first = (name?.trim().split(" ")[0] ?? "INTERIOBEE").toUpperCase().replace(/[^A-Z]/g, "");
  return `${first.slice(0, 8) || "INTERIOBEE"}${mobile.slice(-4)}`;
}

/** The columns every sign-in path needs to decide what kind of actor this is. */
const actorColumns = {
  user: t.users,
  clientId: t.clients.id,
  professionalId: t.professionals.id,
  salesAgentId: t.salesAgents.id,
} as const;

type ActorRow = {
  user: typeof t.users.$inferSelect;
  clientId: string | null;
  professionalId: string | null;
  salesAgentId: string | null;
};

/**
 * Turns a joined row into an actor, applying the rules that hold for every
 * sign-in method rather than just for SMS.
 *
 * Shared because Google sign-in must enforce exactly the same three: a blocked
 * account cannot sign in, staff never arrive this way, and a role with no
 * matching profile row is not a usable session. Left in `findActorByMobile`
 * they would have been quietly absent from the Google path, and "an admin can
 * sign in with Google and get a customer session" is not a bug anybody would
 * notice from reading either function alone.
 */
function actorFromRow(row: ActorRow | undefined, method: "sms" | "provider"): Actor | null {
  if (!row) return null;

  // A blocked account must not be able to sign in at all — not even to a
  // read-only screen.
  if (row.user.status !== "active") throw new NotAuthenticatedError("This account is not active");

  // Staff never sign in this way. Falling through to a client session for an
  // admin whose mobile or Google address happens to be known would be a
  // privilege downgrade at best and a confusing half-session at worst.
  if (row.user.role === "admin" || row.user.role === "sales_agent") {
    throw new NotAuthenticatedError(
      method === "sms"
        ? "Staff accounts sign in with a password"
        : "Staff accounts sign in with a password, not with Google",
    );
  }

  if (row.user.role === "professional") {
    return row.professionalId
      ? { role: "professional", userId: row.user.id, professionalId: row.professionalId }
      : null;
  }

  return row.clientId
    ? { role: "client", userId: row.user.id, clientId: row.clientId }
    : null;
}

export async function findActorByMobile(mobile: string): Promise<Actor | null> {
  const [row] = await db
    .select(actorColumns)
    .from(t.users)
    .leftJoin(t.clients, eq(t.clients.userId, t.users.id))
    .leftJoin(t.professionals, eq(t.professionals.userId, t.users.id))
    .leftJoin(t.salesAgents, eq(t.salesAgents.userId, t.users.id))
    .where(and(eq(t.users.mobile, mobile), isNull(t.users.deletedAt)))
    .limit(1);

  return actorFromRow(row, "sms");
}

/**
 * The actor behind a provider's subject claim, or null if it is not linked yet.
 *
 * Looked up by `(provider, subject)` and never by email. The address on a
 * Google account can be changed by its owner and can be reissued to somebody
 * else years later; the subject is stable and belongs to one person. Matching
 * on email here is the standard way accounts get taken over.
 */
export async function findActorByIdentity(
  provider: "google" | "apple",
  subject: string,
): Promise<Actor | null> {
  const [row] = await db
    .select(actorColumns)
    .from(t.authIdentities)
    .innerJoin(t.users, eq(t.users.id, t.authIdentities.userId))
    .leftJoin(t.clients, eq(t.clients.userId, t.users.id))
    .leftJoin(t.professionals, eq(t.professionals.userId, t.users.id))
    .leftJoin(t.salesAgents, eq(t.salesAgents.userId, t.users.id))
    .where(
      and(
        eq(t.authIdentities.provider, provider),
        eq(t.authIdentities.subject, subject),
        isNull(t.authIdentities.deletedAt),
        isNull(t.users.deletedAt),
      ),
    )
    .limit(1);

  const actor = actorFromRow(row, "provider");
  if (actor) {
    await db
      .update(t.authIdentities)
      .set({ lastUsedAt: new Date().toISOString() })
      .where(
        and(eq(t.authIdentities.provider, provider), eq(t.authIdentities.subject, subject)),
      );
  }
  return actor;
}

/**
 * Attaches a provider account to a user, after the mobile number has been
 * proved by a code.
 *
 * Idempotent on `(provider, subject)`: pressing the button twice, or an SMS
 * arriving late and the person starting again, must not fail. The conflict
 * clause deliberately does not move an identity to a different user — that
 * would let anyone who can complete an OTP on *their own* number claim a Google
 * account already linked to somebody else's.
 */
export async function linkIdentity(
  userId: string,
  identity: { provider: "google" | "apple"; subject: string; email: string },
): Promise<void> {
  await db
    .insert(t.authIdentities)
    .values({
      userId,
      provider: identity.provider,
      subject: identity.subject,
      email: identity.email,
      lastUsedAt: new Date().toISOString(),
    })
    .onConflictDoNothing({
      target: [t.authIdentities.provider, t.authIdentities.subject],
    });
}

/* ------------------------------------------------------------------ *
 * Staff
 * ------------------------------------------------------------------ */

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

/**
 * Password plus TOTP, for ops and admin.
 *
 * Every failure returns the same message for the same reason as the OTP flow:
 * "no such email" and "wrong password" together are an account enumeration
 * tool.
 */
export async function authenticateStaff(
  email: string,
  password: string,
  totp: string | undefined,
): Promise<Actor> {
  const wrong = () => new NotAuthenticatedError("Those details are not right");

  const [row] = await db
    .select({
      user: t.users,
      credentials: t.staffCredentials,
      salesAgentId: t.salesAgents.id,
    })
    .from(t.users)
    .innerJoin(t.staffCredentials, eq(t.staffCredentials.userId, t.users.id))
    .leftJoin(t.salesAgents, eq(t.salesAgents.userId, t.users.id))
    .where(and(eq(t.users.email, email), isNull(t.users.deletedAt)))
    .limit(1);

  if (!row) {
    // Spend roughly the time a real verify would, so a missing account is not
    // detectable by how quickly the answer comes back.
    await argon2.hash(password, { type: argon2.argon2id });
    throw wrong();
  }

  if (row.credentials.lockedUntil && new Date(row.credentials.lockedUntil) > new Date()) {
    throw new NotAuthenticatedError("Too many attempts. Try again in a few minutes.");
  }

  if (row.user.status !== "active") throw wrong();

  const passwordOk = await argon2.verify(row.credentials.passwordHash, password);
  if (!passwordOk) {
    await recordFailedStaffLogin(row.credentials.id, row.credentials.failedAttempts + 1);
    throw wrong();
  }

  if (row.credentials.totpSecret && row.credentials.totpConfirmedAt) {
    if (!totp) throw new ValidationError("Enter the code from your authenticator app");
    if (!authenticator.verify({ token: totp, secret: row.credentials.totpSecret })) {
      await recordFailedStaffLogin(row.credentials.id, row.credentials.failedAttempts + 1);
      throw wrong();
    }
  }

  await db
    .update(t.staffCredentials)
    .set({ failedAttempts: 0, lockedUntil: null })
    .where(eq(t.staffCredentials.id, row.credentials.id));

  if (row.user.role === "admin") return { role: "admin", userId: row.user.id };
  if (row.user.role === "sales_agent" && row.salesAgentId) {
    return { role: "sales_agent", userId: row.user.id, salesAgentId: row.salesAgentId };
  }

  // Credentials that belong to a non-staff user are a data problem, not a
  // reason to hand out a session.
  throw wrong();
}

async function recordFailedStaffLogin(credentialsId: string, attempts: number): Promise<void> {
  await db
    .update(t.staffCredentials)
    .set({
      failedAttempts: attempts,
      lockedUntil:
        attempts >= MAX_FAILED_LOGINS
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString()
          : null,
    })
    .where(eq(t.staffCredentials.id, credentialsId));
}

/** Sets or replaces a staff password. Used by the seeding script and by admin. */
export async function setStaffPassword(userId: string, password: string): Promise<void> {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  await db
    .insert(t.staffCredentials)
    .values({ userId, passwordHash })
    .onConflictDoUpdate({
      target: t.staffCredentials.userId,
      set: {
        passwordHash,
        passwordChangedAt: new Date().toISOString(),
        failedAttempts: 0,
        lockedUntil: null,
      },
    });
}
