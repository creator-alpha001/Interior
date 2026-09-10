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
 * Two outcomes rather than one, because a Google account alone cannot finish
 * signing somebody up. `users.mobile` is NOT NULL and ops ring every customer
 * about their lead, so a first-time Google user still verifies a number once —
 * after which `signed_in` is the only outcome they ever see again.
 *
 * A flat object with a `status` rather than a union of two shapes: this crosses
 * into a generated OpenAPI document and a Dart client, and both handle one
 * object with optional fields far better than they handle anyOf.
 */
export const googleSignInResultSchema = z.object({
  status: z.enum(["signed_in", "mobile_required"]),
  /** Present when `status` is `signed_in`. */
  session: authSessionSchema.optional(),
  /** Present when `status` is `mobile_required`. Pass it to `/auth/otp/verify`. */
  linkToken: z.string().optional(),
  /** From the Google account, so the next screen can greet them by name. */
  email: z.string().optional(),
  name: z.string().optional(),
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
    summary: "Sign in with a Google ID token, or be asked for a mobile number first",
    response: googleSignInResultSchema,
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
