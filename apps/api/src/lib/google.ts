/**
 * Verifying a Google ID token.
 *
 * Both the website and the Android app end up holding one of these: Google
 * Identity Services hands the browser a credential, and `google_sign_in` hands
 * Flutter an `idToken`. Taking the token rather than running an OAuth redirect
 * means one endpoint serves both, and the mobile app never has to keep a client
 * secret it could not keep.
 *
 * Verified here rather than by calling Google's `tokeninfo` endpoint. That
 * endpoint is rate limited and puts Google in the path of every sign-in; the
 * signature is checkable locally against keys that change a few times a day.
 *
 * No dependency: Node imports a JWK directly, so RS256 is `crypto.verify` and
 * some base64url.
 */
import { createPublicKey, verify as verifySignature } from "node:crypto";
import { NotAuthenticatedError } from "./errors";

const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

/** Google's own issuer claim. Both spellings are documented and both appear. */
const ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

/**
 * Tolerance for clock differences between us and Google.
 *
 * Small on purpose. It exists so a server a few seconds fast does not reject
 * every fresh token, not to extend the life of an expired one.
 */
const CLOCK_SKEW_SECONDS = 60;

export interface GoogleIdentity {
  /** The `sub` claim: Google's immutable id for this person. */
  subject: string;
  email: string;
  name?: string;
  picture?: string;
}

interface Jwk {
  kid: string;
  [key: string]: unknown;
}

let cache: { keys: Jwk[]; expiresAt: number } | null = null;

/**
 * Google's signing keys, cached until they expire.
 *
 * The `max-age` on the response is what Google says the keys are good for, so
 * it is used rather than a number invented here. Falls back to an hour when the
 * header is missing or unparseable, and never caches an empty set — a failed
 * fetch must not pin us to "no keys" until the TTL runs out.
 */
async function signingKeys(): Promise<Jwk[]> {
  if (cache && cache.expiresAt > Date.now()) return cache.keys;

  const response = await fetch(JWKS_URL);
  if (!response.ok) {
    throw new NotAuthenticatedError("Could not verify that Google sign-in. Please try again.");
  }

  const body = (await response.json()) as { keys?: Jwk[] };
  const keys = body.keys ?? [];
  if (keys.length === 0) {
    throw new NotAuthenticatedError("Could not verify that Google sign-in. Please try again.");
  }

  const maxAge = /max-age=(\d+)/.exec(response.headers.get("cache-control") ?? "")?.[1];
  const ttlSeconds = maxAge ? Number(maxAge) : 3600;
  cache = { keys, expiresAt: Date.now() + ttlSeconds * 1000 };
  return keys;
}

function decodeSegment(segment: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new NotAuthenticatedError("That Google sign-in was not readable.");
  }
}

/**
 * Checks an ID token and returns who it says the person is.
 *
 * `audiences` is a list because the web, Android and iOS builds each have their
 * own client id and all three sign in through the same endpoint. Accepting any
 * audience would mean accepting a token minted for an entirely different
 * application, which is the whole reason the claim exists.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  audiences: string[],
): Promise<GoogleIdentity> {
  if (audiences.length === 0) {
    // A server fault, not the caller's, so not a 401. It must still throw: an
    // empty allowlist would otherwise read as "accept tokens minted for
    // anybody", which is the one thing the audience claim exists to prevent.
    throw new Error("GOOGLE_CLIENT_IDS is empty, so no Google token can be trusted");
  }

  const parts = idToken.split(".");
  if (parts.length !== 3) throw new NotAuthenticatedError("That Google sign-in was not readable.");

  const [encodedHeader, encodedPayload, encodedSignature] = parts as [string, string, string];
  const header = decodeSegment(encodedHeader);
  const payload = decodeSegment(encodedPayload);

  if (header.alg !== "RS256") {
    // `alg` comes from the token, so trusting it is how signature checks get
    // skipped entirely. Google signs with RS256 and nothing else is accepted.
    throw new NotAuthenticatedError("That Google sign-in used an unexpected algorithm.");
  }

  const keys = await signingKeys();
  const jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) throw new NotAuthenticatedError("That Google sign-in has expired. Please try again.");

  const signed = Buffer.from(`${encodedHeader}.${encodedPayload}`, "utf8");
  const signature = Buffer.from(encodedSignature, "base64url");
  const key = createPublicKey({ key: jwk as never, format: "jwk" });

  if (!verifySignature("sha256", signed, key, signature)) {
    throw new NotAuthenticatedError("That Google sign-in could not be verified.");
  }

  if (typeof payload.iss !== "string" || !ISSUERS.has(payload.iss)) {
    throw new NotAuthenticatedError("That Google sign-in came from the wrong issuer.");
  }
  if (typeof payload.aud !== "string" || !audiences.includes(payload.aud)) {
    throw new NotAuthenticatedError("That Google sign-in was issued for a different app.");
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp + CLOCK_SKEW_SECONDS < now) {
    throw new NotAuthenticatedError("That Google sign-in has expired. Please try again.");
  }
  if (typeof payload.iat === "number" && payload.iat - CLOCK_SKEW_SECONDS > now) {
    throw new NotAuthenticatedError("That Google sign-in is not valid yet.");
  }

  const subject = payload.sub;
  if (typeof subject !== "string" || subject.length === 0) {
    throw new NotAuthenticatedError("That Google sign-in carried no account id.");
  }

  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : undefined;
  if (!email) throw new NotAuthenticatedError("That Google account has no email address.");

  /**
   * An unverified address is not evidence of anything.
   *
   * Google issues these for accounts whose address it has not confirmed, and
   * the whole value of the email here is that somebody else vouched for it.
   */
  if (payload.email_verified !== true) {
    throw new NotAuthenticatedError("That Google account's email address is not verified.");
  }

  return {
    subject,
    email,
    name: typeof payload.name === "string" ? payload.name : undefined,
    picture: typeof payload.picture === "string" ? payload.picture : undefined,
  };
}
