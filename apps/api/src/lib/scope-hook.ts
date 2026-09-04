/**
 * Puts customer and vendor requests on a connection that knows who they are.
 *
 * Applied to the personal surfaces only. Ops read across every customer by
 * design, the public catalogue has no actor, and the jobs run with none — all
 * three keep the pool and are unaffected.
 *
 * The cost is one pooled connection held for the length of the request, which
 * is exactly why this is not applied to everything: it buys row-level security
 * on the routes where a scoping mistake would expose one person's data to
 * another, and nowhere else.
 *
 * Two hooks, because the work splits across the two shapes Fastify offers. The
 * first is async and does the awaiting; the second is callback-style, because
 * the context only reaches the handler if `done` is called *inside*
 * `runInScope`. An async hook that returned would leave the handler outside the
 * context, and `db` would resolve to the pool — with the failure mode being
 * that row-level security silently does nothing at all.
 */
import type { FastifyReply, FastifyRequest, HookHandlerDoneFunction } from "fastify";
import { openScope, runInScope, type ActorScope } from "../db/actor-context";
import { opsDb } from "../db/client";
import { currentActor } from "./guard";

/** Route prefixes where a request belongs to exactly one person. */
const PERSONAL = ["/me", "/vendor"];

/** Route prefixes where a signed-in staff member reads across everybody. */
const STAFF = ["/ops"];

declare module "fastify" {
  interface FastifyRequest {
    actorScope?: ActorScope;
    /** Set for staff requests, which use the bypassing pool rather than a reservation. */
    useOpsPool?: boolean;
  }
}

/** Reserves the connection and stamps the actor onto it. */
export async function reserveActorScope(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const staff = STAFF.some((prefix) => request.url.startsWith(prefix));
  if (!staff && !PERSONAL.some((prefix) => request.url.startsWith(prefix))) return;

  const actor = await currentActor(request);

  if (staff) {
    // No reservation and no settings: the staff pool carries no identity,
    // because staff queries are global. Their access is decided by the
    // permission checks and recorded in the audit trail.
    if (actor?.role === "admin" || actor?.role === "sales_agent") request.useOpsPool = true;
    return;
  }

  // Signed out, or staff following a link into a customer URL. Neither gets a
  // scope; the route's own guard decides what to do about it.
  if (!actor) return;
  if (actor.role !== "client" && actor.role !== "professional") return;

  request.actorScope = await openScope({
    userId: actor.userId,
    clientId: actor.role === "client" ? actor.clientId : null,
    professionalId: actor.role === "professional" ? actor.professionalId : null,
  });
}

/** Enters the scope, so everything downstream runs inside it. */
export function enterActorScope(
  request: FastifyRequest,
  _reply: FastifyReply,
  done: HookHandlerDoneFunction,
): void {
  if (request.useOpsPool) return runInScope(opsDb, done);
  if (!request.actorScope) return done();
  runInScope(request.actorScope.database, done);
}

/**
 * Gives the connection back.
 *
 * On `onResponse`, so it survives a handler that threw — a leaked reservation
 * would take a connection out of the pool permanently, and ten of those would
 * stop the service.
 */
export async function releaseActorScope(request: FastifyRequest): Promise<void> {
  const scope = request.actorScope;
  if (!scope) return;
  request.actorScope = undefined;
  await scope.release().catch((error: Error) => {
    request.log.error({ err: error }, "could not release the actor's connection");
  });
}
