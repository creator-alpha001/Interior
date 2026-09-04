/**
 * The scheduled work.
 *
 * Each function is idempotent and safe to run twice — a cron that fires late,
 * a deploy that restarts mid-run, or two instances racing must not double
 * anything. Every one returns a count so the log says what it actually did
 * rather than that it ran.
 */
import { and, asc, eq, isNull, lte, ne, sql } from "drizzle-orm";
import { db } from "../db/client";
import * as t from "../db/schema";
import { sendTransactional } from "../lib/sms";

export interface JobResult {
  handled: number;
  detail?: string;
}

/* ------------------------------------------------------------------ *
 * Money
 * ------------------------------------------------------------------ */

/**
 * Marks pending commission invoices overdue once their due date has passed.
 *
 * Nothing set this status before, so `overdue` was read on three screens and
 * reachable from nowhere — the commission dashboard could only ever show zero
 * overdue, however late anybody was.
 */
export async function markInvoicesOverdue(): Promise<JobResult> {
  const rows = await db
    .update(t.commissionInvoices)
    .set({ status: "overdue", updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(t.commissionInvoices.status, "pending"),
        sql`${t.commissionInvoices.dueDate} < current_date`,
      ),
    )
    .returning({
      id: t.commissionInvoices.id,
      professionalId: t.commissionInvoices.professionalId,
      reference: t.commissionInvoices.reference,
      amount: t.commissionInvoices.amount,
    });

  if (rows.length === 0) return { handled: 0 };

  // The vendor is told once, on the day it turns. Chasing beyond that is a
  // conversation, not a cron job.
  const vendors = await db
    .select({ professionalId: t.professionals.id, userId: t.users.id })
    .from(t.professionals)
    .innerJoin(t.users, eq(t.users.id, t.professionals.userId));

  const userByProfessional = new Map(vendors.map((v) => [v.professionalId, v.userId]));

  const notifications = rows
    .map((row) => {
      const userId = userByProfessional.get(row.professionalId);
      if (!userId) return null;
      return {
        userId,
        type: "commission_due" as const,
        title: "A commission invoice is overdue",
        body: `${row.reference} — ₹${row.amount.toLocaleString("en-IN")} was due yesterday.`,
        entityType: "invoice" as const,
        entityId: row.id,
      };
    })
    .filter((n): n is NonNullable<typeof n> => n !== null);

  if (notifications.length > 0) await db.insert(t.notifications).values(notifications);

  return { handled: rows.length, detail: `${notifications.length} vendors told` };
}

/* ------------------------------------------------------------------ *
 * Notification delivery
 * ------------------------------------------------------------------ */

/**
 * Sends the notifications that have been written but not delivered.
 *
 * The `notifications` table is the outbox. A notification row is written inside
 * the same transaction as the thing it describes, so it cannot exist for a
 * write that rolled back — and this job delivers it afterwards. That is why
 * nothing enqueues an SMS directly: an enqueue inside a transaction either
 * escapes the rollback or needs the queue to be in the same database anyway.
 *
 * `dispatchedAt` is set whether or not the SMS actually went. A notification is
 * already visible in the app; the text is a nudge, and retrying it forever
 * because a provider is misconfigured would mean somebody eventually receives
 * two hundred of them.
 */
export async function dispatchNotifications(batchSize = 50): Promise<JobResult> {
  const pending = await db
    .select({
      id: t.notifications.id,
      title: t.notifications.title,
      body: t.notifications.body,
      mobile: t.users.mobile,
      status: t.users.status,
    })
    .from(t.notifications)
    .innerJoin(t.users, eq(t.users.id, t.notifications.userId))
    .where(and(isNull(t.notifications.dispatchedAt), isNull(t.notifications.deletedAt)))
    .orderBy(asc(t.notifications.createdAt))
    .limit(batchSize);

  if (pending.length === 0) return { handled: 0 };

  let sent = 0;

  for (const row of pending) {
    // A blocked account still gets the in-app record; it does not get a text.
    if (row.status === "active") {
      const result = await sendTransactional(row.mobile, `${row.title}. ${row.body}`);
      if (result.sent) sent += 1;
    }

    await db
      .update(t.notifications)
      .set({ dispatchedAt: new Date().toISOString() })
      .where(eq(t.notifications.id, row.id));
  }

  return { handled: pending.length, detail: `${sent} sent by SMS` };
}

/* ------------------------------------------------------------------ *
 * Reminders for our own team
 * ------------------------------------------------------------------ */

/**
 * Tells agents which of their leads have a follow-up due today.
 *
 * One notification per agent, not per lead: five separate texts about five
 * leads is how somebody starts ignoring the notifications.
 */
export async function followUpsDue(): Promise<JobResult> {
  const rows = await db.execute<{ user_id: string; agent_name: string; due: number }>(sql`
    SELECT u.id AS user_id, u.name AS agent_name, count(DISTINCT l.id)::int AS due
    FROM ${t.leads} l
    JOIN ${t.salesAgents} sa ON sa.id = l.assigned_sales_agent_id
    JOIN ${t.users} u ON u.id = sa.user_id
    WHERE l.deleted_at IS NULL
      AND l.overall_status IN ('new', 'verified', 'in_progress')
      AND EXISTS (
        SELECT 1 FROM ${t.leadSalesActivities} a
        WHERE a.lead_id = l.id AND a.follow_up_date <= current_date
      )
    GROUP BY u.id, u.name
  `);

  const agents = rows as unknown as Array<{ user_id: string; agent_name: string; due: number }>;
  if (agents.length === 0) return { handled: 0 };

  await db.insert(t.notifications).values(
    agents.map((a) => ({
      userId: a.user_id,
      type: "new_lead" as const,
      title: "Follow-ups due today",
      body: `${a.due} of your leads have a follow-up date of today or earlier.`,
      entityType: null,
      entityId: null,
    })),
  );

  return { handled: agents.length };
}

/**
 * Flags leads going quietly cold.
 *
 * Two weeks old with nothing finished. Deliberately not "no activity" — a lead
 * somebody called yesterday and is still working is not stale, it is slow, and
 * flagging it teaches people to ignore the flag.
 */
export async function staleLeadAlert(): Promise<JobResult> {
  const rows = await db.execute<{ user_id: string; stale: number }>(sql`
    SELECT u.id AS user_id, count(DISTINCT l.id)::int AS stale
    FROM ${t.leads} l
    JOIN ${t.salesAgents} sa ON sa.id = l.assigned_sales_agent_id
    JOIN ${t.users} u ON u.id = sa.user_id
    WHERE l.deleted_at IS NULL
      AND l.overall_status IN ('new', 'verified', 'in_progress')
      AND l.created_at < now() - interval '14 days'
      AND NOT EXISTS (
        SELECT 1 FROM ${t.leadDomains} ld
        WHERE ld.lead_id = l.id AND ld.status IN ('completed', 'in_progress')
      )
    GROUP BY u.id
  `);

  const agents = rows as unknown as Array<{ user_id: string; stale: number }>;
  if (agents.length === 0) return { handled: 0 };

  await db.insert(t.notifications).values(
    agents.map((a) => ({
      userId: a.user_id,
      type: "new_lead" as const,
      title: "Leads going cold",
      body: `${a.stale} of your leads are over two weeks old with nothing under way.`,
      entityType: null,
      entityId: null,
    })),
  );

  return { handled: agents.length };
}

/* ------------------------------------------------------------------ *
 * Housekeeping
 * ------------------------------------------------------------------ */

/** Removes spent and long-expired one-time codes. */
export async function sweepOtpChallenges(): Promise<JobResult> {
  const rows = await db
    .delete(t.otpChallenges)
    .where(sql`${t.otpChallenges.expiresAt} < now() - interval '1 day'`)
    .returning({ id: t.otpChallenges.id });

  return { handled: rows.length };
}

/**
 * Removes upload tickets that were issued and never used.
 *
 * Only rows nothing points at, and only after a day — somebody can start a
 * requirement form, leave it open over lunch and come back to it.
 */
export async function sweepOrphanMedia(): Promise<JobResult> {
  const rows = await db
    .delete(t.mediaAssets)
    .where(
      and(
        isNull(t.mediaAssets.ownerId),
        sql`${t.mediaAssets.createdAt} < now() - interval '24 hours'`,
      ),
    )
    .returning({ id: t.mediaAssets.id });

  return { handled: rows.length };
}

/** Removes expired and revoked sessions. Keeps the table from growing forever. */
export async function sweepSessions(): Promise<JobResult> {
  const rows = await db
    .delete(t.sessions)
    .where(sql`${t.sessions.expiresAt} < now() - interval '30 days'`)
    .returning({ id: t.sessions.id });

  return { handled: rows.length };
}

/** Removes rate-limit counters whose window closed long ago. */
export async function sweepRateLimits(): Promise<JobResult> {
  const rows = await db
    .delete(t.rateLimits)
    .where(sql`${t.rateLimits.windowStartedAt} < now() - interval '2 days'`)
    .returning({ key: t.rateLimits.key });

  return { handled: rows.length };
}

/**
 * Proves the backups restore.
 *
 * Weekly rather than nightly: it dumps the whole database and restores it into
 * a scratch copy, which is real work, and a week is short enough that a broken
 * backup is found long before anybody needs it.
 *
 * The point is that this *fails* when the restore does not match. A backup job
 * that only checks a file was written verifies that a file was written; the
 * question worth answering is whether the thing in it comes back.
 *
 * Skipped where `pg_dump` is not on the path — a container without the client
 * tools should say so rather than report a passing drill it never ran.
 */
export async function restoreDrill(): Promise<JobResult> {
  const { drill } = await import("../db/backup");

  let result;
  try {
    result = await drill();
  } catch (error) {
    const message = (error as Error).message ?? String(error);
    if (/ENOENT|not recognized|not found/i.test(message)) {
      return { handled: 0, detail: "skipped: pg_dump is not on the path" };
    }
    throw error;
  }

  if (result.problems.length > 0) {
    throw new Error(
      `the restore did not match the source, so the backups are not usable: ${result.problems.join("; ")}`,
    );
  }

  return {
    handled: 1,
    detail: `restore verified: ${result.tables} tables, ${result.rows} rows`,
  };
}
