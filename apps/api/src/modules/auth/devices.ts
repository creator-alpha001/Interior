/**
 * Registering a handset for push, and forgetting it again.
 *
 * A device token identifies an *installation*, not a person, and the two come
 * apart in exactly the ways that matter: a phone is sold, a SIM is recycled, an
 * app is uninstalled, somebody signs out at an internet cafe. Each of those is
 * a case where continuing to push would deliver one person's leads to another,
 * so the row is bound to the session that created it and goes when that session
 * does.
 */
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, unscopedDb } from "../../db/client";
import * as t from "../../db/schema";
import { resolveSession } from "./sessions";
import { createHash } from "node:crypto";

export type DevicePlatform = "android" | "ios" | "web";

export interface DeviceRegistration {
  token: string;
  platform: DevicePlatform;
  appVersion?: string;
}

/**
 * Records a token for the signed-in user, replacing whatever it was bound to.
 *
 * An upsert on the token rather than an insert, because the same handset
 * re-registers on every launch and Firebase reissues tokens on its own
 * schedule. Crucially it also *re-points* a token: if this phone was signed in
 * as somebody else yesterday, the row now belongs to whoever is signed in
 * today, rather than delivering to both.
 */
export async function registerDevice(
  userId: string,
  sessionId: string | null,
  input: DeviceRegistration,
): Promise<void> {
  const now = new Date().toISOString();

  /*
   * On the unscoped pool, not the request's scoped connection.
   *
   * `device_tokens` is under row-level security, and the row this may need to
   * overwrite belongs to *whoever signed in on this handset last*. Under the
   * caller's scope that row is invisible — but the unique index on `token` is
   * enforced regardless of visibility, so the upsert would not update it, it
   * would fail with a duplicate key on a row the caller cannot see. That is a
   * phone changing hands, which is precisely the case this exists to handle.
   *
   * `unscopedDb` is the same non-superuser role with no actor stamped on the
   * connection, which the policies allow by design — it is how the jobs read.
   * Nothing here is weakened by it: `userId` comes from the session and is
   * never a parameter, so the only row a caller can create or claim is one
   * pointing at themselves. What they must also have is the token, which is a
   * long random value issued to that installation by the push provider.
   */
  await unscopedDb
    .insert(t.deviceTokens)
    .values({
      userId,
      sessionId,
      token: input.token,
      platform: input.platform,
      appVersion: input.appVersion ?? null,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: t.deviceTokens.token,
      set: {
        userId,
        sessionId,
        platform: input.platform,
        appVersion: input.appVersion ?? null,
        lastSeenAt: now,
        // A token that comes back is alive again, whatever the provider said
        // about it last week.
        failureCount: 0,
        disabledAt: null,
        updatedAt: now,
      },
    });
}

/** Removes one token, on an explicit sign-out from that device. */
export async function forgetDevice(userId: string, token: string): Promise<void> {
  await db
    .delete(t.deviceTokens)
    .where(and(eq(t.deviceTokens.userId, userId), eq(t.deviceTokens.token, token)));
}

/**
 * Removes the tokens belonging to one session, on sign-out.
 *
 * Called before the session is revoked, while the token still resolves. Takes
 * the raw session token so the caller does not have to resolve the session
 * twice, and does nothing at all when there is no session — signing out when
 * already signed out is not an error.
 */
export async function forgetDevicesForSession(sessionToken: string | undefined): Promise<void> {
  if (!sessionToken) return;

  const tokenHash = createHash("sha256").update(sessionToken).digest("hex");

  const [row] = await db
    .select({ id: t.sessions.id })
    .from(t.sessions)
    .where(eq(t.sessions.tokenHash, tokenHash))
    .limit(1);

  if (!row) return;

  await db.delete(t.deviceTokens).where(eq(t.deviceTokens.sessionId, row.id));
}

/** Every live token for a user. Disabled rows are never returned. */
export async function tokensForUsers(
  userIds: string[],
): Promise<Map<string, Array<{ token: string; platform: DevicePlatform }>>> {
  const byUser = new Map<string, Array<{ token: string; platform: DevicePlatform }>>();
  if (userIds.length === 0) return byUser;

  // Read unscoped as well: the dispatcher runs as a job, with no actor, and
  // reads across every user in the batch.
  const rows = await unscopedDb
    .select({
      userId: t.deviceTokens.userId,
      token: t.deviceTokens.token,
      platform: t.deviceTokens.platform,
    })
    .from(t.deviceTokens)
    .where(and(inArray(t.deviceTokens.userId, userIds), isNull(t.deviceTokens.disabledAt)));

  for (const row of rows) {
    const existing = byUser.get(row.userId);
    const entry = { token: row.token, platform: row.platform as DevicePlatform };
    if (existing) existing.push(entry);
    else byUser.set(row.userId, [entry]);
  }

  return byUser;
}

/**
 * Records that the provider rejected a token.
 *
 * `permanent` — an uninstalled app, an invalid registration — disables it at
 * once. Anything else counts up, and three consecutive failures disable it, so
 * a provider having a bad afternoon does not cost every user their push.
 */
export async function recordDeliveryFailure(token: string, permanent: boolean): Promise<void> {
  const now = new Date().toISOString();

  await db
    .update(t.deviceTokens)
    .set(
      permanent
        ? { disabledAt: now, updatedAt: now }
        : {
            failureCount: sql`${t.deviceTokens.failureCount} + 1`,
            disabledAt: sql`CASE WHEN ${t.deviceTokens.failureCount} + 1 >= 3 THEN now() ELSE NULL END`,
            updatedAt: now,
          },
    )
    .where(eq(t.deviceTokens.token, token));
}

/** Clears the failure count after a delivery that worked. */
export async function recordDeliverySuccess(token: string): Promise<void> {
  await db
    .update(t.deviceTokens)
    .set({ failureCount: 0, lastSeenAt: new Date().toISOString() })
    .where(and(eq(t.deviceTokens.token, token), sql`${t.deviceTokens.failureCount} > 0`));
}

/**
 * The session id behind a request's token, for binding a device to it.
 *
 * Resolving twice is a little wasteful, but the alternative is threading a
 * session id through every guard for the benefit of one endpoint.
 */
export async function sessionIdFor(sessionToken: string | undefined): Promise<string | null> {
  if (!sessionToken) return null;
  const tokenHash = createHash("sha256").update(sessionToken).digest("hex");
  const [row] = await db
    .select({ id: t.sessions.id })
    .from(t.sessions)
    .where(and(eq(t.sessions.tokenHash, tokenHash), isNull(t.sessions.revokedAt)))
    .limit(1);
  return row?.id ?? null;
}

export { resolveSession };
