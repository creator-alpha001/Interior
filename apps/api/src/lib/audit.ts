/**
 * The staff audit trail.
 *
 * Recorded by a hook rather than by a call in each handler. There are around
 * twenty staff mutations and there will be more; a helper somebody has to
 * remember to call is a trail with holes in it, and the holes are always in the
 * routes added last and understood least.
 *
 * So every non-GET request to /ops that succeeded gets a row, automatically.
 * The action is the route pattern, not the filled URL, so `/ops/vendors/:id`
 * groups rather than fragmenting into one action per vendor.
 */
import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db/client";
import * as t from "../db/schema";
import { currentActor } from "./guard";

/** Names the thing being acted on, from the route pattern. */
function entityTypeFor(routePattern: string): string {
  const match = routePattern.match(/^\/ops\/([a-z-]+)/);
  if (!match) return "ops";
  // "/ops/vendors/:id" -> "vendor"
  return match[1]!.replace(/s$/, "");
}

/**
 * A readable one-line summary.
 *
 * Enough for somebody scanning the trail to see what happened without decoding
 * a route pattern — "waived" reads better than "PATCH /ops/invoices/:id".
 */
function summarise(method: string, routePattern: string, body: unknown): string {
  const payload = (body ?? {}) as Record<string, unknown>;

  if (routePattern.includes("/assign")) {
    const ids = payload.professionalIds;
    if (!Array.isArray(ids)) return "Assigned professionals";
    return `Assigned ${ids.length} professional${ids.length === 1 ? "" : "s"}`;
  }
  if (routePattern.includes("/visits") && method === "POST") return "Booked a site visit";
  if (routePattern.includes("/outcome")) return "Recorded a visit outcome";
  if (routePattern.includes("/review")) {
    return payload.approve === true ? "Approved stage evidence" : "Sent stage evidence back";
  }
  if (routePattern.includes("/relay/client")) return "Replied to the customer";
  if (routePattern.includes("/relay/vendors")) return "Relayed a message to every assigned vendor";
  if (routePattern.includes("/calls")) return `Logged a call — ${String(payload.callStatus ?? "")}`;
  if (routePattern.includes("/invoices")) {
    return `Invoice marked ${String(payload.status ?? "changed")}${payload.note ? ` — ${String(payload.note)}` : ""}`;
  }
  if (routePattern.includes("/domains") && routePattern.includes(":id")) return "Changed a service";
  if (routePattern.includes("/domains")) return "Created a service";
  if (routePattern.includes("/vendors") && payload.status) {
    return `Vendor set to ${String(payload.status)}`;
  }
  if (routePattern.includes("/vendors") && payload.commissionPercentOverride !== undefined) {
    return `Commission override set to ${String(payload.commissionPercentOverride ?? "the domain default")}`;
  }
  if (routePattern.includes("/tickets")) return "Support ticket updated";

  return `${method} ${routePattern}`;
}

/**
 * Fields worth keeping, from the request body.
 *
 * A whitelist rather than the whole body: message and reply bodies are already
 * stored as messages, and copying them into the audit table doubles where a
 * customer's words live for no gain.
 */
const KEPT = new Set([
  "status",
  "approve",
  "note",
  "professionalIds",
  "commissionPercentOverride",
  "callStatus",
  "followUpDate",
  "scheduledAt",
  "type",
  "changedScope",
  "isActive",
  "defaultCommissionPercent",
]);

function changesFrom(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object") return null;
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (KEPT.has(key)) kept[key] = value;
  }
  return Object.keys(kept).length > 0 ? kept : null;
}

/**
 * Records one staff mutation.
 *
 * Never throws. An audit row failing to write must not turn a successful
 * assignment into a 500 — the work happened, and losing the log entry is the
 * lesser problem. It is logged loudly instead.
 */
export async function recordStaffMutation(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (request.method === "GET" || request.method === "HEAD") return;
  if (!request.url.startsWith("/ops/")) return;
  // Only what actually happened. A 403 is worth knowing about but it is not a
  // change, and mixing the two makes the trail unreadable as a change history.
  if (reply.statusCode >= 400) return;

  try {
    const actor = await currentActor(request);
    if (!actor) return;

    const routePattern = request.routeOptions?.url ?? request.url;
    const params = (request.params ?? {}) as Record<string, string>;

    await db.insert(t.auditLogs).values({
      actorUserId: actor.userId,
      action: `${request.method} ${routePattern}`,
      entityType: entityTypeFor(routePattern),
      entityId: params.id ?? null,
      summary: summarise(request.method, routePattern, request.body),
      changes: changesFrom(request.body),
      ip: request.ip,
    });
  } catch (error) {
    request.log.error({ err: error }, "could not write the audit trail");
  }
}
