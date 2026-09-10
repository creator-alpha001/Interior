/**
 * Signing up without handing over a phone number or a city.
 *
 * These are regression tests for a specific product failure, not for a feature.
 * `users.mobile` was NOT NULL, so a first Google sign-in ended on a screen
 * demanding a number with no way past it — somebody who had just authenticated
 * successfully was stuck. The column is nullable now, and the tests that matter
 * are the ones that would fail if it quietly stopped being.
 *
 * Three things are checked in particular, because each one fails silently:
 *
 * - An account really can exist with neither a number nor a city. Not "the
 *   endpoint returns 200" — the row is read back and both columns are null.
 * - The city is *not* guessed. The old code filled in the first active city
 *   when it was not told, which is invisible until somebody notices they are
 *   being quoted Bengaluru rates in Lucknow.
 * - A number attached afterwards lands on the *session's* account and can never
 *   move an identity to somebody else's.
 */
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";
import { unscopedDb } from "../src/db/client";
import { issueLinkToken } from "../src/modules/auth/link-token";
import { reset } from "../src/lib/rate-limit";
import { app, maybe, one } from "./helpers/harness";

/** A Google subject nobody else in the suite uses. */
const subjectFor = (label: string) => `test-subject-${label}-${Date.now()}`;

/**
 * Completes a Google signup directly, without minting a real ID token.
 *
 * `google-auth.test.ts` covers the signature check against a real key; what is
 * under test here is what happens *after* Google has been believed, so the link
 * token — which is our own signed statement of that — is issued directly.
 */
async function signUpWithGoogle(options: { subject: string; name?: string; cityId?: string }) {
  const instance = await app();
  await reset("google:ip:127.0.0.1");

  return instance.inject({
    method: "POST",
    url: "/auth/google/complete",
    headers: { "x-client": "mobile" },
    payload: {
      linkToken: issueLinkToken({
        provider: "google",
        subject: options.subject,
        email: `${options.subject}@example.com`,
        name: options.name,
      }),
      ...(options.name ? { name: options.name } : {}),
      ...(options.cityId ? { cityId: options.cityId } : {}),
    },
  });
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

/**
 * Rows made here are read back by later assertions, so they cannot run inside a
 * rolled-back transaction. They are deleted at the end instead.
 */
const madeUsers: string[] = [];

afterAll(async () => {
  if (madeUsers.length > 0) {
    const ids = madeUsers.map((id) => `'${id}'::uuid`).join(", ");
    // Children first: `clients` and `auth_identities` both reference `users`.
    await unscopedDb.execute(sql.raw(`DELETE FROM auth_identities WHERE user_id IN (${ids})`));
    await unscopedDb.execute(sql.raw(`DELETE FROM sessions WHERE user_id IN (${ids})`));
    await unscopedDb.execute(sql.raw(`DELETE FROM clients WHERE user_id IN (${ids})`));
    await unscopedDb.execute(sql.raw(`DELETE FROM users WHERE id IN (${ids})`));
  }
  await unscopedDb.execute(
    sql`DELETE FROM rate_limits WHERE key LIKE 'otp:%' OR key LIKE 'google:%'`,
  );
});

describe("signing up with Google alone", () => {
  test("makes a usable account with no mobile number and no city", async () => {
    const subject = subjectFor("bare");
    const response = await signUpWithGoogle({ subject, name: "No Details" });

    expect(response.statusCode).toBe(200);
    const session = response.json<{ userId: string; role: string; sessionToken: string }>();
    madeUsers.push(session.userId);

    expect(session.role).toBe("client");

    /**
     * The assertion that matters. A 200 only proves the route did not throw;
     * this proves the account is genuinely allowed to exist in the state the
     * person chose, rather than having been quietly completed for them.
     */
    const row = await one<{ mobile: string | null; city_id: string | null }>(
      `SELECT mobile, city_id FROM users WHERE id = '${session.userId}'::uuid`,
    );
    expect(row.mobile).toBeNull();
    expect(row.city_id).toBeNull();

    // And the session works, which is the whole point — the account is not a
    // half-made thing waiting on a second step.
    const instance = await app();
    const me = await instance.inject({
      method: "GET",
      url: "/me",
      headers: bearer(session.sessionToken),
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ mobile: null, cityId: null, mobileVerified: false });
  });

  test("does not invent a city when it is not given", async () => {
    /*
     * The regression this exists for. `actorForMobile` used to fall back to the
     * first active city, so "I did not say" became "I live in whichever city
     * sorts first" — and every price, vendor and availability figure on the
     * site is per city, so the person was shown a catalogue that did not apply
     * to them with nothing on screen admitting it.
     */
    const subject = subjectFor("nocity");
    const response = await signUpWithGoogle({ subject, name: "Undeclared" });
    const session = response.json<{ userId: string }>();
    madeUsers.push(session.userId);

    const anyActiveCity = await maybe<{ id: string }>(
      `SELECT id FROM cities WHERE is_active = true LIMIT 1`,
    );
    expect(anyActiveCity).not.toBeNull();

    const row = await one<{ city_id: string | null }>(
      `SELECT city_id FROM users WHERE id = '${session.userId}'::uuid`,
    );
    expect(row.city_id).toBeNull();
  });

  test("keeps the city when one is given", async () => {
    const city = await one<{ id: string }>(
      `SELECT id FROM cities WHERE is_active = true LIMIT 1`,
    );
    const subject = subjectFor("withcity");
    const response = await signUpWithGoogle({ subject, name: "Declared", cityId: city.id });
    const session = response.json<{ userId: string }>();
    madeUsers.push(session.userId);

    const row = await one<{ city_id: string | null }>(
      `SELECT city_id FROM users WHERE id = '${session.userId}'::uuid`,
    );
    expect(row.city_id).toBe(city.id);
  });

  test("a second attempt with the same Google account signs in rather than duplicating", async () => {
    // A double-submitted form, or a second tab. Making two accounts for one
    // Google subject would be far worse than making none.
    const subject = subjectFor("twice");

    const first = await signUpWithGoogle({ subject, name: "Twice" });
    const firstSession = first.json<{ userId: string }>();
    madeUsers.push(firstSession.userId);

    const second = await signUpWithGoogle({ subject, name: "Twice" });
    expect(second.statusCode).toBe(200);
    expect(second.json<{ userId: string }>().userId).toBe(firstSession.userId);

    const count = await one<{ n: string }>(
      `SELECT count(*)::text AS n FROM auth_identities WHERE subject = '${subject}'`,
    );
    expect(count.n).toBe("1");
  });
});

describe("adding a number afterwards", () => {
  test("attaches a proved number to the signed-in account", async () => {
    const subject = subjectFor("addnumber");
    const signedUp = await signUpWithGoogle({ subject, name: "Later Number" });
    const { userId, sessionToken } = signedUp.json<{ userId: string; sessionToken: string }>();
    madeUsers.push(userId);

    const instance = await app();
    const mobile = `9${String(Date.now()).slice(-9)}`;
    await reset(`otp:mobile:${mobile}`);
    await reset("otp:ip:127.0.0.1");
    await reset(`otp:user:${userId}`);

    const requested = await instance.inject({
      method: "POST",
      url: "/me/mobile/request",
      headers: bearer(sessionToken),
      payload: { mobile },
    });
    expect(requested.statusCode).toBe(200);

    const { challengeId, devCode } = requested.json<{ challengeId: string; devCode?: string }>();
    if (!devCode) throw new Error("OTP_DEV_ECHO is off, so the test cannot read the code");

    const confirmed = await instance.inject({
      method: "POST",
      url: "/me/mobile/confirm",
      headers: bearer(sessionToken),
      payload: { challengeId, code: devCode },
    });

    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json()).toMatchObject({ mobileVerified: true });

    const row = await one<{ mobile: string | null; mobile_verified_at: string | null }>(
      `SELECT mobile, mobile_verified_at FROM users WHERE id = '${userId}'::uuid`,
    );
    // Normalised to E.164 without the plus by the same rule the sign-in path
    // uses, so the two agree about what "the same number" means.
    expect(row.mobile).toContain(mobile.slice(-9));
    expect(row.mobile_verified_at).not.toBeNull();
  });

  test("refuses a number that already belongs to somebody else", async () => {
    /*
     * The check runs *before* the SMS. Leaving it to the unique index would
     * mean the person paid for the whole round trip — request, wait, type six
     * digits — to be told at the very end that it was never going to work.
     */
    const existing = await one<{ mobile: string }>(
      `SELECT mobile FROM users WHERE mobile IS NOT NULL AND deleted_at IS NULL LIMIT 1`,
    );

    const subject = subjectFor("taken");
    const signedUp = await signUpWithGoogle({ subject, name: "Wants A Taken Number" });
    const { userId, sessionToken } = signedUp.json<{ userId: string; sessionToken: string }>();
    madeUsers.push(userId);

    await reset("otp:ip:127.0.0.1");
    await reset(`otp:user:${userId}`);
    await reset(`otp:mobile:${existing.mobile}`);

    const instance = await app();
    const requested = await instance.inject({
      method: "POST",
      url: "/me/mobile/request",
      headers: bearer(sessionToken),
      payload: { mobile: existing.mobile },
    });

    expect(requested.statusCode).toBe(409);
    expect(requested.body).toMatch(/already on another account/i);
  });

  test("requires a session", async () => {
    const instance = await app();
    const response = await instance.inject({
      method: "POST",
      url: "/me/mobile/request",
      payload: { mobile: "9839099999" },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe("setting a city afterwards", () => {
  test("saves it, and can clear it again", async () => {
    const subject = subjectFor("citylater");
    const signedUp = await signUpWithGoogle({ subject, name: "City Later" });
    const { userId, sessionToken } = signedUp.json<{ userId: string; sessionToken: string }>();
    madeUsers.push(userId);

    const city = await one<{ id: string }>(
      `SELECT id FROM cities WHERE is_active = true LIMIT 1`,
    );
    const instance = await app();

    const set = await instance.inject({
      method: "PATCH",
      url: "/me/profile",
      headers: bearer(sessionToken),
      payload: { cityId: city.id },
    });
    expect(set.statusCode).toBe(200);
    expect(set.json()).toMatchObject({ cityId: city.id });

    /*
     * Clearing has to work too. Somebody who picked a city to see its prices
     * and then moved should be able to go back to seeing everything — a
     * setting that can only ever narrow is one people stop touching.
     */
    const cleared = await instance.inject({
      method: "PATCH",
      url: "/me/profile",
      headers: bearer(sessionToken),
      payload: { cityId: null },
    });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json()).toMatchObject({ cityId: null });
  });

  test("refuses a city that does not exist", async () => {
    const subject = subjectFor("badcity");
    const signedUp = await signUpWithGoogle({ subject, name: "Bad City" });
    const { userId, sessionToken } = signedUp.json<{ userId: string; sessionToken: string }>();
    madeUsers.push(userId);

    const instance = await app();
    const response = await instance.inject({
      method: "PATCH",
      url: "/me/profile",
      headers: bearer(sessionToken),
      payload: { cityId: "00000000-0000-7000-8000-000000000000" },
    });

    expect(response.statusCode).toBe(404);
  });
});
