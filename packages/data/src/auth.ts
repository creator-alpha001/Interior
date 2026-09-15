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

export type OtpChannel = "whatsapp" | "sms";

export interface OtpRequested {
  challengeId: string;
  expiresInSeconds: number;
  /**
   * Where the code actually went. The server swaps a channel that is not live
   * for one that is, so this is not always the one asked for.
   */
  channel?: OtpChannel;
  /** Present only when the API is running with OTP_DEV_ECHO on. */
  devCode?: string;
}

export interface SignedIn {
  actor: Actor;
  /** New OTP-created accounts must choose this before continuing. */
  passwordSetupRequired: boolean;
  /**
   * The session cookie to set on the browser's response, verbatim.
   *
   * Passed back rather than parsed: the attributes the API chose — expiry,
   * SameSite, Secure — are its decision, and re-deriving them here is how the
   * two ends drift apart.
   */
  setCookie: string | null;
}

async function post<T>(
  path: string,
  body: unknown,
  cookie?: string,
): Promise<{ data: T; setCookie: string | null }> {
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
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(cookie ? { cookie } : {}),
      },
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

/** `channel` omitted means WhatsApp. */
export async function requestOtp(mobile: string, channel?: OtpChannel): Promise<OtpRequested> {
  const { data } = await post<OtpRequested>("/auth/otp/request", { mobile, channel });
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
  const { data, setCookie } = await post<Actor & { passwordSetupRequired: boolean }>(
    "/auth/otp/verify",
    input,
  );
  return { actor: data, passwordSetupRequired: data.passwordSetupRequired, setCookie };
}

/**
 * The two ways a Google sign-in can end.
 *
 * `signed_in` is the ordinary case once a linked Google identity has a verified
 * mobile. Pending identities return `profile_required` or `mobile_required`
 * and carry a link token that the OTP verification call consumes.
 */
export type GoogleSignIn =
  | {
      status: "signed_in";
      actor: Actor;
      passwordSetupRequired: boolean;
      setCookie: string | null;
    }
  | {
      status: "profile_required" | "mobile_required";
      linkToken: string;
      email?: string;
      name?: string;
    };

interface GoogleResult {
  status: "signed_in" | "profile_required" | "mobile_required";
  session?: Actor & { passwordSetupRequired: boolean };
  linkToken?: string;
  email?: string;
  name?: string;
}

export async function signInWithGoogle(idToken: string): Promise<GoogleSignIn> {
  const { data, setCookie } = await post<GoogleResult>("/auth/google", { idToken });

  if (data.status === "signed_in" && data.session) {
    return {
      status: "signed_in",
      actor: data.session,
      passwordSetupRequired: data.session.passwordSetupRequired,
      setCookie,
    };
  }

  if ((data.status === "profile_required" || data.status === "mobile_required") && data.linkToken) {
    return {
      status: data.status,
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

/** Compatibility call for the retired Google-only completion endpoint. */
export async function completeGoogleSignUp(input: {
  linkToken: string;
  name?: string;
  cityId?: string;
}): Promise<SignedIn> {
  const { data, setCookie } = await post<Actor & { passwordSetupRequired: boolean }>(
    "/auth/google/complete",
    input,
  );
  return { actor: data, passwordSetupRequired: data.passwordSetupRequired, setCookie };
}

export async function signInWithPassword(mobile: string, password: string): Promise<SignedIn> {
  const { data, setCookie } = await post<Actor & { passwordSetupRequired: boolean }>(
    "/auth/password/login",
    { mobile, password },
  );
  return { actor: data, passwordSetupRequired: data.passwordSetupRequired, setCookie };
}

export async function resetPassword(input: {
  challengeId: string;
  code: string;
  password: string;
}): Promise<SignedIn> {
  const { data, setCookie } = await post<Actor & { passwordSetupRequired: boolean }>(
    "/auth/password/reset",
    input,
  );
  return { actor: data, passwordSetupRequired: data.passwordSetupRequired, setCookie };
}

export async function setMyPassword(cookie: string, password: string): Promise<void> {
  await post<{ ok: true }>("/me/password", { password }, cookie);
}

export async function staffLogin(input: {
  email: string;
  password: string;
  totp?: string;
}): Promise<SignedIn> {
  const { data, setCookie } = await post<Actor & { passwordSetupRequired: boolean }>(
    "/auth/staff/login",
    input,
  );
  return { actor: data, passwordSetupRequired: false, setCookie };
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
