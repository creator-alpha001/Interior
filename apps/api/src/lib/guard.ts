/**
 * Turning a request into a caller, and refusing it when it is not the right one.
 *
 * Every authenticated route starts with one of these. They exist so a route
 * handler never reaches for `request.cookies` itself, and so "this endpoint is
 * for customers" is one word at the top of the handler rather than a check
 * somebody can forget to write.
 */
import type { FastifyRequest } from "fastify";
import type { Actor } from "@repo/types";
import { ForbiddenError, NotAuthenticatedError } from "./errors";
import { SESSION_COOKIE, resolveSession } from "../modules/auth/sessions";

export async function currentActor(request: FastifyRequest): Promise<Actor | null> {
  const session = await resolveSession(request.cookies[SESSION_COOKIE]);
  return session?.actor ?? null;
}

async function actorOrThrow(request: FastifyRequest): Promise<Actor> {
  const actor = await currentActor(request);
  if (!actor) throw new NotAuthenticatedError();
  return actor;
}

/**
 * The signed-in customer's id.
 *
 * This is the whole reason no endpoint takes a `clientId`: the id comes from
 * the session cookie, so a request cannot ask for somebody else's leads by
 * changing a parameter.
 */
export async function requireClient(request: FastifyRequest): Promise<string> {
  const actor = await actorOrThrow(request);
  if (actor.role !== "client") throw new ForbiddenError("This is a customer area");
  return actor.clientId;
}

export async function requireProfessional(request: FastifyRequest): Promise<string> {
  const actor = await actorOrThrow(request);
  if (actor.role !== "professional") throw new ForbiddenError("This is a professional area");
  return actor.professionalId;
}

/** Ops and admin both. Returns the user id, for attributing what they change. */
export async function requireStaff(request: FastifyRequest): Promise<string> {
  const actor = await actorOrThrow(request);
  if (actor.role !== "admin" && actor.role !== "sales_agent") {
    throw new ForbiddenError("This is a staff area");
  }
  return actor.userId;
}

/** The signed-in user, whoever they are — for notifications and tickets. */
export async function requireUser(request: FastifyRequest): Promise<string> {
  return (await actorOrThrow(request)).userId;
}
