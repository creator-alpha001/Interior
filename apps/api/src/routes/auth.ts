/**
 * Sign in, sign out, and "who am I".
 *
 * Two flows that never mix: customers and vendors use a mobile number and a
 * password after the first WhatsApp (or SMS fallback) verification; staff use
 * a password and a TOTP code. Ops accounts can see every customer's phone
 * number and every vendor's margin, so they should not be
 * reachable by whoever ends up with a recycled mobile number.
 */
import type { FastifyInstance } from "fastify";
import type { Actor } from "@repo/types";
import { routes } from "@repo/contract";
import { config } from "../lib/config";
import { NotAuthenticatedError } from "../lib/errors";
import { LIMITS, consume, reset } from "../lib/rate-limit";
import { createChallenge, verifyChallenge } from "../modules/auth/otp";
import {
  actorForMobile,
  authenticateStaff,
  findActorByIdentity,
  findActorByMobile,
  identityNeedsMobile,
  linkIdentity,
  markMobileVerified,
} from "../modules/auth/repository";
import {
  authenticateUserPassword,
  hasUserPassword,
  setUserPassword,
} from "../modules/auth/password";
import {
  assertMobileAvailable,
  attachVerifiedMobile,
  updateProfile,
} from "../modules/auth/profile";
import { issueLinkToken, readLinkToken } from "../modules/auth/link-token";
import { verifyGoogleIdToken } from "../lib/google";
import {
  SESSION_COOKIE,
  createSession,
  resolveSession,
  revokeSession,
  revokeAllSessions,
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
import { deliverOtp } from "../lib/otp-delivery";

async function sessionBody(
  actor: Actor,
  session: { token: string; expiresAt: Date },
  includeToken: boolean,
) {
  const passwordSetupRequired =
    actor.role === "client" || actor.role === "professional"
      ? !(await hasUserPassword(actor.userId))
      : false;

  return {
    ...actor,
    passwordSetupRequired,
    ...(includeToken
      ? { sessionToken: session.token, expiresAt: session.expiresAt.toISOString() }
      : {}),
  };
}

export async function registerAuthRoutes(app: FastifyInstance) {
  /* ---------------- mobile OTP ---------------- */

  app.post(routes.requestOtp.path, async (request, reply) => {
    const { mobile, channel } = routes.requestOtp.body!.parse(request.body);

    // Per mobile and per IP, whichever channel. The first stops one number
    // being flooded; the second stops one machine walking a range of numbers.
    await consume(`otp:mobile:${mobile}`, LIMITS.otpRequestPerMobile);
    await consume(`otp:ip:${request.ip}`, LIMITS.otpRequestPerIp);

    const { challenge, code } = await createChallenge(mobile, request.ip);
    const delivery = await deliverOtp(mobile, code, channel);

    reply.header("Cache-Control", "no-store");
    return {
      challengeId: challenge.id,
      expiresInSeconds: Math.round((challenge.expiresAt.getTime() - Date.now()) / 1000),
      // Where it actually went, so the screen says where to look.
      channel: delivery.channel,
      // Present only when OTP_DEV_ECHO is on, which config.ts refuses in
      // production.
      ...(delivery.devCode ? { devCode: delivery.devCode } : {}),
    };
  });

  /**
   * Google sign-in.
   *
   * A linked identity with a verified mobile is a complete sign-in. A new or
   * legacy Google identity without a verified mobile gets a short-lived link
   * token and must finish through `/auth/otp/verify`, where WhatsApp proves the
   * number before the identity is remembered.
   *
   * What it deliberately does not do is match on email. A Google address can be
   * changed by its owner and can be reissued to a different person years later,
   * and `users.email` here may have been typed in by ops rather than proved by
   * anyone. Signing somebody in because two strings matched is the ordinary way
   * accounts are taken over.
   */
  app.post(routes.googleSignIn.path, async (request, reply) => {
    const { idToken } = routes.googleSignIn.body!.parse(request.body);

    if (config.googleClientIds.length === 0) {
      throw new NotAuthenticatedError("Google sign-in is not available");
    }

    // Rate limited by address like the OTP routes: verifying a signature is
    // cheap but not free, and this endpoint is unauthenticated by definition.
    await consume(`google:ip:${request.ip}`, LIMITS.otpVerifyPerIp);

    const identity = await verifyGoogleIdToken(idToken, config.googleClientIds);
    const actor = await findActorByIdentity("google", identity.subject);

    if (!actor || (await identityNeedsMobile("google", identity.subject))) {
      reply.header("Cache-Control", "no-store");
      return {
        status: actor ? ("mobile_required" as const) : ("profile_required" as const),
        linkToken: issueLinkToken({
          provider: "google",
          subject: identity.subject,
          email: identity.email,
          name: identity.name,
          ...(actor ? { existingUserId: actor.userId } : {}),
        }),
        email: identity.email,
        name: identity.name,
      };
    }

    const session = await createSession(actor.userId, {
      userAgent: request.headers["user-agent"],
      ip: request.ip,
    });

    reply.setCookie(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
    reply.header("Cache-Control", "no-store");

    return {
      status: "signed_in" as const,
      session: await sessionBody(actor, session, wantsTokenInBody(request)),
    };
  });

  /**
   * Compatibility endpoint retained for older clients. It cannot create a
   * Google-only account; current clients finish with a WhatsApp OTP instead.
   */
  app.post(routes.completeGoogleSignUp.path, async () => {
    // Kept as a compatibility route for older clients, but never allow it to
    // create a Google-only account. The current flow must prove a mobile number
    // through `/auth/otp/verify` with the pending link token.
    throw new NotAuthenticatedError(
      "Verify a mobile number on WhatsApp before completing Google sign-in",
    );
  });

  app.post(routes.verifyOtp.path, async (request, reply) => {
    const { challengeId, code, name, cityId, linkToken } = routes.verifyOtp.body!.parse(
      request.body,
    );

    await consume(`otp:verify:${request.ip}`, LIMITS.otpVerifyPerIp);

    const { mobile } = await verifyChallenge(challengeId, code);

    /**
     * A Google sign-in finishing its one-off mobile check.
     *
     * Read before the account is touched so a forged or expired token fails
     * here rather than after a new user has been created. The name from Google
     * is only a fallback: something typed into the form is a better answer than
     * whatever the Google profile says.
     */
    const pending = linkToken ? readLinkToken(linkToken) : null;

    let actor: Actor;
    if (pending?.existingUserId) {
      const mobileActor = await findActorByMobile(mobile);

      if (mobileActor && mobileActor.userId !== pending.existingUserId) {
        throw new NotAuthenticatedError("Use the mobile number already verified on this account");
      }

      if (mobileActor) {
        // This also upgrades a legacy unverified mobile timestamp.
        actor = await actorForMobile(mobile, { name: name ?? pending.name, cityId });
      } else {
        // The Google account predates the mobile requirement and has no number
        // to match. Attach the newly proved number to that exact account rather
        // than creating a throwaway client that could never own the identity.
        const linkedActor = await findActorByIdentity(pending.provider, pending.subject);
        if (!linkedActor || linkedActor.userId !== pending.existingUserId) {
          throw new NotAuthenticatedError("That Google sign-in is no longer available");
        }
        await attachVerifiedMobile(linkedActor.userId, mobile);
        actor = linkedActor;
      }
    } else {
      actor = await actorForMobile(mobile, { name: name ?? pending?.name, cityId });
    }

    if (pending) {
      await linkIdentity(actor.userId, {
        provider: pending.provider,
        subject: pending.subject,
        email: pending.email,
      });

      // A second tab may finish the same Google flow at the same time. The
      // unique constraint keeps the identity from moving, and this read makes
      // sure the session is not issued to the losing account if that happened.
      const linked = await findActorByIdentity(pending.provider, pending.subject);
      if (!linked || linked.userId !== actor.userId) {
        throw new NotAuthenticatedError("That Google sign-in was completed elsewhere");
      }
    }

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
    return sessionBody(actor, session, wantsTokenInBody(request));
  });

  /* ---------------- customer and professional passwords ---------------- */

  app.post(routes.passwordLogin.path, async (request, reply) => {
    const { mobile, password } = routes.passwordLogin.body!.parse(request.body);

    await consume(`password:mobile:${mobile}`, LIMITS.staffLoginPerEmail);
    await consume(`password:ip:${request.ip}`, LIMITS.staffLoginPerIp);

    const actor = await authenticateUserPassword(mobile, password);
    const session = await createSession(actor.userId, {
      userAgent: request.headers["user-agent"],
      ip: request.ip,
    });

    await reset(`password:mobile:${mobile}`);
    reply.setCookie(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
    reply.header("Cache-Control", "no-store");
    return sessionBody(actor, session, wantsTokenInBody(request));
  });

  app.post(routes.resetPassword.path, async (request, reply) => {
    const { challengeId, code, password } = routes.resetPassword.body!.parse(request.body);

    await consume(`otp:verify:${request.ip}`, LIMITS.otpVerifyPerIp);
    const { mobile } = await verifyChallenge(challengeId, code);
    const actor = await findActorByMobile(mobile);
    if (!actor) {
      throw new NotAuthenticatedError("There is no account for that mobile number");
    }
    await markMobileVerified(actor.userId, mobile);

    // A recovered password is a new credential. Revoke sessions on other
    // devices in case the reset was prompted by a lost or shared device, then
    // issue one fresh session to the person who proved the number.
    await setUserPassword(actor.userId, password);
    await revokeAllSessions(actor.userId);
    const session = await createSession(actor.userId, {
      userAgent: request.headers["user-agent"],
      ip: request.ip,
    });

    await reset(`otp:mobile:${mobile}`);
    reply.setCookie(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
    reply.header("Cache-Control", "no-store");
    return sessionBody(actor, session, wantsTokenInBody(request));
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
    return sessionBody(actor, session, wantsTokenInBody(request));
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

  /* ---------------- filling in what signup did not ask ---------------- */

  /**
   * Setting the name and city on an account that already exists.
   *
   * The counterpart to letting somebody skip the city. Without a route that can
   * answer the question later, the skip button would be a one-way door and the
   * prompt offering to change it would have nothing to call.
   */
  app.patch(routes.updateProfile.path, async (request, reply) => {
    const userId = await requireUser(request);
    const input = routes.updateProfile.body!.parse(request.body);

    await updateProfile(userId, input);

    const session = await resolveSession(sessionTokenFrom(request));
    if (!session) throw new NotAuthenticatedError();

    reply.header("Cache-Control", "no-store, private");
    return session;
  });

  app.post(routes.setPassword.path, async (request, reply) => {
    const session = await resolveSession(sessionTokenFrom(request));
    if (!session) throw new NotAuthenticatedError();
    if (session.actor.role === "admin" || session.actor.role === "sales_agent") {
      throw new NotAuthenticatedError("Staff passwords are managed from the ops panel");
    }

    const { password } = routes.setPassword.body!.parse(request.body);
    await setUserPassword(session.actor.userId, password);

    reply.header("Cache-Control", "no-store");
    return { ok: true };
  });

  /**
   * Sending a code to a number the signed-in person wants to add.
   *
   * Rate limited exactly like the sign-in equivalent, and additionally per
   * account: a session is not a reason to be able to send unlimited SMS, and
   * the per-user bucket is the one that catches a script running behind a
   * legitimate login rather than a range of anonymous addresses.
   */
  app.post(routes.requestMobileVerification.path, async (request, reply) => {
    const userId = await requireUser(request);
    const { mobile, channel } = routes.requestMobileVerification.body!.parse(request.body);

    await consume(`otp:mobile:${mobile}`, LIMITS.otpRequestPerMobile);
    await consume(`otp:ip:${request.ip}`, LIMITS.otpRequestPerIp);
    await consume(`otp:user:${userId}`, LIMITS.otpRequestPerMobile);

    // Before the code is sent rather than after it comes back. Failing at the
    // end would mean paying for the message to be told the number was never
    // available in the first place.
    await assertMobileAvailable(userId, mobile);

    const { challenge, code } = await createChallenge(mobile, request.ip);
    const delivery = await deliverOtp(mobile, code, channel);

    reply.header("Cache-Control", "no-store");
    return {
      challengeId: challenge.id,
      expiresInSeconds: Math.round((challenge.expiresAt.getTime() - Date.now()) / 1000),
      channel: delivery.channel,
      ...(delivery.devCode ? { devCode: delivery.devCode } : {}),
    };
  });

  /**
   * Proving that number and attaching it.
   *
   * Note what this cannot do: it never creates an account and never moves the
   * session. `verifyChallenge` says which number was proved, and the session
   * says whose account receives it — so completing a code for a number that
   * belongs to somebody else attaches nothing and signs in as nobody. That
   * separation is the reason this is not just `/auth/otp/verify` with a session.
   */
  app.post(routes.confirmMobileVerification.path, async (request, reply) => {
    const userId = await requireUser(request);
    const { challengeId, code } = routes.confirmMobileVerification.body!.parse(request.body);

    await consume(`otp:verify:${request.ip}`, LIMITS.otpVerifyPerIp);

    const { mobile } = await verifyChallenge(challengeId, code);
    await attachVerifiedMobile(userId, mobile);
    await reset(`otp:mobile:${mobile}`);

    const session = await resolveSession(sessionTokenFrom(request));
    if (!session) throw new NotAuthenticatedError();

    reply.header("Cache-Control", "no-store, private");
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
