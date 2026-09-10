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
  /** Present only on the code that completes a first Google sign-in. */
  linkToken?: string;
  /** Where they were headed before being sent to sign in. */
  next?: string;
}): Promise<{ error: string } | never> {
  let destination: string;

  try {
    const { actor, setCookie } = await verifyOtp(input);
    await adoptSession(setCookie);
    destination = destinationFor(actor.role, input.next);
  } catch (error) {
    return { error: messageFor(error, "That code did not work.") };
  }

  redirect(destination);
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
      return { linkToken: result.linkToken, email: result.email, name: result.name };
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
