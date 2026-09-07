/**
 * A ceiling on writes, applied to every mutation rather than to a list of
 * endpoints somebody has to maintain.
 *
 * The auth routes have their own, much tighter limits — those are the ones an
 * attacker guesses at. This is the broader floor underneath: it exists so that
 * one signed-in account cannot hammer the write path, and so that a bug in a
 * client (a retry loop, a double-submitting form) costs one account's allowance
 * rather than the database.
 *
 * Keyed by session where there is one, and by IP otherwise. A session is the
 * better key: an office shares an IP, and rate limiting the office because one
 * person is busy is a support ticket, not a defence.
 */
import { createHash } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { sessionTokenFrom } from "../modules/auth/sessions";
import { consume, type Limit } from "./rate-limit";

/**
 * Generous for a person, ruinous for a script.
 *
 * A busy ops user working the queue — logging calls, relaying messages,
 * assigning vendors — does not come close to 300 writes in five minutes. The
 * limits are per key, so one agent's burst never touches another's.
 */
const SIGNED_IN: Limit = { max: 300, windowSeconds: 300 };

/**
 * Anonymous writes are a much smaller surface: submitting a requirement, asking
 * for an upload ticket. Anything beyond a handful is not a person filling in a
 * form.
 */
const ANONYMOUS: Limit = { max: 40, windowSeconds: 300 };

/**
 * Routes that carry their own, stricter limit and must not be counted twice.
 *
 * Consuming two allowances for one request would make the tighter limit
 * unreachable — the broad one would refuse first, with the wrong message.
 */
const HAS_ITS_OWN_LIMIT = [
  "/auth/",
  "/uploads/",
  /*
   * The media PUT is authorised by the signature in its own URL, and the ticket
   * that produced that signature was already rate-limited when it was issued.
   *
   * More to the point, this route only exists under the local storage driver:
   * with R2 configured the same upload goes straight to Cloudflare and never
   * reaches this process at all. Charging it here would mean a vendor's write
   * allowance depended on which storage backend ops happened to configure, and
   * a stage submitted with eight photographs would spend nine writes on one
   * driver and one on the other.
   */
  "/media/",
];

/** Writes only. A read costs the database far less and has no side effect. */
const READ_ONLY = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * The rate-limit key.
 *
 * The session token is hashed rather than stored: `rate_limits` is an operational
 * table that gets read during incidents, and a table of live session tokens is
 * not something to leave lying in one.
 */
function keyFor(token: string | undefined, request: FastifyRequest): string {
  if (token) {
    return `write:session:${createHash("sha256").update(token).digest("hex").slice(0, 32)}`;
  }
  return `write:ip:${request.ip}`;
}

export async function limitMutations(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (READ_ONLY.has(request.method)) return;
  if (HAS_ITS_OWN_LIMIT.some((prefix) => request.url.startsWith(prefix))) return;

  /*
   * Read through `sessionTokenFrom`, not the cookie.
   *
   * A mobile client carries its session in an `Authorization` header, so
   * reading only the cookie would key every one of its writes by IP — and treat
   * it as anonymous, on the 40-per-five-minutes allowance rather than 300.
   * Behind a mobile carrier's NAT that is one shared allowance for a great many
   * customers, which would surface as sporadic 429s that nobody could
   * reproduce on a laptop.
   */
  const token = sessionTokenFrom(request);
  await consume(keyFor(token, request), token ? SIGNED_IN : ANONYMOUS);
}
