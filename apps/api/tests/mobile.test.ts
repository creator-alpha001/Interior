/**
 * What the mobile apps need from the API.
 *
 * Four things landed together and each has a failure mode that is invisible
 * until somebody is holding a phone:
 *
 * - **Bearer sessions.** The risk is not that they fail, it is that they work
 *   for `/me` and then quietly bypass the row-level-security scope hook, which
 *   reads the token from a different place. So these tests do not stop at
 *   signing in: they read a personal surface with the header and check the
 *   scope came with it.
 * - **Local storage.** Presigning is only useful if the signature actually
 *   refuses the things it claims to.
 * - **Device tokens.** The case that matters is a handset changing hands, which
 *   nobody tries by accident.
 * - **Account closure.** Irreversible, reachable from a settings screen, and
 *   required by both stores.
 */
import { Readable } from "node:stream";
import { readFile, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { unscopedDb } from "../src/db/client";
import {
  localObjectPath,
  localObjectSize,
  presignPut,
  publicUrlFor,
  verifyLocalSignature,
  writeLocalObject,
} from "../src/lib/storage";
import { reset } from "../src/lib/rate-limit";
import { app, maybe, needs, one } from "./helpers/harness";

/**
 * Signs in the way a phone does: asking for the token rather than the cookie.
 *
 * The allowance is cleared first. Not to dodge the limit — `rate-limit.test.ts`
 * proves it works — but because this file signs in a dozen times and the *IP*
 * allowance is twenty an hour and, unlike the per-mobile one, is not reset by a
 * successful sign-in. Every test in the run comes from 127.0.0.1, so without
 * this the file quietly spends the suite's allowance and whichever file runs
 * next cannot sign in at all. That is exactly how it presented: a different
 * suite failing with "OTP_DEV_ECHO is off".
 */
async function mobileSignIn(mobile: string) {
  const instance = await app();

  await reset(`otp:mobile:${mobile}`);
  await reset("otp:ip:127.0.0.1");

  const requested = await instance.inject({
    method: "POST",
    url: "/auth/otp/request",
    headers: { "x-client": "mobile" },
    payload: { mobile },
  });
  const { challengeId, devCode } = requested.json<{ challengeId: string; devCode?: string }>();
  if (!devCode) throw new Error("OTP_DEV_ECHO is off, so the test cannot read the code");

  const verified = await instance.inject({
    method: "POST",
    url: "/auth/otp/verify",
    headers: { "x-client": "mobile" },
    payload: { challengeId, code: devCode },
  });

  return verified;
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

afterAll(async () => {
  // Shared database: no spent allowances left for the next file.
  await unscopedDb.execute(sql`DELETE FROM rate_limits WHERE key LIKE 'otp:%'`);
});

describe("bearer sessions", () => {
  test("a mobile client is given the token in the body; a browser is not", async () => {
    const mobileResponse = await mobileSignIn("9839012477");
    expect(mobileResponse.statusCode).toBe(200);
    expect(mobileResponse.json()).toHaveProperty("sessionToken");

    const instance = await app();
    const requested = await instance.inject({
      method: "POST",
      url: "/auth/otp/request",
      payload: { mobile: "9839012477" },
    });
    const { challengeId, devCode } = requested.json<{ challengeId: string; devCode: string }>();
    const browserResponse = await instance.inject({
      method: "POST",
      url: "/auth/otp/verify",
      payload: { challengeId, code: devCode },
    });

    // The cookie is set either way. The token is only handed to a caller that
    // said it was a phone, so it never ends up in a browser's JavaScript.
    expect(browserResponse.statusCode).toBe(200);
    expect(browserResponse.json()).not.toHaveProperty("sessionToken");
    expect(browserResponse.headers["set-cookie"]).toBeDefined();
  });

  test("the token authenticates with no cookie at all", async () => {
    const { sessionToken } = (await mobileSignIn("9839012477")).json<{ sessionToken: string }>();
    const instance = await app();

    const me = await instance.inject({ method: "GET", url: "/me", headers: bearer(sessionToken) });

    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ actor: { role: "client" } });
  });

  /**
   * The one that would have been missed.
   *
   * `/me/requirements` runs on a reserved connection with the caller's identity
   * stamped on it, and the hook that does the stamping reads the session
   * separately from the route guard. A bearer token that satisfies the guard
   * but not the hook produces an empty list rather than an error — a customer
   * signed in, looking at none of their own requirements, with nothing in the
   * logs to say why.
   */
  test("the row-level-security scope follows the header, not just the cookie", async () => {
    const { sessionToken } = (await mobileSignIn("9839012477")).json<{ sessionToken: string }>();
    const instance = await app();

    const response = await instance.inject({
      method: "GET",
      url: "/me/requirements",
      headers: bearer(sessionToken),
    });

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json())).toBe(true);
    expect(response.json().length).toBeGreaterThan(0);
  });

  test("signing out revokes the token immediately", async () => {
    const { sessionToken } = (await mobileSignIn("9839012477")).json<{ sessionToken: string }>();
    const instance = await app();

    await instance.inject({ method: "POST", url: "/auth/logout", headers: bearer(sessionToken) });
    const after = await instance.inject({ method: "GET", url: "/me", headers: bearer(sessionToken) });

    expect(after.statusCode).toBe(401);
  });

  test("a token that is not a session is refused, not treated as anonymous access", async () => {
    const instance = await app();
    const response = await instance.inject({
      method: "GET",
      url: "/me/requirements",
      headers: bearer("not-a-real-session-token"),
    });

    expect(response.statusCode).toBe(401);
  });
});

describe("local object storage", () => {
  const key = `milestone_proof/${randomUUID()}.jpg`;

  afterAll(async () => {
    await rm(localObjectPath(key), { force: true }).catch(() => {});
  });

  test("a ticket is a signed PUT at this API, and the signature is checked", async () => {
    const ticket = await presignPut(key, "image/jpeg");
    const url = new URL(ticket.uploadUrl);
    const expires = url.searchParams.get("expires")!;
    const signature = url.searchParams.get("signature")!;

    expect(url.pathname).toBe(`/media/${key}`);
    expect(() => verifyLocalSignature(key, expires, signature)).not.toThrow();

    // A signature is for exactly one key: without this, one valid ticket would
    // authorise writing over any object in the bucket.
    expect(() => verifyLocalSignature("portfolio_item/other.jpg", expires, signature)).toThrow();
    expect(() => verifyLocalSignature(key, expires, "0".repeat(signature.length))).toThrow();
    expect(() =>
      verifyLocalSignature(key, String(Math.floor(Date.now() / 1000) - 10), signature),
    ).toThrow();
  });

  /**
   * Refused rather than sanitised.
   *
   * Stripping the `../` and continuing would turn this into "etc/passwd" —
   * safely inside the media directory, and therefore silent about having been
   * asked for something else entirely.
   */
  test("a key that tries to leave the media directory is refused", () => {
    expect(() => localObjectPath("../../../etc/passwd")).toThrow();
  });

  test("bytes are written, read back, and served from the public url", async () => {
    const body = Buffer.from("a photograph of a half-built kitchen");

    const written = await writeLocalObject(key, Readable.from(body), 10_000_000);

    expect(written).toBe(body.length);
    expect(await localObjectSize(key)).toBe(body.length);
    expect(await readFile(localObjectPath(key))).toEqual(body);
    expect(publicUrlFor(key)).toContain(`/media/${key}`);
  });

  test("an oversized body is stopped mid-stream and leaves no partial file", async () => {
    const big = `milestone_proof/${randomUUID()}.jpg`;

    await expect(writeLocalObject(big, Readable.from(Buffer.alloc(5000)), 1000)).rejects.toThrow();

    // A half-written photograph that reports success is worse than a failure.
    expect(await localObjectSize(big)).toBeNull();
  });

  test("placeholder tokens are left alone", () => {
    expect(publicUrlFor("ph:kitchen-1")).toBe("ph:kitchen-1");
  });
});

/**
 * The routes that only exist under the local driver.
 *
 * Worth testing over HTTP rather than through the library, because what is
 * being asserted is the Fastify wiring: the wildcard body parser that hands the
 * raw stream through, and the fact that these are exempt from the write limiter
 * — with R2 configured the same upload never reaches this process, and a
 * vendor's allowance must not depend on which backend ops chose.
 */
describe("the media routes", () => {
  const key = `requirement_photo/${randomUUID()}.jpg`;
  const body = Buffer.from("bytes standing in for a photograph of a room");

  afterAll(async () => {
    await rm(localObjectPath(key), { force: true }).catch(() => {});
  });

  test("an unsigned or tampered PUT is refused", async () => {
    const instance = await app();
    const url = new URL((await presignPut(key, "image/jpeg")).uploadUrl);

    const unsigned = await instance.inject({ method: "PUT", url: `/media/${key}`, payload: body });
    const tampered = await instance.inject({
      method: "PUT",
      url: `/media/${key}?expires=${url.searchParams.get("expires")}&signature=deadbeef`,
      payload: body,
    });

    expect(unsigned.statusCode).toBe(403);
    expect(tampered.statusCode).toBe(403);
  });

  test("a valid ticket writes the file, and it reads back at its public url", async () => {
    const instance = await app();
    const url = new URL((await presignPut(key, "image/jpeg")).uploadUrl);

    const put = await instance.inject({
      method: "PUT",
      url: `${url.pathname}${url.search}`,
      headers: { "content-type": "image/jpeg" },
      payload: body,
    });

    expect(put.statusCode).toBe(200);
    expect(put.json().bytes).toBe(body.length);

    const get = await instance.inject({ method: "GET", url: `/media/${key}` });

    expect(Buffer.from(get.rawPayload)).toEqual(body);
    expect(get.headers["content-type"]).toBe("image/jpeg");
    // Keys carry a uuid that is never reused, so this can be cached hard — the
    // difference between a catalogue screen costing one round trip and thirty.
    expect(String(get.headers["cache-control"])).toContain("immutable");
  });

  test("an unknown key is 404, not an empty 200", async () => {
    const instance = await app();
    const response = await instance.inject({
      method: "GET",
      url: "/media/requirement_photo/does-not-exist.jpg",
    });

    expect(response.statusCode).toBe(404);
  });
});

describe("device tokens", () => {
  const token = `test-device-${randomUUID()}`;

  afterAll(async () => {
    await unscopedDb.execute(sql`DELETE FROM device_tokens WHERE token LIKE 'test-device-%'`);
  });

  test("registering binds the handset to the signed-in user", async () => {
    const { sessionToken } = (await mobileSignIn("9839012477")).json<{ sessionToken: string }>();
    const instance = await app();

    const response = await instance.inject({
      method: "POST",
      url: "/me/devices",
      headers: bearer(sessionToken),
      payload: { token, platform: "android", appVersion: "1.0.0+1" },
    });

    expect(response.statusCode).toBe(200);

    const row = await one<{ user_id: string; session_id: string | null }>(
      `SELECT user_id, session_id FROM device_tokens WHERE token = '${token}'`,
    );
    // Bound to the session, which is what makes sign-out able to remove this
    // handset rather than every device the person owns.
    expect(row.session_id).not.toBeNull();
  });

  /**
   * A phone changing hands.
   *
   * The push provider reissues a token per *installation*, not per person, so
   * when somebody else signs in on the same handset the same token arrives
   * under a new user. If the row were not re-pointed, the previous owner would
   * keep receiving notifications about jobs that are no longer theirs.
   *
   * This is also the case that fails under row-level security if the write is
   * made on the caller's scoped connection: the existing row is invisible, but
   * the unique index still refuses the insert.
   */
  test("a handset that changes hands is re-pointed, not duplicated", async () => {
    const instance = await app();

    const first = (await mobileSignIn("9839012477")).json<{ sessionToken: string }>();
    await instance.inject({
      method: "POST",
      url: "/me/devices",
      headers: bearer(first.sessionToken),
      payload: { token, platform: "android" },
    });

    const second = (await mobileSignIn("9455670092")).json<{
      sessionToken: string;
      userId: string;
    }>();
    const response = await instance.inject({
      method: "POST",
      url: "/me/devices",
      headers: bearer(second.sessionToken),
      payload: { token, platform: "android" },
    });

    expect(response.statusCode).toBe(200);

    const rows = await unscopedDb.execute(
      sql`SELECT user_id FROM device_tokens WHERE token = ${token}`,
    );
    expect(rows.length).toBe(1);
    expect((rows[0] as { user_id: string }).user_id).toBe(second.userId);
  });

  test("signing out takes this handset's token with it", async () => {
    const instance = await app();
    const { sessionToken } = (await mobileSignIn("9839012477")).json<{ sessionToken: string }>();

    await instance.inject({
      method: "POST",
      url: "/me/devices",
      headers: bearer(sessionToken),
      payload: { token, platform: "ios" },
    });
    await instance.inject({ method: "POST", url: "/auth/logout", headers: bearer(sessionToken) });

    const row = await maybe(`SELECT id FROM device_tokens WHERE token = '${token}'`);
    expect(row).toBeNull();
  });
});

describe("the version gate", () => {
  test("says the minimum build without a session", async () => {
    const instance = await app();
    const response = await instance.inject({ method: "GET", url: "/app/version" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty("minBuild");
    expect(response.json()).toHaveProperty("message");
  });
});

describe("closing an account", () => {
  /**
   * A throwaway customer, created the way a real one is.
   *
   * Signing in with an unrecognised number *is* the signup path — so the
   * fixture goes through `actorForMobile` rather than hand-building rows, which
   * also means it picks up the referral code and city fallback that a
   * hand-written INSERT would have to reproduce and would get wrong.
   *
   * Not a seeded identity: this is irreversible, and the seed is the demo.
   */
  let doomed: { userId: string; mobile: string; sessionToken: string };

  beforeAll(async () => {
    const mobile = `9${Math.floor(100_000_000 + Math.random() * 899_999_999)}`;
    const actor = (await mobileSignIn(mobile)).json<{ userId: string; sessionToken: string }>();
    doomed = { userId: actor.userId, mobile, sessionToken: actor.sessionToken };
  });

  afterAll(async () => {
    // Ordered by dependency: the client row references the user.
    await unscopedDb.execute(sql`DELETE FROM sessions WHERE user_id = ${doomed.userId}`);
    await unscopedDb.execute(sql`DELETE FROM clients WHERE user_id = ${doomed.userId}`);
    await unscopedDb.execute(sql`DELETE FROM users WHERE id = ${doomed.userId}`);
  });

  test("clears the personal detail, revokes every session, and frees the number", async () => {
    const instance = await app();

    const response = await instance.inject({
      method: "POST",
      url: "/me/account/delete",
      headers: bearer(doomed.sessionToken),
      payload: { confirm: "DELETE" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().retained.length).toBeGreaterThan(0);

    const row = await one<{ name: string; mobile: string; deleted_at: string | null }>(
      `SELECT name, mobile, deleted_at FROM users WHERE id = '${doomed.userId}'`,
    );
    // The number is replaced, not merely soft-deleted around: leaving it on the
    // row would mean it is still in the table after somebody asked for it to go.
    expect(row.mobile).not.toBe(doomed.mobile);
    expect(row.deleted_at).not.toBeNull();

    const after = await instance.inject({
      method: "GET",
      url: "/me",
      headers: bearer(doomed.sessionToken),
    });
    expect(after.statusCode).toBe(401);

    // And the number is usable again — every unique on `users` is partial on
    // `deleted_at IS NULL`, so a returning customer signs up as somebody new.
    const reused = await maybe(
      `SELECT id FROM users WHERE mobile = '${doomed.mobile}' AND deleted_at IS NULL`,
    );
    expect(reused).toBeNull();
  });

  test("a staff account cannot close itself from the app", async () => {
    const instance = await app();
    const login = await instance.inject({
      method: "POST",
      url: "/auth/staff/login",
      headers: { "x-client": "mobile" },
      payload: {
        email: "kavita@example.com",
        password: process.env.SEED_STAFF_PASSWORD ?? "aangan-dev-password",
      },
    });
    const { sessionToken } = login.json<{ sessionToken: string }>();

    const response = await instance.inject({
      method: "POST",
      url: "/me/account/delete",
      headers: bearer(sessionToken),
      payload: { confirm: "DELETE" },
    });

    // Staff requests do not run under a row-level-security scope, so this would
    // be writing on the unrestricted pool — quite apart from the queue of leads
    // somebody else would have to pick up.
    expect(response.statusCode).toBe(403);
  });

  test("a professional with live work is refused rather than detached", async (context) => {
    const live = await maybe<{ mobile: string }>(`
      SELECT u.mobile
      FROM users u
      JOIN professionals p ON p.user_id = u.id
      JOIN projects pr ON pr.professional_id = p.id
      WHERE pr.status IN ('not_started', 'ongoing', 'on_hold')
        AND pr.deleted_at IS NULL AND u.deleted_at IS NULL
      LIMIT 1
    `);

    // Reported as skipped rather than passing silently: a test that cannot find
    // its fixture has checked nothing.
    needs(context, live, "a vendor with a live project");

    const instance = await app();
    const { sessionToken } = (await mobileSignIn(live.mobile)).json<{ sessionToken: string }>();

    const response = await instance.inject({
      method: "POST",
      url: "/me/account/delete",
      headers: bearer(sessionToken),
      payload: { confirm: "DELETE" },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().message).toContain("still running");
  });
});
