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
} from "../modules/auth/sessions";
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
    return actor;
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
    return actor;
  });

  /* ---------------- session ---------------- */

  app.post(routes.logout.path, async (request, reply) => {
    await revokeSession(request.cookies[SESSION_COOKIE]);
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
    const session = await resolveSession(request.cookies[SESSION_COOKIE]);
    reply.header("Cache-Control", "no-store, private");
    if (!session) throw new NotAuthenticatedError();
    return session;
  });
}
