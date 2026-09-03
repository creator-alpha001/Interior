"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError, SESSION_COOKIE, requestOtp, signOut, verifyOtp } from "@repo/data";

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

export async function verifyOtpAction(input: {
  challengeId: string;
  code: string;
  name?: string;
  /** Where they were headed before being sent to sign in. */
  next?: string;
}): Promise<{ error: string } | never> {
  let destination = "/account";

  try {
    const { actor, setCookie } = await verifyOtp(input);

    if (setCookie) {
      // Parsed only far enough to hand the value to Next's cookie store; the
      // attributes the API set are reapplied rather than reinvented.
      const [pair] = setCookie.split(";");
      const [name, ...rest] = (pair ?? "").split("=");
      if (name && rest.length > 0) {
        (await cookies()).set({
          name: name.trim(),
          value: rest.join("="),
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
        });
      }
    }

    // A vendor signing in belongs in the portal, not the customer account area.
    if (actor.role === "professional") destination = "/partner";

    // Only ever a path on this site. An open redirect here would let a phishing
    // link send somebody through a genuine sign-in and out to another domain.
    if (input.next?.startsWith("/") && !input.next.startsWith("//")) {
      const allowed = actor.role === "professional" ? "/partner" : "/account";
      if (input.next.startsWith(allowed)) destination = input.next;
    }
  } catch (error) {
    return { error: messageFor(error, "That code did not work.") };
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
