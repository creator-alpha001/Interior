/**
 * Closing an account.
 *
 * Both app stores require an in-app route to this for any app that can sign in,
 * so it is not optional — but "delete my account" and "delete everything about
 * me" are different requests, and running the second one on this platform would
 * be wrong.
 *
 * What is kept, and why:
 *
 * - **Leads, quotes, agreements, projects, invoices and reviews stay.** They
 *   are commercial records with a second party. An agreement is a contract a
 *   vendor also signed; a commission invoice is a tax record; a review is
 *   something another business is rated on. A customer cannot unilaterally
 *   erase a vendor's contract history, and India's records rules do not let us
 *   either.
 * - **Personal detail goes.** Name, mobile, email and avatar are cleared on the
 *   user row, which is what actually identifies the person. What remains reads
 *   as an anonymous counterparty.
 * - **The row is soft-deleted, not dropped.** Every unique index on `users` is
 *   already partial on `deleted_at IS NULL`, so the number frees up
 *   immediately and the same person can sign up again tomorrow as somebody new
 *   — which is the behaviour a returning customer expects.
 *
 * A vendor with live work is refused rather than silently detached. There are
 * projects running, a customer expecting them, and a commission invoice
 * outstanding; that is a conversation with ops, not a button.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { transaction } from "../../db/client";
import * as t from "../../db/schema";
import { ConflictError, ForbiddenError } from "../../lib/errors";

export interface ClosureRequest {
  userId: string;
  reason?: string;
}

export interface ClosureResult {
  closedAt: string;
  /** What was kept, so the app can say so rather than implying a purge. */
  retained: string[];
}

export async function closeAccount(input: ClosureRequest): Promise<ClosureResult> {
  return transaction(async (tx) => {
    const [user] = await tx
      .select({ id: t.users.id, role: t.users.role, mobile: t.users.mobile })
      .from(t.users)
      .where(and(eq(t.users.id, input.userId), isNull(t.users.deletedAt)))
      .limit(1);

    if (!user) throw new ConflictError("That account is already closed");

    /*
     * Customers and vendors only.
     *
     * A staff account is created and removed by an admin, and it carries a
     * permission set, an audit trail and possibly a queue of leads somebody
     * else now has to pick up. It is also the one role whose requests do not
     * run under a row-level-security scope, so this endpoint would be writing
     * on the unrestricted pool. Neither is a thing to reach from a settings
     * screen.
     */
    if (user.role !== "client" && user.role !== "professional") {
      throw new ForbiddenError("Staff accounts are closed by an administrator");
    }

    /*
     * A professional in the middle of work cannot close themselves.
     *
     * Ops assigned them, a customer is waiting, and there is money owed in both
     * directions. Letting the app do this would leave projects pointing at a
     * cleared user row and a commission invoice nobody can chase.
     */
    if (user.role === "professional") {
      const [liveRow] = await tx
        .select({ live: sql<number>`count(*)::int` })
        .from(t.projects)
        .innerJoin(t.professionals, eq(t.professionals.id, t.projects.professionalId))
        .where(
          and(
            eq(t.professionals.userId, user.id),
            sql`${t.projects.status} IN ('not_started', 'ongoing', 'on_hold')`,
            isNull(t.projects.deletedAt),
          ),
        );

      const live = liveRow?.live ?? 0;
      if (live > 0) {
        throw new ConflictError(
          `There ${live === 1 ? "is 1 project" : `are ${live} projects`} still running under this ` +
            "account. Please speak to us before closing it.",
        );
      }
    }

    const now = new Date().toISOString();

    /*
     * The mobile number is replaced rather than nulled: it is NOT NULL, it is
     * the login identifier, and leaving the real one on a soft-deleted row
     * would mean the person's number is still in the table after they asked for
     * it to go. A per-account opaque value keeps the column's shape without
     * keeping the number.
     *
     * Sized to fit: the column is varchar(20), so seven characters of prefix
     * leave thirteen for the id. Collisions do not matter — the unique index on
     * `mobile` is partial on `deleted_at IS NULL`, and every row written here
     * is deleted — but a distinct value per account is worth having when
     * somebody is reading the table trying to work out what happened.
     */
    await tx
      .update(t.users)
      .set({
        name: "Closed account",
        mobile: `closed:${user.id.replace(/-/g, "").slice(0, 13)}`,
        email: null,
        avatarUrl: null,
        status: "inactive",
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(t.users.id, user.id));

    // Push must stop before anything else — the tokens are the one piece of
    // this that keeps reaching a handset after the account is gone.
    await tx.delete(t.deviceTokens).where(eq(t.deviceTokens.userId, user.id));

    // Every session, everywhere. Closing an account on a phone has to sign out
    // the tablet as well.
    await tx
      .update(t.sessions)
      .set({ revokedAt: now })
      .where(and(eq(t.sessions.userId, user.id), isNull(t.sessions.revokedAt)));

    // Undelivered notifications would otherwise be texted to a number that no
    // longer belongs to this person.
    await tx
      .update(t.notifications)
      .set({ dispatchedAt: now, deliveryChannel: "none", deliveryNote: "account closed" })
      .where(and(eq(t.notifications.userId, user.id), isNull(t.notifications.dispatchedAt)));

    return {
      closedAt: now,
      retained: [
        "Signed agreements and the projects under them",
        "Commission invoices, which are tax records",
        "Reviews you left, shown without your name",
      ],
    };
  });
}
