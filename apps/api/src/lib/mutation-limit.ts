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
import { SESSION_COOKIE } from "../modules/auth/sessions";
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
const HAS_ITS_OWN_LIMIT = ["/auth/", "/uploads/"];

/** Writes only. A read costs the database far less and has no side effect. */
const READ_ONLY = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * The rate-limit key.
 *
 * The session token is hashed rather than stored: `rate_limits` is an operational
 * table that gets read during incidents, and a table of live session tokens is
 * not something to leave lying in one.
 */
function keyFor(request: FastifyRequest): string {
  const token = request.cookies?.[SESSION_COOKIE];
  if (token) {
    return `write:session:${createHash("sha256").update(token).digest("hex").slice(0, 32)}`;
  }
  return `write:ip:${request.ip}`;
}

export async function limitMutations(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (READ_ONLY.has(request.method)) return;
  if (HAS_ITS_OWN_LIMIT.some((prefix) => request.url.startsWith(prefix))) return;

  const signedIn = Boolean(request.cookies?.[SESSION_COOKIE]);
  await consume(keyFor(request), signedIn ? SIGNED_IN : ANONYMOUS);
}
