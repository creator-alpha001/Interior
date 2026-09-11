/**
 * The dashboard's "needs your attention" row.
 *
 * Every screen in the panel has its own queue — leads, applications, vendor
 * paperwork, stage photos, visits, commission, tickets — and the only way to
 * learn that something new had arrived was to open each one. This answers the
 * question once: what, anywhere, is waiting on us, and which item first.
 *
 * Each card is a count and the few entries that have waited longest (newest,
 * for new leads, which are news rather than a backlog). Every count is a SQL
 * aggregate, never a length of rows loaded to be counted.
 *
 * Cards are computed independently and a failing one reports itself rather than
 * failing the dashboard: a panel whose front page dies because one table is
 * unreachable tells nobody anything.
 */
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import type { AttentionCard, AttentionEntry, AttentionKey, AttentionView } from "@repo/types";
import { db } from "../../db/client";
import * as t from "../../db/schema";

/** How many entries each card lists. The rest are behind "View all". */
const SHOWN = 3;

export async function getAttention(): Promise<AttentionView> {
  const cards = await Promise.all([
    card("new_leads", newLeads),
    card("awaiting_reply", awaitingReply),
    card("unassigned_leads", unassignedLeads),
    card("follow_ups", followUps),
    card("applications", applications),
    card("paperwork", paperwork),
    card("trade_requests", tradeRequests),
    card("stage_proof", stageProof),
    card("visit_writeups", visitWriteUps),
    card("reschedules", reschedules),
    card("overdue_commission", overdueCommission),
    card("open_tickets", openTickets),
  ]);
  return { cards };
}

type Counted = { count: number; entries: AttentionEntry[]; note?: string | null };

async function card(key: AttentionKey, load: () => Promise<Counted>): Promise<AttentionCard> {
  try {
    const { count: total, entries, note = null } = await load();
    return { key, count: total, note, failed: false, entries: entries.slice(0, SHOWN) };
  } catch (error) {
    console.error(`[attention] ${key} could not be counted`, error);
    return { key, count: 0, note: null, failed: true, entries: [] };
  }
}

function rows<T>(result: unknown): T[] {
  return result as T[];
}

/* ------------------------------------------------------------------ *
 * Leads
 * ------------------------------------------------------------------ */

async function newLeads(): Promise<Counted> {
  const where = and(isNull(t.leads.deletedAt), eq(t.leads.overallStatus, "new"));

  const [[total], latest] = await Promise.all([
    db.select({ value: count() }).from(t.leads).where(where),
    db
      .select({
        id: t.leads.id,
        reference: t.leads.reference,
        createdAt: t.leads.createdAt,
        client: t.users.name,
        city: t.cities.name,
      })
      .from(t.leads)
      .innerJoin(t.clients, eq(t.clients.id, t.leads.clientId))
      .innerJoin(t.users, eq(t.users.id, t.clients.userId))
      .innerJoin(t.cities, eq(t.cities.id, t.leads.cityId))
      .where(where)
      .orderBy(desc(t.leads.createdAt))
      .limit(SHOWN),
  ]);

  return {
    count: total?.value ?? 0,
    entries: latest.map((r) => ({
      targetId: r.id,
      title: r.client,
      detail: `${r.reference} · ${r.city}`,
      at: r.createdAt,
    })),
  };
}

/** A thread is waiting on us when its newest message came from the customer. */
async function awaitingReply(): Promise<Counted> {
  const waiting = rows<{ lead_id: string; reference: string; domain: string; body: string; at: string }>(
    await db.execute(sql`
      SELECT l.id AS lead_id, l.reference, d.name AS domain, latest.body, latest.created_at AS at
      FROM (
        SELECT DISTINCT ON (m.lead_domain_id) m.lead_domain_id, m.sender_role, m.body, m.created_at
        FROM ${t.messages} m
        WHERE m.channel = 'client_platform' AND m.deleted_at IS NULL
        ORDER BY m.lead_domain_id, m.created_at DESC
      ) latest
      JOIN ${t.leadDomains} ld ON ld.id = latest.lead_domain_id AND ld.deleted_at IS NULL
      JOIN ${t.leads} l ON l.id = ld.lead_id AND l.deleted_at IS NULL
      JOIN ${t.domains} d ON d.id = ld.domain_id
      WHERE latest.sender_role = 'client'
      ORDER BY latest.created_at ASC
    `),
  );

  return {
    count: new Set(waiting.map((w) => w.lead_id)).size,
    entries: waiting.map((w) => ({
      targetId: w.lead_id,
      title: `${w.reference} · ${w.domain}`,
      detail: `“${w.body.length > 70 ? `${w.body.slice(0, 70)}…` : w.body}”`,
      at: w.at,
    })),
  };
}

async function unassignedLeads(): Promise<Counted> {
  const where = and(
    eq(t.leadDomains.status, "pending_assignment"),
    isNull(t.leadDomains.deletedAt),
    isNull(t.leads.deletedAt),
  );

  const [[total], oldest] = await Promise.all([
    db
      .select({ value: sql<number>`count(DISTINCT ${t.leadDomains.leadId})::int` })
      .from(t.leadDomains)
      .innerJoin(t.leads, eq(t.leads.id, t.leadDomains.leadId))
      .where(where),
    db
      .select({
        leadId: t.leads.id,
        reference: t.leads.reference,
        domain: t.domains.name,
        createdAt: t.leadDomains.createdAt,
      })
      .from(t.leadDomains)
      .innerJoin(t.leads, eq(t.leads.id, t.leadDomains.leadId))
      .innerJoin(t.domains, eq(t.domains.id, t.leadDomains.domainId))
      .where(where)
      .orderBy(asc(t.leadDomains.createdAt))
      .limit(SHOWN),
  ]);

  return {
    count: Number(total?.value ?? 0),
    entries: oldest.map((r) => ({
      targetId: r.leadId,
      title: `${r.reference} · ${r.domain}`,
      detail: "No vendors assigned yet",
      at: r.createdAt,
    })),
  };
}

/** Leads whose latest call set a follow-up for today or earlier. */
async function followUps(): Promise<Counted> {
  const today = new Date().toISOString().slice(0, 10);

  const due = rows<{ lead_id: string; reference: string; client: string; due: string }>(
    await db.execute(sql`
      SELECT l.id AS lead_id, l.reference, u.name AS client, latest.follow_up_date::text AS due
      FROM (
        SELECT DISTINCT ON (a.lead_id) a.lead_id, a.follow_up_date
        FROM ${t.leadSalesActivities} a
        WHERE a.deleted_at IS NULL
        ORDER BY a.lead_id, a.created_at DESC
      ) latest
      JOIN ${t.leads} l ON l.id = latest.lead_id
        AND l.deleted_at IS NULL
        AND l.overall_status IN ('new', 'verified', 'in_progress')
      JOIN ${t.clients} c ON c.id = l.client_id
      JOIN ${t.users} u ON u.id = c.user_id
      WHERE latest.follow_up_date IS NOT NULL AND latest.follow_up_date <= ${today}::date
      ORDER BY latest.follow_up_date ASC
    `),
  );

  return {
    count: due.length,
    entries: due.map((d) => ({
      targetId: d.lead_id,
      title: d.client,
      detail: `${d.reference} · follow-up due`,
      at: d.due,
    })),
  };
}

/* ------------------------------------------------------------------ *
 * Vendors
 * ------------------------------------------------------------------ */

async function applications(): Promise<Counted> {
  const where = and(
    isNull(t.professionalApplications.deletedAt),
    inArray(t.professionalApplications.status, ["submitted", "under_review"]),
  );

  const [[total], oldest] = await Promise.all([
    db.select({ value: count() }).from(t.professionalApplications).where(where),
    db
      .select({
        id: t.professionalApplications.id,
        companyName: t.professionalApplications.companyName,
        status: t.professionalApplications.status,
        submittedAt: t.professionalApplications.submittedAt,
        applicant: t.users.name,
      })
      .from(t.professionalApplications)
      .innerJoin(t.users, eq(t.users.id, t.professionalApplications.userId))
      .where(where)
      .orderBy(asc(t.professionalApplications.submittedAt))
      .limit(SHOWN),
  ]);

  return {
    count: total?.value ?? 0,
    entries: oldest.map((r) => ({
      targetId: r.id,
      title: r.companyName,
      detail: `${r.applicant} · ${r.status === "under_review" ? "being reviewed" : "not opened yet"}`,
      at: r.submittedAt,
    })),
  };
}

/**
 * Vendors with something sent for verification: signed agreement pages or
 * documents to review, or an original on its way that needs marking received.
 * One entry per vendor, because that is where it is all reviewed.
 */
async function paperwork(): Promise<Counted> {
  const vendors = rows<{
    professional_id: string;
    company_name: string;
    has_copy: boolean;
    documents: number;
    has_original: boolean;
    latest: string | null;
  }>(
    await db.execute(sql`
      WITH items AS (
        SELECT pa.professional_id, 'copy' AS what, pa.signed_copy_submitted_at AS at
        FROM ${t.partnerAgreements} pa
        WHERE pa.signed_copy_status = 'submitted' AND pa.status <> 'superseded'
        UNION ALL
        SELECT d.professional_id, 'document', d.submitted_at
        FROM ${t.vendorDocuments} d
        WHERE d.status = 'submitted' AND d.deleted_at IS NULL
        UNION ALL
        SELECT pa.professional_id, 'original', pa.hardcopy_dispatched_at
        FROM ${t.partnerAgreements} pa
        WHERE pa.hardcopy_status = 'dispatched' AND pa.status <> 'superseded'
      )
      SELECT i.professional_id, p.company_name,
             bool_or(i.what = 'copy') AS has_copy,
             (count(*) FILTER (WHERE i.what = 'document'))::int AS documents,
             bool_or(i.what = 'original') AS has_original,
             min(i.at) AS latest
      FROM items i
      JOIN ${t.professionals} p ON p.id = i.professional_id AND p.deleted_at IS NULL
      GROUP BY i.professional_id, p.company_name
      ORDER BY min(i.at) ASC NULLS LAST
    `),
  );

  return {
    count: vendors.length,
    entries: vendors.map((v) => ({
      targetId: v.professional_id,
      title: v.company_name,
      detail:
        [
          v.has_copy ? "signed agreement" : null,
          v.documents > 0 ? `${v.documents} ${v.documents === 1 ? "document" : "documents"}` : null,
          v.has_original ? "original on its way" : null,
        ]
          .filter(Boolean)
          .join(" · ") || "Paperwork to review",
      at: v.latest,
    })),
  };
}

async function tradeRequests(): Promise<Counted> {
  const where = and(
    eq(t.professionalDomains.verificationStatus, "pending"),
    isNull(t.professionalDomains.deletedAt),
    isNull(t.professionals.deletedAt),
  );

  const [[total], oldest] = await Promise.all([
    db
      .select({ value: count() })
      .from(t.professionalDomains)
      .innerJoin(t.professionals, eq(t.professionals.id, t.professionalDomains.professionalId))
      .where(where),
    db
      .select({
        professionalId: t.professionals.id,
        companyName: t.professionals.companyName,
        domain: t.domains.name,
        createdAt: t.professionalDomains.createdAt,
      })
      .from(t.professionalDomains)
      .innerJoin(t.professionals, eq(t.professionals.id, t.professionalDomains.professionalId))
      .innerJoin(t.domains, eq(t.domains.id, t.professionalDomains.domainId))
      .where(where)
      .orderBy(asc(t.professionalDomains.createdAt))
      .limit(SHOWN),
  ]);

  return {
    count: total?.value ?? 0,
    entries: oldest.map((r) => ({
      targetId: r.professionalId,
      title: r.companyName,
      detail: `Wants approval for ${r.domain}`,
      at: r.createdAt,
    })),
  };
}

/* ------------------------------------------------------------------ *
 * Work in progress
 * ------------------------------------------------------------------ */

async function stageProof(): Promise<Counted> {
  const where = and(
    eq(t.projectMilestones.verification, "submitted"),
    isNull(t.projects.deletedAt),
  );

  const [[total], oldest] = await Promise.all([
    db
      .select({ value: count() })
      .from(t.projectMilestones)
      .innerJoin(t.projects, eq(t.projects.id, t.projectMilestones.projectId))
      .where(where),
    db
      .select({
        leadId: t.leadDomains.leadId,
        stage: t.projectMilestones.title,
        reference: t.projects.reference,
        vendor: t.professionals.companyName,
        submittedAt: t.projectMilestones.submittedAt,
      })
      .from(t.projectMilestones)
      .innerJoin(t.projects, eq(t.projects.id, t.projectMilestones.projectId))
      .innerJoin(t.leadDomains, eq(t.leadDomains.id, t.projects.leadDomainId))
      .innerJoin(t.professionals, eq(t.professionals.id, t.projects.professionalId))
      .where(where)
      .orderBy(asc(t.projectMilestones.submittedAt))
      .limit(SHOWN),
  ]);

  return {
    count: total?.value ?? 0,
    entries: oldest.map((r) => ({
      targetId: r.leadId,
      title: `${r.stage} · ${r.vendor}`,
      detail: r.reference,
      at: r.submittedAt,
    })),
  };
}

/** Visits that have happened with nothing written up — the same rule as My day. */
async function visitWriteUps(): Promise<Counted> {
  const today = new Date().toISOString().slice(0, 10);
  const where = and(
    sql`${t.meetings.scheduledAt}::date < ${today}::date`,
    isNull(t.meetings.outcome),
    ne(t.meetings.status, "no_show"),
    isNull(t.leads.deletedAt),
  );

  return meetingCard(where, asc(t.meetings.scheduledAt), "scheduledAt", "Visit not written up");
}

async function reschedules(): Promise<Counted> {
  const where = and(
    isNotNull(t.meetings.rescheduleRequestedAt),
    ne(t.meetings.status, "completed"),
    isNull(t.leads.deletedAt),
  );

  return meetingCard(
    where,
    asc(t.meetings.rescheduleRequestedAt),
    "rescheduleRequestedAt",
    "Customer asked for a new slot",
  );
}

async function meetingCard(
  where: ReturnType<typeof and>,
  order: ReturnType<typeof asc>,
  at: "scheduledAt" | "rescheduleRequestedAt",
  detail: string,
): Promise<Counted> {
  const [[total], oldest] = await Promise.all([
    db
      .select({ value: count() })
      .from(t.meetings)
      .innerJoin(t.leadDomains, eq(t.leadDomains.id, t.meetings.leadDomainId))
      .innerJoin(t.leads, eq(t.leads.id, t.leadDomains.leadId))
      .where(where),
    db
      .select({
        leadId: t.leads.id,
        reference: t.leads.reference,
        vendor: t.professionals.companyName,
        scheduledAt: t.meetings.scheduledAt,
        rescheduleRequestedAt: t.meetings.rescheduleRequestedAt,
      })
      .from(t.meetings)
      .innerJoin(t.leadDomains, eq(t.leadDomains.id, t.meetings.leadDomainId))
      .innerJoin(t.leads, eq(t.leads.id, t.leadDomains.leadId))
      .innerJoin(t.professionals, eq(t.professionals.id, t.meetings.professionalId))
      .where(where)
      .orderBy(order)
      .limit(SHOWN),
  ]);

  return {
    count: total?.value ?? 0,
    entries: oldest.map((r) => ({
      targetId: r.leadId,
      title: `${r.reference} · ${r.vendor}`,
      detail,
      at: r[at],
    })),
  };
}

/* ------------------------------------------------------------------ *
 * Money and support
 * ------------------------------------------------------------------ */

async function overdueCommission(): Promise<Counted> {
  const where = eq(t.commissionInvoices.status, "overdue");

  const [[total], oldest] = await Promise.all([
    db
      .select({
        value: count(),
        amount: sql<number>`COALESCE(sum(${t.commissionInvoices.amount}), 0)::float8`,
      })
      .from(t.commissionInvoices)
      .where(where),
    db
      .select({
        reference: t.commissionInvoices.reference,
        amount: t.commissionInvoices.amount,
        dueDate: t.commissionInvoices.dueDate,
        vendor: t.professionals.companyName,
      })
      .from(t.commissionInvoices)
      .innerJoin(t.professionals, eq(t.professionals.id, t.commissionInvoices.professionalId))
      .where(where)
      .orderBy(asc(t.commissionInvoices.dueDate))
      .limit(SHOWN),
  ]);

  const outstanding = Number(total?.amount ?? 0);

  return {
    count: total?.value ?? 0,
    note: outstanding > 0 ? `${rupees(outstanding)} outstanding` : null,
    entries: oldest.map((r) => ({
      targetId: null,
      title: r.vendor,
      detail: `${r.reference} · ${rupees(r.amount)}`,
      at: r.dueDate,
    })),
  };
}

async function openTickets(): Promise<Counted> {
  const [[totals], oldest] = await Promise.all([
    db
      .select({
        open: sql<number>`(count(*) FILTER (WHERE ${t.supportTickets.status} = 'open'))::int`,
        inProgress: sql<number>`(count(*) FILTER (WHERE ${t.supportTickets.status} = 'in_progress'))::int`,
      })
      .from(t.supportTickets),
    db
      .select({
        subject: t.supportTickets.subject,
        reference: t.supportTickets.reference,
        priority: t.supportTickets.priority,
        createdAt: t.supportTickets.createdAt,
      })
      .from(t.supportTickets)
      .where(eq(t.supportTickets.status, "open"))
      // Urgent first, then oldest — the same order as the support screen.
      .orderBy(
        sql`CASE ${t.supportTickets.priority}
              WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`,
        asc(t.supportTickets.createdAt),
      )
      .limit(SHOWN),
  ]);

  const inProgress = Number(totals?.inProgress ?? 0);

  return {
    count: Number(totals?.open ?? 0),
    note: inProgress > 0 ? `${inProgress} more in progress` : null,
    entries: oldest.map((r) => ({
      targetId: null,
      title: r.subject,
      detail: `${r.reference} · ${r.priority} priority`,
      at: r.createdAt,
    })),
  };
}

function rupees(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
