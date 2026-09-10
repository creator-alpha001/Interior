/**
 * Sign-in, from the frontend's side.
 *
 * These are the only calls that care about response *headers*: the API replies
 * with a Set-Cookie, and because the browser talks to Next rather than to the
 * API directly, the server action has to lift that cookie across itself.
 */
import type { Actor } from "@repo/types";
import { API_BASE_URL, ApiError, USING_API } from "./client";

// Re-exported from here too, since this is where sign-in sets it.
export { SESSION_COOKIE } from "./client";

export interface OtpRequested {
  challengeId: string;
  expiresInSeconds: number;
  /** Present only when the API is running with OTP_DEV_ECHO on. */
  devCode?: string;
}

export interface SignedIn {
  actor: Actor;
  /**
   * The session cookie to set on the browser's response, verbatim.
   *
   * Passed back rather than parsed: the attributes the API chose — expiry,
   * SameSite, Secure — are its decision, and re-deriving them here is how the
   * two ends drift apart.
   */
  setCookie: string | null;
}

async function post<T>(path: string, body: unknown): Promise<{ data: T; setCookie: string | null }> {
  if (!USING_API) {
    throw new ApiError(
      0,
      "no_api_configured",
      "NEXT_PUBLIC_API_URL is not set, so there is no backend to sign in against.",
    );
  }

  const url = new URL(path.replace(/^\//, ""), `${API_BASE_URL.replace(/\/$/, "")}/`);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (cause) {
    throw new ApiError(0, "network_error", "Could not reach the server.", cause);
  }

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : undefined;

  if (!response.ok) {
    const problem = payload as { code?: string; message?: string } | undefined;
    throw new ApiError(
      response.status,
      problem?.code ?? String(response.status),
      problem?.message ?? "Sign-in failed",
      payload,
    );
  }

  return { data: payload as T, setCookie: response.headers.get("set-cookie") };
}

export async function requestOtp(mobile: string): Promise<OtpRequested> {
  const { data } = await post<OtpRequested>("/auth/otp/request", { mobile });
  return data;
}

export async function verifyOtp(input: {
  challengeId: string;
  code: string;
  name?: string;
  cityId?: string;
  /** Set only on the one code that finishes a first Google sign-in. */
  linkToken?: string;
}): Promise<SignedIn> {
  const { data, setCookie } = await post<Actor>("/auth/otp/verify", input);
  return { actor: data, setCookie };
}

/**
 * The two ways a Google sign-in can end.
 *
 * `signed_in` is the ordinary case for anyone who has done this once before.
 * `profile_required` is the first time only: Google has said who they are, and
 * there is still no account here. `linkToken` is what proves that to
 * `completeGoogleSignUp`, which is the only thing that call actually needs.
 */
export type GoogleSignIn =
  | { status: "signed_in"; actor: Actor; setCookie: string | null }
  | { status: "profile_required"; linkToken: string; email?: string; name?: string };

interface GoogleResult {
  status: "signed_in" | "profile_required";
  session?: Actor;
  linkToken?: string;
  email?: string;
  name?: string;
}

export async function signInWithGoogle(idToken: string): Promise<GoogleSignIn> {
  const { data, setCookie } = await post<GoogleResult>("/auth/google", { idToken });

  if (data.status === "signed_in" && data.session) {
    return { status: "signed_in", actor: data.session, setCookie };
  }

  if (data.status === "profile_required" && data.linkToken) {
    return {
      status: "profile_required",
      linkToken: data.linkToken,
      email: data.email,
      name: data.name,
    };
  }

  // The contract makes both fields optional because the response is one flat
  // object rather than a union, so a status without its payload is possible on
  // the wire and would otherwise become a confusing crash further up.
  throw new ApiError(0, "bad_response", "That sign-in came back incomplete. Please try again.");
}

/**
 * Turns a proved Google identity into an account.
 *
 * `city` is the only thing the screen asks for and even that is optional, so
 * this can be called with nothing but the token. Returns a session exactly like
 * a verified OTP does — the account is real from this moment, with whatever
 * gaps its owner chose to leave.
 */
export async function completeGoogleSignUp(input: {
  linkToken: string;
  name?: string;
  cityId?: string;
}): Promise<SignedIn> {
  const { data, setCookie } = await post<Actor>("/auth/google/complete", input);
  return { actor: data, setCookie };
}

export async function staffLogin(input: {
  email: string;
  password: string;
  totp?: string;
}): Promise<SignedIn> {
  const { data, setCookie } = await post<Actor>("/auth/staff/login", input);
  return { actor: data, setCookie };
}

export async function signOut(cookie: string | undefined): Promise<void> {
  if (!USING_API) return;
  const url = new URL("auth/logout", `${API_BASE_URL.replace(/\/$/, "")}/`);
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: "{}",
    cache: "no-store",
  }).catch(() => {
    // Signing out locally matters more than telling the server about it. The
    // session expires on its own either way.
  });
}
