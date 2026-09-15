/**
 * The public authentication contract.
 *
 * Google proves the provider identity, WhatsApp proves the mobile number, and
 * only then is the identity linked. The first successful OTP asks for a
 * password; later visits use that password, with the same OTP available for a
 * forgotten-password reset.
 */
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";
import { unscopedDb } from "../src/db/client";
import { issueLinkToken } from "../src/modules/auth/link-token";
import { reset } from "../src/lib/rate-limit";
import { app, maybe, one } from "./helpers/harness";

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
const subjectFor = (label: string) => `test-subject-${label}-${Date.now()}`;
let mobileCounter = 0;
const madeUsers: string[] = [];

/** A fresh valid Indian number for each test, without using a real handset. */
function uniqueMobile(): string {
  mobileCounter += 1;
  return `9${`${Date.now()}${mobileCounter}`.slice(-9)}`;
}

async function requestCode(instance: Awaited<ReturnType<typeof app>>, mobile: string) {
  await reset(`otp:mobile:91${mobile}`);
  await reset("otp:ip:127.0.0.1");
  await reset("otp:verify:127.0.0.1");

  const response = await instance.inject({
    method: "POST",
    url: "/auth/otp/request",
    headers: { "x-client": "mobile" },
    payload: { mobile },
  });
  expect(response.statusCode).toBe(200);
  const body = response.json<{ challengeId: string; devCode?: string }>();
  if (!body.devCode) throw new Error("OTP_DEV_ECHO is off, so the test cannot read the code");
  return body;
}

/** Completes the current Google -> WhatsApp flow as a mobile client. */
async function signUpWithGoogle(options: {
  subject: string;
  name?: string;
  cityId?: string;
  mobile?: string;
}) {
  const instance = await app();
  const mobile = options.mobile ?? uniqueMobile();
  const challenge = await requestCode(instance, mobile);

  const response = await instance.inject({
    method: "POST",
    url: "/auth/otp/verify",
    headers: { "x-client": "mobile" },
    payload: {
      challengeId: challenge.challengeId,
      code: challenge.devCode,
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

  expect(response.statusCode).toBe(200);
  const body = response.json<{
    userId: string;
    role: string;
    sessionToken: string;
    passwordSetupRequired: boolean;
  }>();
  madeUsers.push(body.userId);
  return { instance, mobile, body };
}

afterAll(async () => {
  if (madeUsers.length > 0) {
    const ids = madeUsers.map((id) => `'${id}'::uuid`).join(", ");
    // Children first: these are the rows the auth tests create explicitly.
    await unscopedDb.execute(sql.raw(`DELETE FROM auth_identities WHERE user_id IN (${ids})`));
    await unscopedDb.execute(sql.raw(`DELETE FROM sessions WHERE user_id IN (${ids})`));
    await unscopedDb.execute(
      sql.raw(`DELETE FROM user_password_credentials WHERE user_id IN (${ids})`),
    );
    await unscopedDb.execute(sql.raw(`DELETE FROM clients WHERE user_id IN (${ids})`));
    await unscopedDb.execute(sql.raw(`DELETE FROM users WHERE id IN (${ids})`));
  }
  await unscopedDb.execute(
    sql`DELETE FROM rate_limits WHERE key LIKE 'otp:%' OR key LIKE 'google:%' OR key LIKE 'password:%'`,
  );
});

describe("Google and mobile authentication", () => {
  test("does not allow the retired Google-only completion route", async () => {
    const instance = await app();
    const response = await instance.inject({
      method: "POST",
      url: "/auth/google/complete",
      headers: { "x-client": "mobile" },
      payload: {
        linkToken: issueLinkToken({
          provider: "google",
          subject: subjectFor("retired"),
          email: "retired@example.com",
        }),
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.body).toMatch(/WhatsApp/i);
  });

  test("requires WhatsApp verification and then asks for the first password", async () => {
    const subject = subjectFor("first-login");
    const { instance, mobile, body } = await signUpWithGoogle({
      subject,
      name: "First Login",
    });

    expect(body.role).toBe("client");
    expect(body.passwordSetupRequired).toBe(true);

    const me = await instance.inject({
      method: "GET",
      url: "/me",
      headers: bearer(body.sessionToken),
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({
      mobile: `91${mobile}`,
      mobileVerified: true,
      passwordSet: false,
      cityId: null,
    });
  });

  test("retains an explicitly chosen city and supports password sign-in", async () => {
    const city = await one<{ id: string }>(
      `SELECT id FROM cities WHERE is_active = true LIMIT 1`,
    );
    const { instance, mobile, body } = await signUpWithGoogle({
      subject: subjectFor("password"),
      name: "Password User",
      cityId: city.id,
    });

    expect(body.passwordSetupRequired).toBe(true);
    const set = await instance.inject({
      method: "POST",
      url: "/me/password",
      headers: bearer(body.sessionToken),
      payload: { password: "correct horse battery staple" },
    });
    expect(set.statusCode).toBe(200);

    const login = await instance.inject({
      method: "POST",
      url: "/auth/password/login",
      headers: { "x-client": "mobile" },
      payload: { mobile, password: "correct horse battery staple" },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json()).toMatchObject({ passwordSetupRequired: false });
    expect(login.json().sessionToken).toBeDefined();

    const row = await one<{ city_id: string | null }>(
      `SELECT city_id FROM users WHERE id = '${body.userId}'::uuid`,
    );
    expect(row.city_id).toBe(city.id);
  });

  test("forgot password uses a fresh WhatsApp code and revokes the old session", async () => {
    const { instance, mobile, body } = await signUpWithGoogle({
      subject: subjectFor("recovery"),
      name: "Recovery User",
    });

    const set = await instance.inject({
      method: "POST",
      url: "/me/password",
      headers: bearer(body.sessionToken),
      payload: { password: "old password that is long" },
    });
    expect(set.statusCode).toBe(200);

    const challenge = await requestCode(instance, mobile);
    const resetResponse = await instance.inject({
      method: "POST",
      url: "/auth/password/reset",
      headers: { "x-client": "mobile" },
      payload: {
        challengeId: challenge.challengeId,
        code: challenge.devCode,
        password: "new password that is long",
      },
    });
    expect(resetResponse.statusCode).toBe(200);
    expect(resetResponse.json()).toMatchObject({ passwordSetupRequired: false });

    const old = await instance.inject({
      method: "GET",
      url: "/me",
      headers: bearer(body.sessionToken),
    });
    expect(old.statusCode).toBe(401);
  });
});

describe("verified mobile account setup", () => {
  test("replaces the primary number only after the new number is proved", async () => {
    const { instance, body } = await signUpWithGoogle({
      subject: subjectFor("add-number"),
      name: "Later Number",
    });
    const mobile = uniqueMobile();
    const challenge = await requestCode(instance, mobile);

    const confirmed = await instance.inject({
      method: "POST",
      url: "/me/mobile/confirm",
      headers: bearer(body.sessionToken),
      payload: { challengeId: challenge.challengeId, code: challenge.devCode },
    });

    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json()).toMatchObject({
      mobile: `91${mobile}`,
      mobileVerified: true,
    });
  });

  test("refuses a number that belongs to somebody else before sending a code", async () => {
    const existing = await maybe<{ mobile: string }>(
      `SELECT mobile FROM users WHERE mobile IS NOT NULL AND deleted_at IS NULL LIMIT 1`,
    );
    if (!existing) throw new Error("Seed database has no mobile fixture");

    const { instance, body } = await signUpWithGoogle({
      subject: subjectFor("taken"),
      name: "Taken Number",
    });
    await reset("otp:ip:127.0.0.1");
    await reset(`otp:user:${body.userId}`);
    await reset(`otp:mobile:${existing.mobile}`);

    const requested = await instance.inject({
      method: "POST",
      url: "/me/mobile/request",
      headers: bearer(body.sessionToken),
      payload: { mobile: existing.mobile },
    });

    expect(requested.statusCode).toBe(409);
    expect(requested.body).toMatch(/already on another account/i);
  });

  test("requires a session to attach a number", async () => {
    const instance = await app();
    const response = await instance.inject({
      method: "POST",
      url: "/me/mobile/request",
      payload: { mobile: "9839099999" },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe("profile completion after sign-in", () => {
  test("saves a city and can clear it again", async () => {
    const city = await one<{ id: string }>(
      `SELECT id FROM cities WHERE is_active = true LIMIT 1`,
    );
    const { instance, body } = await signUpWithGoogle({
      subject: subjectFor("city-later"),
      name: "City Later",
    });

    const set = await instance.inject({
      method: "PATCH",
      url: "/me/profile",
      headers: bearer(body.sessionToken),
      payload: { cityId: city.id },
    });
    expect(set.statusCode).toBe(200);
    expect(set.json()).toMatchObject({ cityId: city.id });

    const cleared = await instance.inject({
      method: "PATCH",
      url: "/me/profile",
      headers: bearer(body.sessionToken),
      payload: { cityId: null },
    });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json()).toMatchObject({ cityId: null });
  });

  test("refuses a city that does not exist", async () => {
    const { instance, body } = await signUpWithGoogle({
      subject: subjectFor("bad-city"),
      name: "Bad City",
    });
    const response = await instance.inject({
      method: "PATCH",
      url: "/me/profile",
      headers: bearer(body.sessionToken),
      payload: { cityId: "00000000-0000-7000-8000-000000000000" },
    });
    expect(response.statusCode).toBe(404);
  });
});
