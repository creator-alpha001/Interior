"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ApiError,
  SESSION_COOKIE,
  requestOtp,
  signInWithGoogle,
  signOut,
  verifyOtp,
} from "@repo/data";

/**
 * Sign-in runs as server actions rather than fetches from the browser.
 *
 * The session cookie is httpOnly, so only a server response can set it; and
 * keeping the API's address out of the browser means the backend never needs a
 * public origin or a CORS policy.
 */

export interface OtpState {
  challengeId?: string;
  expiresInSeconds?: number;
  /** Shown in development only, when the API echoes the code instead of texting it. */
  devCode?: string;
  error?: string;
}

export async function requestOtpAction(mobile: string): Promise<OtpState> {
  try {
    const result = await requestOtp(mobile);
    return {
      challengeId: result.challengeId,
      expiresInSeconds: result.expiresInSeconds,
      devCode: result.devCode,
    };
  } catch (error) {
    return { error: messageFor(error, "We could not send a code just now.") };
  }
}

/**
 * Copies the API's session cookie onto this domain.
 *
 * Shared by both sign-in paths. Written once because the alternative is two
 * copies of "set an httpOnly cookie", and the copy that drifts is the one that
 * silently stops marking it `secure`.
 */
async function adoptSession(setCookie: string | null): Promise<void> {
  if (!setCookie) return;

  // Parsed only far enough to hand the value to Next's cookie store; the
  // attributes the API set are reapplied rather than reinvented.
  const [pair] = setCookie.split(";");
  const [name, ...rest] = (pair ?? "").split("=");
  if (!name || rest.length === 0) return;

  (await cookies()).set({
    name: name.trim(),
    value: rest.join("="),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

/**
 * Where to send somebody once they are in.
 *
 * `next` is only ever a path on this site, and only one inside the area their
 * role belongs to. An open redirect here would let a phishing link send
 * somebody through a genuine sign-in and straight out to another domain.
 */
function destinationFor(role: string, next?: string): string {
  // A vendor signing in belongs in the portal, not the customer account area.
  const home = role === "professional" ? "/partner" : "/account";

  if (next?.startsWith("/") && !next.startsWith("//") && next.startsWith(home)) {
    return next;
  }
  return home;
}

export async function verifyOtpAction(input: {
  challengeId: string;
  code: string;
  name?: string;
  /**
   * Where they are. Used only when the account is being created.
   *
   * Sent on every verification rather than only on a first sign-in, because
   * the client cannot tell which this is — the server is the only place that
   * knows whether the number is already an account, and it ignores this for
   * one that is.
   */
  cityId?: string;
  /** Present only on the code that completes a first Google sign-in. */
  linkToken?: string;
  /** Where they were headed before being sent to sign in. */
  next?: string;
}): Promise<{ error: string } | never> {
  let destination: string;

  try {
    const { actor, setCookie } = await verifyOtp(input);
    await adoptSession(setCookie);

    /**
     * Browsing follows the city they just chose.
     *
     * The catalogue reads this cookie, not the account — prices, professionals
     * and availability are all per city. Without it somebody could sign up in
     * Lucknow and go straight back to a Bengaluru catalogue, which is the
     * "results should match my location" failure rather than a cosmetic one.
     */
    if (input.cityId) {
      (await cookies()).set({
        name: "city",
        value: input.cityId,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    // Whether or not this carried a link token: the sign-in is over either way,
    // and leaving the cookie behind would offer to resume a finished one.
    await forgetGoogleLink();
    destination = destinationFor(actor.role, input.next);
  } catch (error) {
    return { error: messageFor(error, "That code did not work.") };
  }

  redirect(destination);
}

/**
 * Where a half-finished Google sign-in is kept.
 *
 * It used to live only in React state, which meant a reload — or the browser
 * restoring the tab, or anything at all that remounted the page — threw the
 * link token away and dropped the person back to the start with no way to
 * finish. They had proved who they were to Google and the site had forgotten.
 *
 * httpOnly, because it carries the signed token that says which Google account
 * this is; short-lived, because the token behind it expires in fifteen minutes
 * and a stale cookie would offer to finish a sign-in that can no longer be
 * finished.
 */
const GOOGLE_LINK_COOKIE = "interiobee_google_link";
const GOOGLE_LINK_TTL_SECONDS = 15 * 60;

async function rememberGoogleLink(state: GoogleState): Promise<void> {
  (await cookies()).set({
    name: GOOGLE_LINK_COOKIE,
    value: Buffer.from(JSON.stringify(state), "utf8").toString("base64url"),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GOOGLE_LINK_TTL_SECONDS,
  });
}

async function forgetGoogleLink(): Promise<void> {
  (await cookies()).delete(GOOGLE_LINK_COOKIE);
}

/**
 * The pending Google sign-in, if there is one. Read by the login page so a
 * reload resumes where it was rather than starting again.
 */
export async function pendingGoogleLink(): Promise<GoogleState | null> {
  const raw = (await cookies()).get(GOOGLE_LINK_COOKIE)?.value;
  if (!raw) return null;

  try {
    const state = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as GoogleState;
    return state.linkToken ? state : null;
  } catch {
    // A malformed cookie is not worth an error page; starting over is the
    // right outcome and the only one available.
    return null;
  }
}

/**
 * Abandons a half-finished Google sign-in.
 *
 * Signing in with the wrong Google account is an easy mistake on a shared
 * machine, and without this the login page would go on insisting on a number
 * for that account until the token expired a quarter of an hour later.
 */
export async function clearGoogleLinkAction(): Promise<void> {
  await forgetGoogleLink();
}

export interface GoogleState {
  /** Set when this Google account has no number against it yet. */
  linkToken?: string;
  email?: string;
  name?: string;
  error?: string;
}

/**
 * Signs in with a Google ID token the browser obtained.
 *
 * Returns rather than redirects when the account is new, because there is a
 * step left: `users.mobile` is NOT NULL and ops ring every customer about
 * their lead, so a first-time Google user verifies one code and the two are
 * linked for good.
 */
export async function googleSignInAction(
  idToken: string,
  next?: string,
): Promise<GoogleState | never> {
  let destination: string;

  try {
    const result = await signInWithGoogle(idToken);

    if (result.status === "mobile_required") {
      const state: GoogleState = {
        linkToken: result.linkToken,
        email: result.email,
        name: result.name,
      };
      await rememberGoogleLink(state);
      return state;
    }

    await adoptSession(result.setCookie);
    destination = destinationFor(result.actor.role, next);
  } catch (error) {
    return { error: messageFor(error, "That Google sign-in did not work.") };
  }

  redirect(destination);
}

export async function signOutAction(): Promise<never> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  await signOut(token ? `${SESSION_COOKIE}=${token}` : undefined);
  store.delete(SESSION_COOKIE);

  redirect("/");
}

function messageFor(error: unknown, fallback: string): string {
  // The API writes messages meant to be read by the person who caused them —
  // "That code is not right, or it has expired" — so pass them through rather
  // than replacing them with something vaguer.
  if (error instanceof ApiError && error.isClientError) return error.message;
  return fallback;
}
