/**
 * One-time codes.
 *
 * The code is never stored — only an argon2 hash of it. A six-digit code is
 * only a million possibilities, so a leaked backup with codes in it would hand
 * somebody a working login for every number that signed in that hour.
 */
import { randomInt, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../../db/client";
import * as t from "../../db/schema";
import { ValidationError } from "../../lib/errors";

const CODE_DIGITS = 6;
const EXPIRY_MINUTES = 5;
/** After this many wrong guesses the challenge is dead and a new code is needed. */
const MAX_ATTEMPTS = 3;

/** `randomInt` rather than Math.random: this value is a credential. */
function generateCode(): string {
  return String(randomInt(0, 10 ** CODE_DIGITS)).padStart(CODE_DIGITS, "0");
}

export interface Challenge {
  id: string;
  expiresAt: Date;
  /** Only populated when OTP_DEV_ECHO is on, so local work needs no SMS account. */
  devCode?: string;
}

export async function createChallenge(mobile: string, ip?: string): Promise<{
  challenge: Challenge;
  code: string;
}> {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60_000);

  // Any earlier code for this number stops working the moment a new one is
  // sent, so a code read over somebody's shoulder yesterday is worthless.
  await db
    .update(t.otpChallenges)
    .set({ consumedAt: new Date().toISOString() })
    .where(and(eq(t.otpChallenges.mobile, mobile), isNull(t.otpChallenges.consumedAt)));

  const [row] = await db
    .insert(t.otpChallenges)
    .values({
      mobile,
      codeHash: await argon2.hash(code, { type: argon2.argon2id }),
      expiresAt: expiresAt.toISOString(),
      ip: ip ?? null,
    })
    .returning({ id: t.otpChallenges.id });

  return {
    challenge: { id: row!.id, expiresAt },
    code,
  };
}

export interface VerifiedChallenge {
  mobile: string;
}

/**
 * Checks a code and burns the challenge.
 *
 * Every failure gives the same message. Distinguishing "no such challenge" from
 * "wrong code" from "expired" tells an attacker which of their assumptions was
 * right, and tells a real user nothing they can act on differently.
 */
export async function verifyChallenge(
  challengeId: string,
  code: string,
): Promise<VerifiedChallenge> {
  const wrong = () => new ValidationError("That code is not right, or it has expired");

  const [row] = await db
    .select()
    .from(t.otpChallenges)
    .where(eq(t.otpChallenges.id, challengeId))
    .limit(1);

  if (!row) throw wrong();
  if (row.consumedAt) throw wrong();
  if (new Date(row.expiresAt) < new Date()) throw wrong();
  if (row.attempts >= MAX_ATTEMPTS) throw wrong();

  const matches = await argon2.verify(row.codeHash, code);

  if (!matches) {
    await db
      .update(t.otpChallenges)
      .set({ attempts: sql`${t.otpChallenges.attempts} + 1` })
      .where(eq(t.otpChallenges.id, challengeId));
    throw wrong();
  }

  // Consumed on success, so the same code cannot open a second session.
  await db
    .update(t.otpChallenges)
    .set({ consumedAt: new Date().toISOString() })
    .where(eq(t.otpChallenges.id, challengeId));

  return { mobile: row.mobile };
}

/** Removes spent and expired challenges. Run hourly. */
export async function sweepExpired(): Promise<number> {
  const rows = await db
    .delete(t.otpChallenges)
    .where(sql`${t.otpChallenges.expiresAt} < now() - interval '1 day'`)
    .returning({ id: t.otpChallenges.id });
  return rows.length;
}
