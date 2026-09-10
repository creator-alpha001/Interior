/**
 * A short-lived note saying "this Google account has been verified".
 *
 * Signing in with Google for the first time cannot finish on its own: the
 * account still needs a mobile number, because ops ring every customer about
 * their lead. So the flow is Google, then one OTP, then the two are linked.
 *
 * Something has to carry the Google identity across those two requests, and it
 * must not be the client's word for it. The alternatives were a row in a table
 * — a second thing to write, expire and sweep — or this: the claim itself,
 * signed with the key that already signs sessions, so a forged one is not a
 * lookup miss but a signature failure.
 *
 * It authorises nothing on its own. Presenting one only links a Google account
 * to a number that has *just* been proved by a code sent to it.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../../lib/config";
import { ValidationError } from "../../lib/errors";

/**
 * Long enough to read an SMS, short enough that a copied link is worthless.
 *
 * The OTP itself expires in five minutes, so this only has to outlive one
 * code and the retry after it.
 */
const TTL_SECONDS = 15 * 60;

export interface PendingIdentity {
  provider: "google" | "apple";
  subject: string;
  email: string;
  name?: string;
}

interface Envelope extends PendingIdentity {
  /** Unix seconds. */
  exp: number;
}

function sign(body: string): string {
  // SESSION_SECRET is required in production and is already the secret that
  // decides whether a session cookie is real, so a forged link token needs the
  // same thing a forged session would.
  return createHmac("sha256", config.SESSION_SECRET ?? "development-only")
    .update(body)
    .digest("base64url");
}

export function issueLinkToken(identity: PendingIdentity): string {
  const envelope: Envelope = {
    ...identity,
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

/**
 * Reads a link token back, or refuses.
 *
 * Compared with `timingSafeEqual` rather than `===`. The window is small and
 * the payload is not secret, but a signature check that leaks its answer by
 * how long it takes is a bad habit to keep anywhere near authentication.
 */
export function readLinkToken(token: string): PendingIdentity {
  const refuse = () => new ValidationError("That sign-in link has expired. Please start again.");

  const [body, signature] = token.split(".");
  if (!body || !signature) throw refuse();

  const expected = Buffer.from(sign(body), "utf8");
  const supplied = Buffer.from(signature, "utf8");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw refuse();

  let envelope: Envelope;
  try {
    envelope = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Envelope;
  } catch {
    throw refuse();
  }

  if (typeof envelope.exp !== "number" || envelope.exp < Math.floor(Date.now() / 1000)) {
    throw refuse();
  }
  if (!envelope.subject || !envelope.email) throw refuse();

  return {
    provider: envelope.provider,
    subject: envelope.subject,
    email: envelope.email,
    name: envelope.name,
  };
}
