/**
 * Sign in, sign out, and "who am I".
 *
 * Two flows that never mix: customers and vendors use a mobile number and an
 * SMS code; staff use a password and a TOTP code. Ops accounts can see every
 * customer's phone number and every vendor's margin, so they should not be
 * reachable by whoever ends up with a recycled mobile number.
 */
import type { FastifyInstance } from "fastify";
import { routes } from "@repo/contract";
import { config } from "../lib/config";
import { NotAuthenticatedError } from "../lib/errors";
import { LIMITS, consume, reset } from "../lib/rate-limit";
import { createChallenge, verifyChallenge } from "../modules/auth/otp";
import { actorForMobile, authenticateStaff } from "../modules/auth/repository";
import {
  SESSION_COOKIE,
  createSession,
  resolveSession,
  revokeSession,
  sessionCookieOptions,
  sessionTokenFrom,
  wantsTokenInBody,
} from "../modules/auth/sessions";
import {
  forgetDevice,
  forgetDevicesForSession,
  registerDevice,
  sessionIdFor,
} from "../modules/auth/devices";
import { closeAccount } from "../modules/auth/closure";
import { requireUser } from "../lib/guard";
import { sendOtp } from "../lib/sms";

export async function registerAuthRoutes(app: FastifyInstance) {
  /* ---------------- mobile OTP ---------------- */

  app.post(routes.requestOtp.path, async (request, reply) => {
    const { mobile } = routes.requestOtp.body!.parse(request.body);

    // Per mobile and per IP. The first stops one number being flooded; the
    // second stops one machine walking a range of numbers.
    await consume(`otp:mobile:${mobile}`, LIMITS.otpRequestPerMobile);
    await consume(`otp:ip:${request.ip}`, LIMITS.otpRequestPerIp);

    const { challenge, code } = await createChallenge(mobile, request.ip);
    const delivery = await sendOtp(mobile, code);

    reply.header("Cache-Control", "no-store");
    return {
      challengeId: challenge.id,
      expiresInSeconds: Math.round((challenge.expiresAt.getTime() - Date.now()) / 1000),
      // Present only when OTP_DEV_ECHO is on, which config.ts refuses in
      // production.
      ...(delivery.devCode ? { devCode: delivery.devCode } : {}),
    };
  });

  app.post(routes.verifyOtp.path, async (request, reply) => {
    const { challengeId, code, name, cityId } = routes.verifyOtp.body!.parse(request.body);

    await consume(`otp:verify:${request.ip}`, LIMITS.otpVerifyPerIp);

    const { mobile } = await verifyChallenge(challengeId, code);
    const actor = await actorForMobile(mobile, { name, cityId });

    const session = await createSession(actor.userId, {
      userAgent: request.headers["user-agent"],
      ip: request.ip,
    });

    // A successful sign-in clears the counter, so somebody who mistyped twice
    // is not still paying for it an hour later.
    await reset(`otp:mobile:${mobile}`);

    reply.setCookie(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
    reply.header("Cache-Control", "no-store");

    // The mobile apps cannot use the cookie, so they ask for the token and send
    // it back as `Authorization: Bearer`. Same session row, same revocation.
    return wantsTokenInBody(request)
      ? { ...actor, sessionToken: session.token, expiresAt: session.expiresAt.toISOString() }
      : actor;
  });

  /* ---------------- staff ---------------- */

  app.post(routes.staffLogin.path, async (request, reply) => {
    const { email, password, totp } = routes.staffLogin.body!.parse(request.body);

    await consume(`staff:email:${email}`, LIMITS.staffLoginPerEmail);
    await consume(`staff:ip:${request.ip}`, LIMITS.staffLoginPerIp);

    const actor = await authenticateStaff(email, password, totp);

    const session = await createSession(actor.userId, {
      userAgent: request.headers["user-agent"],
      ip: request.ip,
    });

    await reset(`staff:email:${email}`);

    reply.setCookie(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
    reply.header("Cache-Control", "no-store");
    return wantsTokenInBody(request)
      ? { ...actor, sessionToken: session.token, expiresAt: session.expiresAt.toISOString() }
      : actor;
  });

  /* ---------------- session ---------------- */

  app.post(routes.logout.path, async (request, reply) => {
    const token = sessionTokenFrom(request);

    // Before the session goes, so the lookup still resolves. A push token left
    // behind after sign-out sends the next person to hold this handset somebody
    // else's leads.
    await forgetDevicesForSession(token);
    await revokeSession(token);

    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    reply.header("Cache-Control", "no-store");
    return { ok: true };
  });

  /**
   * The endpoint each frontend's session resolver calls.
   *
   * Never cached: a shared cache holding one person's identity and handing it
   * to the next request is the worst bug this API could have.
   */
  app.get(routes.me.path, async (request, reply) => {
    const session = await resolveSession(sessionTokenFrom(request));
    reply.header("Cache-Control", "no-store, private");
    if (!session) throw new NotAuthenticatedError();
    return session;
  });

  /* ---------------- the mobile apps ---------------- */

  /**
   * Registers this handset for push.
   *
   * Bound to the session as well as the user, so signing out takes exactly this
   * device with it. Re-registering is normal — the app calls this on every
   * launch, because the provider reissues tokens on its own schedule.
   */
  app.post(routes.registerDevice.path, async (request, reply) => {
    const userId = await requireUser(request);
    const input = routes.registerDevice.body!.parse(request.body);

    await registerDevice(userId, await sessionIdFor(sessionTokenFrom(request)), input);

    reply.header("Cache-Control", "no-store");
    return { ok: true };
  });

  app.delete(routes.forgetDevice.path, async (request, reply) => {
    const userId = await requireUser(request);
    const { token } = routes.forgetDevice.params!.parse(request.params);

    await forgetDevice(userId, token);

    reply.header("Cache-Control", "no-store");
    return { ok: true };
  });

  /**
   * Closes the account.
   *
   * A POST rather than a DELETE on `/me`: this is not idempotent in any useful
   * sense, it takes a body, and the confirmation word in that body is what
   * stops a mis-tap on a settings screen doing it.
   */
  app.post(routes.deleteAccount.path, async (request, reply) => {
    const userId = await requireUser(request);
    const { reason } = routes.deleteAccount.body!.parse(request.body);

    const result = await closeAccount({ userId, reason });

    // The session it was closed from is already revoked; clearing the cookie
    // stops the browser sending a dead token on the way out.
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    reply.header("Cache-Control", "no-store");
    return result;
  });

  /**
   * What a client should know before it does anything else.
   *
   * Public and cheap. Once a broken build is on somebody's phone, raising
   * MOBILE_MIN_BUILD is the only lever there is — there is no other way to stop
   * a version that corrupts a form or loops on a request.
   */
  app.get(routes.appVersion.path, async (_request, reply) => {
    reply.header("Cache-Control", "public, max-age=300");
    return {
      minBuild: config.MOBILE_MIN_BUILD,
      message: config.MOBILE_UPGRADE_MESSAGE,
    };
  });
}
