/**
 * What a staff member is allowed to do.
 *
 * Roles exist because ops and admin are different jobs. An operations manager
 * works leads all day and should not be able to change a commission rate or
 * write off an invoice; a super admin can do both. `AdminRole.permissions`
 * already described that — nothing enforced it.
 */
import { eq } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import type { PermissionKey } from "@repo/types";
import { db } from "../db/client";
import * as t from "../db/schema";
import { ForbiddenError } from "./errors";
import { requireStaff } from "./guard";

/**
 * A sales agent's permissions.
 *
 * Agents have no `admin_roles` row — they are not admins — but they still need
 * to work the queue. This is the floor: everything about leads, and read-only
 * everywhere it helps them answer a customer.
 */
const SALES_AGENT_PERMISSIONS: PermissionKey[] = [
  "leads.view",
  "leads.manage",
  "vendors.view",
  "agreements.view",
  "commission.view",
  "reports.view",
];

export async function permissionsFor(userId: string): Promise<Set<PermissionKey>> {
  const [row] = await db
    .select({ role: t.users.role, permissions: t.adminRoles.permissions })
    .from(t.users)
    .leftJoin(t.adminUsers, eq(t.adminUsers.userId, t.users.id))
    .leftJoin(t.adminRoles, eq(t.adminRoles.id, t.adminUsers.roleId))
    .where(eq(t.users.id, userId))
    .limit(1);

  if (!row) return new Set();

  if (row.permissions) return new Set(row.permissions as PermissionKey[]);
  if (row.role === "sales_agent") return new Set(SALES_AGENT_PERMISSIONS);

  /**
   * An admin with no role row gets everything.
   *
   * Deliberate: the alternative is that a misconfigured admin account can do
   * nothing, and the first thing anybody does about that is grant it
   * everything anyway. Assigning a role narrows them.
   */
  if (row.role === "admin") {
    return new Set([
      "leads.view", "leads.manage",
      "vendors.view", "vendors.verify",
      "agreements.view", "agreements.manage",
      "commission.view", "commission.manage",
      "catalog.manage", "blog.manage", "reports.view", "settings.manage",
    ] satisfies PermissionKey[]);
  }

  return new Set();
}

/**
 * Requires a staff session holding a specific permission.
 *
 * Returns the user id, so a handler asks once and gets both the authorisation
 * check and the id it needs to attribute the change.
 */
export async function requirePermission(
  request: FastifyRequest,
  permission: PermissionKey,
): Promise<string> {
  const userId = await requireStaff(request);
  const held = await permissionsFor(userId);

  if (!held.has(permission)) {
    throw new ForbiddenError("Your role does not include this");
  }

  return userId;
}
