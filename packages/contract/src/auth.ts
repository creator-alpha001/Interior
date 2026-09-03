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

export const authRoutes = {
  requestOtp: route({
    method: "POST",
    path: "/auth/otp/request",
    audience: "public",
    body: otpRequestSchema,
    summary: "Send a six-digit code to a mobile number",
  }),
  verifyOtp: route({
    method: "POST",
    path: "/auth/otp/verify",
    audience: "public",
    body: otpVerifySchema,
    summary: "Exchange a code for a session cookie, creating the account if new",
  }),
  staffLogin: route({
    method: "POST",
    path: "/auth/staff/login",
    audience: "public",
    body: staffLoginSchema,
    summary: "Password and TOTP sign-in for ops and admin",
  }),
  logout: route({
    method: "POST",
    path: "/auth/logout",
    audience: "public",
    body: z.object({}),
    summary: "Revoke the current session",
  }),
  me: route({
    method: "GET",
    path: "/me",
    audience: "public",
    query: z.object({}),
    summary: "The signed-in actor, or 401",
  }),
} as const;
