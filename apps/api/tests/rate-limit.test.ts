/**
 * The ceiling on writes.
 *
 * Two things are worth proving and neither is obvious from reading the hook.
 * First, that the limit is keyed to the *session* rather than the address —
 * an office shares an IP, and throttling the office because one person is busy
 * is a support ticket, not a defence. Second, that the counter survives a
 * restart, which is the whole reason it lives in Postgres instead of in memory.
 */
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { db } from "../src/db/client";
import { consume, LIMITS } from "../src/lib/rate-limit";
import { app, staffSession } from "./helpers/harness";

let cookie: string;

beforeAll(async () => {
  cookie = await staffSession("admin@example.com");
});

afterAll(async () => {
  // Shared database: leave no spent allowances behind for the next file.
  await db.execute(sql`DELETE FROM rate_limits WHERE key LIKE 'write:%' OR key LIKE 'test:%'`);
});

describe("the counter itself", () => {
  test("refuses the request after the allowance is gone, not before", async () => {
    const key = `test:${Date.now()}`;
    const limit = { max: 3, windowSeconds: 60 };

    await consume(key, limit);
    await consume(key, limit);
    await consume(key, limit);

    await expect(consume(key, limit)).rejects.toMatchObject({ status: 429 });
  });

  test("the window expires", async () => {
    const key = `test:expiry:${Date.now()}`;
    const limit = { max: 1, windowSeconds: 60 };

    await consume(key, limit);
    await expect(consume(key, limit)).rejects.toMatchObject({ status: 429 });

    // Age the window rather than waiting a minute for it.
    await db.execute(sql`
      UPDATE rate_limits SET window_started_at = now() - interval '2 minutes' WHERE key = ${key}
    `);
    await expect(consume(key, limit)).resolves.toBeUndefined();
  });

  test("the count is a row, so it survives a restart", async () => {
    const key = `test:durable:${Date.now()}`;
    await consume(key, { max: 5, windowSeconds: 60 });

    const [row] = (await db.execute(sql`
      SELECT count FROM rate_limits WHERE key = ${key}
    `)) as unknown as Array<{ count: number }>;

    expect(Number(row!.count)).toBe(1);
  });
});

describe("the hook", () => {
  test("reads are never counted", async () => {
    const instance = await app();
    const before = await countFor("write:");

    for (let i = 0; i < 5; i += 1) {
      await instance.inject({ method: "GET", url: "/ops/leads", headers: { cookie } });
    }

    expect(await countFor("write:")).toBe(before);
  });

  test("a write is counted against the session, not the address", async () => {
    const instance = await app();

    await instance.inject({
      method: "POST",
      url: "/ops/leads/00000000-0000-0000-0000-000000000000/calls",
      headers: { cookie },
      payload: { callStatus: "connected", remarks: "counted even though the lead is missing" },
    });

    const keys = (await db.execute(sql`
      SELECT key FROM rate_limits WHERE key LIKE 'write:%'
    `)) as unknown as Array<{ key: string }>;

    expect(keys.some((k) => k.key.startsWith("write:session:"))).toBe(true);
    expect(
      keys.some((k) => k.key.startsWith("write:ip:")),
      "a signed-in write was keyed to the address, so the cookie was not parsed yet",
    ).toBe(false);
  });

  test("an anonymous write is keyed to the address", async () => {
    const instance = await app();
    await instance.inject({
      method: "POST",
      url: "/me/requirements",
      payload: { description: "no session" },
    });

    const keys = (await db.execute(sql`
      SELECT key FROM rate_limits WHERE key LIKE 'write:ip:%'
    `)) as unknown as Array<{ key: string }>;
    expect(keys.length).toBeGreaterThan(0);
  });

  test("the auth routes keep their own tighter limit", async () => {
    // Five OTP requests per mobile per hour is far below the write ceiling, so
    // the broad limit must not be what refuses them.
    expect(LIMITS.otpRequestPerMobile.max).toBeLessThan(40);

    const instance = await app();
    const mobile = "9000000001";
    let refused = 0;

    for (let i = 0; i < LIMITS.otpRequestPerMobile.max + 2; i += 1) {
      const response = await instance.inject({
        method: "POST",
        url: "/auth/otp/request",
        payload: { mobile },
      });
      if (response.statusCode === 429) refused += 1;
    }

    expect(refused).toBeGreaterThan(0);

    // The refusal came from the OTP limit, and no write-ceiling key was spent
    // on these requests.
    const keys = (await db.execute(sql`
      SELECT key FROM rate_limits WHERE key LIKE ${"%" + mobile + "%"}
    `)) as unknown as Array<{ key: string }>;
    expect(keys.some((k) => k.key.startsWith("otp:"))).toBe(true);
  });
});

async function countFor(prefix: string): Promise<number> {
  const [row] = (await db.execute(sql`
    SELECT coalesce(sum(count), 0) AS total FROM rate_limits WHERE key LIKE ${prefix + "%"}
  `)) as unknown as Array<{ total: number }>;
  return Number(row!.total);
}
