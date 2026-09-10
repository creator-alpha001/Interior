/**
 * Sign-in.
 *
 * Customers and vendors use a mobile number and an SMS code; staff use a
 * password and a TOTP code. They are separate flows on purpose — an ops account
 * can see every customer's phone number and every vendor's margin, and should
 * not be reachable by whoever ends up with a recycled mobile number.
 */
import { z } from "zod";
import { mobileSchema } from "./common";
import { sessionUserSchema } from "@repo/types/schema";
import {
  accountClosureSchema,
  appVersionSchema,
  authSessionSchema,
  okSchema,
  otpChallengeSchema,
} from "./responses";
import { route } from "./http";

export const otpRequestSchema = z.object({
  mobile: mobileSchema,
});

export const otpVerifySchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, "The code is six digits"),
  /** Set on first sign-in, when there is no account yet. */
  name: z.string().trim().min(2).max(80).optional(),
  cityId: z.string().uuid().optional(),
  /**
   * Returned by `/auth/google` when the Google account is not linked yet.
   *
   * Present only on the one OTP that finishes a Google sign-in. Verifying the
   * code proves the number; this says which Google account to attach to it.
   */
  linkToken: z.string().max(2048).optional(),
});

/**
 * An ID token from Google, obtained by the browser or the app.
 *
 * The token is the whole request: it is signed by Google, names the client id
 * it was minted for, and carries the person's subject and verified email. The
 * server checks the signature rather than trusting any of it.
 */
export const googleSignInSchema = z.object({
  idToken: z.string().min(20).max(8192),
});

/**
 * What happened, and what the caller has to do next.
 *
 * Two outcomes rather than one, because there is no account yet the first time:
 * Google says who somebody is, not where they are or what to call them. That
 * second outcome is `profile_required`, and its only mandatory input is the
 * link token — the caller may send a city and a name, or neither.
 *
 * It used to be `mobile_required`, and it meant it: `users.mobile` was NOT NULL,
 * so somebody who had just authenticated was shown a phone field with no way
 * past it. The rename is the point of the change rather than a tidy-up. A
 * number is now asked for after the account exists, by `/me/mobile/request`,
 * where declining costs nothing.
 *
 * A flat object with a `status` rather than a union of two shapes: this crosses
 * into a generated OpenAPI document and a Dart client, and both handle one
 * object with optional fields far better than they handle anyOf.
 */
export const googleSignInResultSchema = z.object({
  status: z.enum(["signed_in", "profile_required"]),
  /** Present when `status` is `signed_in`. */
  session: authSessionSchema.optional(),
  /** Present when `status` is `profile_required`. Pass it to `/auth/google/complete`. */
  linkToken: z.string().optional(),
  /** From the Google account, so the next screen can greet them by name. */
  email: z.string().optional(),
  name: z.string().optional(),
});

/**
 * Turning a verified Google identity into an account.
 *
 * Everything except the token is optional, and that is the whole design. The
 * screen this backs asks for a city and explains why it matters — prices,
 * professionals and availability are all per city — but a person who would
 * rather look around first presses past it and gets an account anyway, with a
 * null city that the catalogue reads as "show me everywhere".
 *
 * No mobile field. Adding one here would recreate the wall this replaced, one
 * optional field at a time; the number has its own verified route for after
 * they have a reason to give it.
 */
export const googleCompleteSchema = z.object({
  linkToken: z.string().max(2048),
  name: z.string().trim().min(2).max(80).optional(),
  cityId: z.string().uuid().optional(),
});

/**
 * Changing the things somebody was allowed to skip.
 *
 * `cityId` is nullable rather than merely optional: absent means "leave it
 * alone", explicit null means "I no longer want a city applied", and a screen
 * offering to clear a choice needs to be able to say the second without the
 * server reading it as the first.
 */
export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  cityId: z.string().uuid().nullable().optional(),
});

/**
 * Attaching a mobile number to an account that already exists.
 *
 * The *route* is separate from `/auth/otp/request` even though both send six
 * digits to a phone, because they answer different questions. That one asks
 * "who is this", and an unknown number becomes an account. This one asks "is
 * this number yours", on behalf of somebody already signed in — the session
 * names the account, so the number can never create or switch one.
 *
 * The *body* is deliberately `otpRequestSchema` itself rather than a second
 * object of the same shape. Both are a mobile number and nothing else, and two
 * structurally identical components collide in the OpenAPI document — where the
 * first name alphabetically wins and the other disappears, which here would
 * have silently renamed `RequestOtpBody` out from under the Dart client's
 * sign-in path. Sharing the object is what the registry's identity de-duplication
 * expects, and it is honest: there is one shape, so there is one component.
 */
export const mobileVerificationConfirmSchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, "The code is six digits"),
});

export const staffLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  /**
   * Only bounded, not shaped.
   *
   * A minimum length here would be a rule about *setting* a password applied to
   * checking one — it tells an attacker the passwords are at least that long,
   * and worse, it rejects short guesses before they reach the failed-attempt
   * counter, so brute force below the threshold is never counted or locked out.
   */
  password: z.string().min(1).max(200),
  totp: z.string().regex(/^\d{6}$/).optional(),
});

/** Setting a password is where the strength rule belongs. */
export const setPasswordSchema = z.object({
  password: z.string().min(12).max(200),
});

/* ---------------- the mobile apps ---------------- */

/**
 * Registering a handset for push.
 *
 * `token` is whatever the push provider issued for this installation. It is
 * bound to the current session as well as the user, so signing out removes
 * exactly this device — a recycled handset receiving the previous owner's
 * leads is the failure that matters here.
 */
export const deviceRegistrationSchema = z.object({
  token: z.string().trim().min(16).max(4096),
  platform: z.enum(["android", "ios", "web"]),
  /** The build talking to us, for reading a crash report against a version. */
  appVersion: z.string().trim().max(40).optional(),
});

export const deviceTokenParam = z.object({
  token: z.string().trim().min(16).max(4096),
});

/**
 * Deleting an account.
 *
 * The typed confirmation is not ceremony: this is irreversible, it is reachable
 * from a settings screen on a phone, and both app stores require it to exist.
 * Requiring the word means a mis-tap cannot do it.
 */
export const accountDeletionSchema = z.object({
  confirm: z.literal("DELETE"),
  reason: z.string().trim().max(500).optional(),
});

export const authRoutes = {
  requestOtp: route({
    method: "POST",
    path: "/auth/otp/request",
    audience: "public",
    body: otpRequestSchema,
    summary: "Send a six-digit code to a mobile number",
    response: otpChallengeSchema,
  }),
  googleSignIn: route({
    method: "POST",
    path: "/auth/google",
    audience: "public",
    body: googleSignInSchema,
    summary: "Sign in with a Google ID token, or be told an account still has to be made",
    response: googleSignInResultSchema,
  }),
  completeGoogleSignUp: route({
    method: "POST",
    path: "/auth/google/complete",
    audience: "public",
    body: googleCompleteSchema,
    summary: "Create the account behind a verified Google identity and sign in",
    response: authSessionSchema,
  }),
  verifyOtp: route({
    method: "POST",
    path: "/auth/otp/verify",
    audience: "public",
    body: otpVerifySchema,
    summary: "Exchange a code for a session cookie, creating the account if new",
    response: authSessionSchema,
  }),
  staffLogin: route({
    method: "POST",
    path: "/auth/staff/login",
    audience: "public",
    body: staffLoginSchema,
    summary: "Password and TOTP sign-in for ops and admin",
    response: authSessionSchema,
  }),
  logout: route({
    method: "POST",
    path: "/auth/logout",
    audience: "public",
    body: z.object({}),
    summary: "Revoke the current session",
    response: okSchema,
  }),
  me: route({
    method: "GET",
    path: "/me",
    audience: "public",
    query: z.object({}),
    summary: "The signed-in actor, or 401",
    response: sessionUserSchema,
  }),
  updateProfile: route({
    method: "PATCH",
    path: "/me/profile",
    audience: "public",
    body: profileUpdateSchema,
    summary: "Set or change the name and city on the signed-in account",
    response: sessionUserSchema,
  }),

  /**
   * Adding a number to an account that already has a session.
   *
   * Two calls rather than one, for the same reason sign-in is two calls: the
   * code has to reach the handset in between. The session is what says whose
   * account this is, so neither call takes a user id and neither can be aimed
   * at somebody else's.
   */
  requestMobileVerification: route({
    method: "POST",
    path: "/me/mobile/request",
    audience: "public",
    body: otpRequestSchema,
    summary: "Send a code to a number the signed-in person wants to add",
    response: otpChallengeSchema,
  }),
  confirmMobileVerification: route({
    method: "POST",
    path: "/me/mobile/confirm",
    audience: "public",
    body: mobileVerificationConfirmSchema,
    summary: "Prove that number and attach it to the signed-in account",
    response: sessionUserSchema,
  }),

  registerDevice: route({
    method: "POST",
    path: "/me/devices",
    audience: "public",
    body: deviceRegistrationSchema,
    summary: "Register this handset for push, against the current session",
    response: okSchema,
  }),
  forgetDevice: route({
    method: "DELETE",
    path: "/me/devices/:token",
    audience: "public",
    params: deviceTokenParam,
    summary: "Stop pushing to this handset",
    response: okSchema,
  }),

  deleteAccount: route({
    method: "POST",
    path: "/me/account/delete",
    audience: "public",
    body: accountDeletionSchema,
    summary: "Close the account and revoke every session",
    response: accountClosureSchema,
  }),

  /**
   * What the client needs to know before it does anything else.
   *
   * Unauthenticated and cheap, so a phone can ask on launch. It exists for one
   * reason: once a broken build is on somebody's phone, raising the minimum is
   * the only lever there is.
   */
  appVersion: route({
    method: "GET",
    path: "/app/version",
    audience: "public",
    query: z.object({}),
    summary: "Minimum supported build, and where to get a newer one",
    response: appVersionSchema,
  }),
} as const;
