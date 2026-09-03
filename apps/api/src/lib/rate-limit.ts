/**
 * Rate limiting, in Postgres rather than in memory.
 *
 * An in-process counter gives an attacker one full allowance per API instance,
 * and resets every deploy. Both matter here: the limits below are the only
 * thing standing between a phone number and an unlimited supply of OTP guesses.
 *
 * The counter is a single upsert, so two concurrent requests cannot both read
 * "4 used" and both write "5".
 */
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { RateLimitedError } from "./errors";

export interface Limit {
  /** How many actions are allowed inside the window. */
  max: number;
  windowSeconds: number;
}

/**
 * The limits, named so a call site reads as the rule it enforces.
 *
 * OTP requests are deliberately tighter per mobile than per IP: a household or
 * an office shares an IP, but a phone number is one person.
 */
export const LIMITS = {
  otpRequestPerMobile: { max: 5, windowSeconds: 3600 },
  otpRequestPerIp: { max: 20, windowSeconds: 3600 },
  otpVerifyPerIp: { max: 30, windowSeconds: 3600 },
  staffLoginPerEmail: { max: 10, windowSeconds: 900 },
  staffLoginPerIp: { max: 30, windowSeconds: 900 },
} as const satisfies Record<string, Limit>;

/**
 * Records one use of `key` and throws once the allowance is gone.
 *
 * The window is fixed rather than sliding — simpler, and the difference only
 * matters to an attacker timing requests around a boundary, who still cannot
 * exceed twice the rate.
 */
export async function consume(key: string, limit: Limit): Promise<void> {
  const [row] = await db.execute<{ count: number }>(sql`
    INSERT INTO rate_limits (key, count, window_started_at)
    VALUES (${key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN rate_limits.window_started_at < now() - (${limit.windowSeconds} * interval '1 second')
          THEN 1
        ELSE rate_limits.count + 1
      END,
      window_started_at = CASE
        WHEN rate_limits.window_started_at < now() - (${limit.windowSeconds} * interval '1 second')
          THEN now()
        ELSE rate_limits.window_started_at
      END
    RETURNING count
  `);

  if ((row?.count ?? 0) > limit.max) {
    throw new RateLimitedError(limit.windowSeconds);
  }
}

/** Clears a key. Used after a successful sign-in, so one typo is not punished. */
export async function reset(key: string): Promise<void> {
  await db.execute(sql`DELETE FROM rate_limits WHERE key = ${key}`);
}
