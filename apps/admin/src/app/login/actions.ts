"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError, SESSION_COOKIE, signOut, staffLogin } from "@repo/data";

/**
 * Staff sign-in, and out.
 *
 * A password and an authenticator code rather than the SMS code customers and
 * vendors use, and that difference is deliberate: an ops account can read every
 * customer's phone number and every vendor's margin, so it must not be
 * reachable by whoever ends up with a recycled SIM.
 *
 * Server actions rather than a fetch from the browser, for the same two reasons
 * as the customer site: the session cookie is httpOnly so only a server
 * response can set it, and keeping the API's address out of the browser means
 * the backend needs no public origin and no CORS policy.
 */

export interface StaffLoginState {
  error?: string;
}

export async function staffLoginAction(input: {
  email: string;
  password: string;
  totp?: string;
}): Promise<StaffLoginState | never> {
  try {
    const { setCookie } = await staffLogin({
      email: input.email.trim(),
      password: input.password,
      totp: input.totp?.trim() || undefined,
    });
    await adoptSession(setCookie);
  } catch (error) {
    /*
     * The API's own message is passed through for a client error, and it is
     * careful not to say which half was wrong — "that email and password do not
     * match" rather than "no such account". Anything else becomes a generic
     * failure, because the alternative is leaking an internal error to an
     * unauthenticated caller.
     */
    if (error instanceof ApiError && error.isClientError) {
      return { error: error.message };
    }
    return { error: "We could not sign you in just now." };
  }

  redirect("/");
}

/** Copies the API's session cookie onto this domain. */
async function adoptSession(setCookie: string | null): Promise<void> {
  if (!setCookie) return;

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

export async function staffSignOutAction(): Promise<never> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  await signOut(token ? `${SESSION_COOKIE}=${token}` : undefined);
  store.delete(SESSION_COOKIE);

  redirect("/login");
}
