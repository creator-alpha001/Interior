/** Password sign-in for customers and professionals. */
import argon2 from "argon2";
import { and, eq, isNull } from "drizzle-orm";
import type { Actor } from "@repo/types";
import { db } from "../../db/client";
import * as t from "../../db/schema";
import { NotAuthenticatedError } from "../../lib/errors";
import { findActorByMobile } from "./repository";

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

export async function hasUserPassword(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: t.userPasswordCredentials.id })
    .from(t.userPasswordCredentials)
    .where(
      and(
        eq(t.userPasswordCredentials.userId, userId),
        isNull(t.userPasswordCredentials.deletedAt),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function setUserPassword(userId: string, password: string): Promise<void> {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const now = new Date().toISOString();

  await db
    .insert(t.userPasswordCredentials)
    .values({ userId, passwordHash, passwordChangedAt: now })
    .onConflictDoUpdate({
      target: t.userPasswordCredentials.userId,
      set: {
        passwordHash,
        passwordChangedAt: now,
        failedAttempts: 0,
        lockedUntil: null,
        deletedAt: null,
      },
    });
}

export async function authenticateUserPassword(
  mobile: string,
  password: string,
): Promise<Actor> {
  const wrong = () => new NotAuthenticatedError("That mobile number or password is not right");
  const actor = await findActorByMobile(mobile);

  if (!actor) {
    // Keep missing accounts close to a real Argon2 verification time so this
    // endpoint cannot be used to enumerate registered mobile numbers.
    await argon2.hash(password, { type: argon2.argon2id });
    throw wrong();
  }

  const [credential] = await db
    .select()
    .from(t.userPasswordCredentials)
    .where(
      and(
        eq(t.userPasswordCredentials.userId, actor.userId),
        isNull(t.userPasswordCredentials.deletedAt),
      ),
    )
    .limit(1);

  if (!credential) {
    await argon2.hash(password, { type: argon2.argon2id });
    throw new NotAuthenticatedError(
      "No password has been set for this number. Sign in with a WhatsApp code first.",
    );
  }

  if (credential.lockedUntil && new Date(credential.lockedUntil) > new Date()) {
    throw new NotAuthenticatedError("Too many attempts. Try again in a few minutes.");
  }

  if (!(await argon2.verify(credential.passwordHash, password))) {
    const attempts = Math.min(MAX_FAILED_LOGINS, credential.failedAttempts + 1);
    await db
      .update(t.userPasswordCredentials)
      .set({
        failedAttempts: attempts,
        lockedUntil:
          attempts >= MAX_FAILED_LOGINS
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString()
            : null,
      })
      .where(eq(t.userPasswordCredentials.id, credential.id));
    throw wrong();
  }

  await db
    .update(t.userPasswordCredentials)
    .set({ failedAttempts: 0, lockedUntil: null })
    .where(eq(t.userPasswordCredentials.id, credential.id));

  return actor;
}
