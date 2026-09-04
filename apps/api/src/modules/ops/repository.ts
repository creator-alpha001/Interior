/**
 * What our own team sees.
 *
 * Staff see the customer unmasked — a coordinator cannot ring somebody they
 * have no number for — which is exactly why this deploys as a separate app
 * behind its own login.
 *
 * The queue is paged and the dashboards are SQL aggregates. Both matter: the
 * previous implementation loaded every lead to count them, which is fine at six
 * and ruinous at sixty thousand.
 */
import { and, asc, count, desc, eq, gte, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import type {
  AdminDashboard,
  CommissionFocusRow,
  DomainSlice,
  LeadProjectView,
  LeadStatus,
  MyDayView,
  OpsLeadRow,
  Paginated,
  RelayView,
  SalesDashboard,
  TimelineEvent,
  Urgency,
  VendorPoolEntry,
} from "@repo/types";
import { db } from "../../db/client";
import * as t from "../../db/schema";
import { NotFoundError } from "../../lib/errors";
import { toDomain, toProfessionalSummary } from "../../lib/mappers";
import { decodeCursor, page } from "../../lib/pagination";
import { buildLeadViews } from "../customer/views";

export interface OpsLeadFilters {
  status?: LeadStatus | "all";
  domain?: string;
  city?: string;
  urgency?: Urgency;
  agentId?: string;
  search?: string;
  /** Only leads with at least one service still awaiting assignment. */
  needsAssignment?: boolean;
  limit: number;
  cursor?: string;
}

function queueConditions(filters: OpsLeadFilters) {
  const conditions = [isNull(t.leads.deletedAt)];

  if (filters.status && filters.status !== "all") {
    conditions.push(eq(t.leads.overallStatus, filters.status));
  }
  if (filters.city) conditions.push(eq(t.leads.cityId, filters.city));
  if (filters.urgency) conditions.push(eq(t.leads.urgency, filters.urgency));
  if (filters.agentId) conditions.push(eq(t.leads.assignedSalesAgentId, filters.agentId));

  if (filters.search) {
    const term = `%${filters.search.toLowerCase()}%`;
    conditions.push(
      or(
        sql`lower(${t.leads.reference}) LIKE ${term}`,
        sql`lower(${t.leads.description}) LIKE ${term}`,
        sql`EXISTS (
          SELECT 1 FROM ${t.clients} c
          JOIN ${t.users} u ON u.id = c.user_id
          WHERE c.id = ${t.leads.clientId}
            AND (lower(u.name) LIKE ${term} OR u.mobile LIKE ${term})
        )`,
      )!,
    );
  }

  if (filters.domain) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM ${t.leadDomains} ld
      JOIN ${t.domains} d ON d.id = ld.domain_id
      WHERE ld.lead_id = ${t.leads.id} AND d.slug = ${filters.domain}
    )`);
  }

  if (filters.needsAssignment) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM ${t.leadDomains} ld
      WHERE ld.lead_id = ${t.leads.id}
        AND ld.status = 'pending_assignment'
        AND ld.deleted_at IS NULL
    )`);
  }

  return and(...conditions);
}

/**
 * The lead queue.
 *
 * Ordered by urgency then age, because that is the order a coordinator should
 * work through them — an "immediate" raised this morning outranks an
 * "exploring" from last week.
 */
export async function listLeads(filters: OpsLeadFilters): Promise<Paginated<OpsLeadRow>> {
  const offset = decodeCursor(filters.cursor);
  const where = queueConditions(filters);

  const [rows, [totals]] = await Promise.all([
    db
      .select({ id: t.leads.id })
      .from(t.leads)
      .where(where)
      .orderBy(
        sql`CASE ${t.leads.urgency}
              WHEN 'immediate' THEN 0
              WHEN 'within_month' THEN 1
              ELSE 2
            END`,
        asc(t.leads.createdAt),
      )
      .limit(filters.limit)
      .offset(offset),
    db.select({ value: count() }).from(t.leads).where(where),
  ]);

  const items = await decorate(rows.map((r) => r.id));
  return page(items, totals?.value ?? 0, offset, filters.limit);
}

export async function getLead(leadId: string): Promise<OpsLeadRow> {
  const [row] = await decorate([leadId]);
  if (!row) throw new NotFoundError("That lead");
  return row;
}

/**
 * Turns lead ids into queue rows.
 *
 * The counts a coordinator triages on — unassigned services, unanswered
 * questions, age — are computed here in three queries rather than by walking
 * the fully assembled view.
 */
async function decorate(leadIds: string[]): Promise<OpsLeadRow[]> {
  if (leadIds.length === 0) return [];

  const [views, activityRows, unassignedRows, awaitingRows] = await Promise.all([
    buildLeadViews(leadIds),
    db
      .select({
        leadId: t.leadSalesActivities.leadId,
        activity: t.leadSalesActivities,
        agentName: t.users.name,
      })
      .from(t.leadSalesActivities)
      .innerJoin(t.salesAgents, eq(t.salesAgents.id, t.leadSalesActivities.salesAgentId))
      .innerJoin(t.users, eq(t.users.id, t.salesAgents.userId))
      .where(inArray(t.leadSalesActivities.leadId, leadIds))
      .orderBy(desc(t.leadSalesActivities.createdAt)),
    db
      .select({ leadId: t.leadDomains.leadId, value: count() })
      .from(t.leadDomains)
      .where(
        and(
          inArray(t.leadDomains.leadId, leadIds),
          eq(t.leadDomains.status, "pending_assignment"),
          isNull(t.leadDomains.deletedAt),
        ),
      )
      .groupBy(t.leadDomains.leadId),
    /**
     * A client question we have not answered.
     *
     * "Unanswered" means the newest message in the thread came from them —
     * counting unread would flag anything a coordinator simply had not opened,
     * which is a different and much noisier thing.
     */
    db.execute<{ lead_id: string; value: number }>(sql`
      SELECT ld.lead_id, count(*)::int AS value
      FROM ${t.leadDomains} ld
      WHERE ld.lead_id = ANY(${sql.param(leadIds)}::uuid[])
        AND EXISTS (
          SELECT 1 FROM ${t.messages} m
          WHERE m.lead_domain_id = ld.id
            AND m.channel = 'client_platform'
            AND m.sender_role = 'client'
            AND m.created_at > COALESCE((
              SELECT max(r.created_at) FROM ${t.messages} r
              WHERE r.lead_domain_id = ld.id
                AND r.channel = 'client_platform'
                AND r.sender_role = 'platform'
            ), '-infinity'::timestamptz)
        )
      GROUP BY ld.lead_id
    `),
  ]);

  const latestActivity = new Map<string, (typeof activityRows)[number]>();
  for (const row of activityRows) {
    if (!latestActivity.has(row.leadId)) latestActivity.set(row.leadId, row);
  }

  const unassigned = new Map(unassignedRows.map((r) => [r.leadId, r.value]));
  const awaiting = new Map(
    (awaitingRows as unknown as Array<{ lead_id: string; value: number }>).map((r) => [
      r.lead_id,
      Number(r.value),
    ]),
  );

  const now = Date.now();

  return views.map((view) => {
    const activity = latestActivity.get(view.lead.id);
    return {
      lead: view,
      agentName: activity?.agentName ?? null,
      lastActivity: (activity?.activity ?? null) as OpsLeadRow["lastActivity"],
      followUpDate: activity?.activity.followUpDate ?? null,
      unassignedDomains: unassigned.get(view.lead.id) ?? 0,
      awaitingReply: awaiting.get(view.lead.id) ?? 0,
      ageDays: Math.floor((now - new Date(view.lead.createdAt).getTime()) / 86_400_000),
    };
  });
}

/* ------------------------------------------------------------------ *
 * The relay console
 * ------------------------------------------------------------------ */

export async function getRelay(leadDomainId: string): Promise<RelayView> {
  const [row] = await db
    .select({ leadDomain: t.leadDomains, domain: t.domains, clientName: t.users.name })
    .from(t.leadDomains)
    .innerJoin(t.domains, eq(t.domains.id, t.leadDomains.domainId))
    .innerJoin(t.leads, eq(t.leads.id, t.leadDomains.leadId))
    .innerJoin(t.clients, eq(t.clients.id, t.leads.clientId))
    .innerJoin(t.users, eq(t.users.id, t.clients.userId))
    .where(eq(t.leadDomains.id, leadDomainId))
    .limit(1);

  if (!row) throw new NotFoundError("That service");

  const [messages, assignments] = await Promise.all([
    db
      .select()
      .from(t.messages)
      .where(and(eq(t.messages.leadDomainId, leadDomainId), isNull(t.messages.deletedAt)))
      .orderBy(asc(t.messages.createdAt)),
    db
      .select({ assignment: t.leadDomainAssignments })
      .from(t.leadDomainAssignments)
      .where(
        and(
          eq(t.leadDomainAssignments.leadDomainId, leadDomainId),
          // A vendor who declined is not part of the conversation any more.
          ne(t.leadDomainAssignments.responseStatus, "rejected"),
        ),
      ),
  ]);

  const professionalIds = assignments.map((a) => a.assignment.professionalId);
  const summaries = await summariesFor(professionalIds);

  const clientThread = messages.filter((m) => m.channel === "client_platform");
  const lastClient = [...clientThread].reverse().find((m) => m.senderRole === "client");
  const lastReply = [...clientThread].reverse().find((m) => m.senderRole === "platform");

  return {
    leadDomainId,
    domain: toDomain(row.domain),
    clientName: row.clientName,
    clientThread: clientThread as unknown as RelayView["clientThread"],
    clientAwaitingReply: Boolean(
      lastClient && (!lastReply || lastClient.createdAt > lastReply.createdAt),
    ),
    vendorThreads: professionalIds
      .map((professionalId) => {
        const thread = messages.filter(
          (m) => m.channel === "platform_vendor" && m.professionalId === professionalId,
        );
        const lastVendor = [...thread].reverse().find((m) => m.senderRole === "professional");
        const lastOurs = [...thread].reverse().find((m) => m.senderRole === "platform");

        return {
          professional: summaries.get(professionalId)!,
          messages: thread as unknown as RelayView["clientThread"],
          awaitingReply: Boolean(
            lastVendor && (!lastOurs || lastVendor.createdAt > lastOurs.createdAt),
          ),
        };
      })
      .filter((thread) => thread.professional),
  };
}

async function summariesFor(professionalIds: string[]) {
  const unique = [...new Set(professionalIds)].filter(Boolean);
  const byId = new Map<string, ReturnType<typeof toProfessionalSummary>>();
  if (unique.length === 0) return byId;

  const [rows, domainRows] = await Promise.all([
    db
      .select({ professional: t.professionals, user: t.users, city: t.cities })
      .from(t.professionals)
      .innerJoin(t.users, eq(t.users.id, t.professionals.userId))
      .innerJoin(t.cities, eq(t.cities.id, t.users.cityId))
      .where(inArray(t.professionals.id, unique)),
    db
      .select({ professionalId: t.professionalDomains.professionalId, domain: t.domains })
      .from(t.professionalDomains)
      .innerJoin(t.domains, eq(t.domains.id, t.professionalDomains.domainId))
      .where(
        and(
          inArray(t.professionalDomains.professionalId, unique),
          eq(t.professionalDomains.verificationStatus, "approved"),
        ),
      ),
  ]);

  for (const row of rows) {
    byId.set(
      row.professional.id,
      toProfessionalSummary({
        professional: row.professional,
        user: row.user,
        city: row.city,
        domains: domainRows.filter((d) => d.professionalId === row.professional.id).map((d) => d.domain),
      }),
    );
  }
  return byId;
}

/* ------------------------------------------------------------------ *
 * The vendor pool
 * ------------------------------------------------------------------ */

/**
 * Everyone eligible for this service in this city, ranked.
 *
 * Nothing is auto-assigned. This is a shortlist to phone, in the order worth
 * phoning: a vendor the client asked for first, then by rating, then by who is
 * least busy — a five-star vendor quoting nine other jobs is a slower answer
 * than a four-star one quoting none.
 */
export async function getVendorPool(leadDomainId: string): Promise<VendorPoolEntry[]> {
  const [row] = await db
    .select({ leadDomain: t.leadDomains, cityId: t.leads.cityId })
    .from(t.leadDomains)
    .innerJoin(t.leads, eq(t.leads.id, t.leadDomains.leadId))
    .where(eq(t.leadDomains.id, leadDomainId))
    .limit(1);

  if (!row) throw new NotFoundError("That service");

  // The single definition of "may be assigned work": verified, approved for
  // this trade, serving this city, and signed up.
  const eligible = await db.execute<{ professional_id: string }>(sql`
    SELECT DISTINCT professional_id
    FROM eligible_vendors
    WHERE domain_id = ${row.leadDomain.domainId} AND city_id = ${row.cityId}
  `);

  const ids = (eligible as unknown as Array<{ professional_id: string }>).map(
    (r) => r.professional_id,
  );
  if (ids.length === 0) return [];

  const [summaries, assigned, loads] = await Promise.all([
    summariesFor(ids),
    db
      .select({ professionalId: t.leadDomainAssignments.professionalId })
      .from(t.leadDomainAssignments)
      .where(eq(t.leadDomainAssignments.leadDomainId, leadDomainId)),
    db
      .select({ professionalId: t.leadDomainAssignments.professionalId, value: count() })
      .from(t.leadDomainAssignments)
      .innerJoin(t.leadDomains, eq(t.leadDomains.id, t.leadDomainAssignments.leadDomainId))
      .where(
        and(
          inArray(t.leadDomainAssignments.professionalId, ids),
          inArray(t.leadDomains.status, ["assigned", "quoted"]),
          ne(t.leadDomains.id, leadDomainId),
        ),
      )
      .groupBy(t.leadDomainAssignments.professionalId),
  ]);

  const assignedIds = new Set(assigned.map((a) => a.professionalId));
  const loadById = new Map(loads.map((l) => [l.professionalId, l.value]));

  return ids
    .map((id) => ({
      professional: summaries.get(id)!,
      isAssigned: assignedIds.has(id),
      isPreferred: row.leadDomain.preferredProfessionalId === id,
      activeLoad: loadById.get(id) ?? 0,
    }))
    .filter((entry) => entry.professional)
    .sort(
      (a, b) =>
        Number(b.isPreferred) - Number(a.isPreferred) ||
        b.professional.avgRating - a.professional.avgRating ||
        a.activeLoad - b.activeLoad,
    );
}

/* ------------------------------------------------------------------ *
 * One lead, in depth
 * ------------------------------------------------------------------ */

export async function listCallLog(leadId: string) {
  const rows = await db
    .select({ activity: t.leadSalesActivities, agentName: t.users.name })
    .from(t.leadSalesActivities)
    .innerJoin(t.salesAgents, eq(t.salesAgents.id, t.leadSalesActivities.salesAgentId))
    .innerJoin(t.users, eq(t.users.id, t.salesAgents.userId))
    .where(eq(t.leadSalesActivities.leadId, leadId))
    .orderBy(desc(t.leadSalesActivities.createdAt));

  // Paired with the agent's name: "who said this?" is the first thing anybody
  // asks when reading a call log back.
  return rows.map((r) => ({ activity: r.activity, agentName: r.agentName }));
}

/**
 * Everything that has happened on a lead, in one list.
 *
 * Ops answer "what is going on with this?" constantly, usually with a customer
 * already on the phone. Reconstructing that from six separate screens is the
 * slow part, so it is assembled once here.
 */
export async function getTimeline(leadId: string): Promise<TimelineEvent[]> {
  const [lead] = await db
    .select({ lead: t.leads, clientName: t.users.name })
    .from(t.leads)
    .innerJoin(t.clients, eq(t.clients.id, t.leads.clientId))
    .innerJoin(t.users, eq(t.users.id, t.clients.userId))
    .where(eq(t.leads.id, leadId))
    .limit(1);

  if (!lead) throw new NotFoundError("That lead");

  const [calls, assignments, quotes, meetings, messages, agreements, projects, stages] =
    await Promise.all([
      db
        .select({ a: t.leadSalesActivities, agent: t.users.name })
        .from(t.leadSalesActivities)
        .innerJoin(t.salesAgents, eq(t.salesAgents.id, t.leadSalesActivities.salesAgentId))
        .innerJoin(t.users, eq(t.users.id, t.salesAgents.userId))
        .where(eq(t.leadSalesActivities.leadId, leadId)),
      db
        .select({ a: t.leadDomainAssignments, domain: t.domains.name, pro: t.professionals.companyName })
        .from(t.leadDomainAssignments)
        .innerJoin(t.leadDomains, eq(t.leadDomains.id, t.leadDomainAssignments.leadDomainId))
        .innerJoin(t.domains, eq(t.domains.id, t.leadDomains.domainId))
        .innerJoin(t.professionals, eq(t.professionals.id, t.leadDomainAssignments.professionalId))
        .where(eq(t.leadDomains.leadId, leadId)),
      db
        .select({ q: t.quotes, domain: t.domains.name, pro: t.professionals.companyName })
        .from(t.quotes)
        .innerJoin(t.leadDomains, eq(t.leadDomains.id, t.quotes.leadDomainId))
        .innerJoin(t.domains, eq(t.domains.id, t.leadDomains.domainId))
        .innerJoin(t.professionals, eq(t.professionals.id, t.quotes.professionalId))
        .where(eq(t.leadDomains.leadId, leadId)),
      db
        .select({ m: t.meetings, domain: t.domains.name, pro: t.professionals.companyName })
        .from(t.meetings)
        .innerJoin(t.leadDomains, eq(t.leadDomains.id, t.meetings.leadDomainId))
        .innerJoin(t.domains, eq(t.domains.id, t.leadDomains.domainId))
        .innerJoin(t.professionals, eq(t.professionals.id, t.meetings.professionalId))
        .where(eq(t.leadDomains.leadId, leadId)),
      db
        .select({ m: t.messages, domain: t.domains.name })
        .from(t.messages)
        .innerJoin(t.leadDomains, eq(t.leadDomains.id, t.messages.leadDomainId))
        .innerJoin(t.domains, eq(t.domains.id, t.leadDomains.domainId))
        .where(eq(t.leadDomains.leadId, leadId)),
      db
        .select({ a: t.agreements, pro: t.professionals.companyName })
        .from(t.agreements)
        .innerJoin(t.professionals, eq(t.professionals.id, t.agreements.professionalId))
        .where(eq(t.agreements.leadId, leadId)),
      db
        .select({ p: t.projects, domain: t.domains.name })
        .from(t.projects)
        .innerJoin(t.leadDomains, eq(t.leadDomains.id, t.projects.leadDomainId))
        .innerJoin(t.domains, eq(t.domains.id, t.leadDomains.domainId))
        .where(eq(t.leadDomains.leadId, leadId)),
      db
        .select({ s: t.projectMilestones, domain: t.domains.name })
        .from(t.projectMilestones)
        .innerJoin(t.projects, eq(t.projects.id, t.projectMilestones.projectId))
        .innerJoin(t.leadDomains, eq(t.leadDomains.id, t.projects.leadDomainId))
        .innerJoin(t.domains, eq(t.domains.id, t.leadDomains.domainId))
        .where(and(eq(t.leadDomains.leadId, leadId), sql`${t.projectMilestones.submittedAt} IS NOT NULL`)),
    ]);

  const events: TimelineEvent[] = [
    {
      id: `created-${lead.lead.id}`,
      kind: "created",
      at: lead.lead.createdAt,
      title: "Requirement raised",
      detail: lead.lead.description.slice(0, 160),
      domainName: null,
      actor: lead.clientName,
    },
    ...calls.map((c) => ({
      id: `call-${c.a.id}`,
      kind: "call" as const,
      at: c.a.createdAt,
      title: `Call — ${c.a.callStatus.replace(/_/g, " ")}`,
      detail: c.a.remarks || null,
      domainName: null,
      actor: c.agent,
    })),
    ...assignments.map((a) => ({
      id: `assign-${a.a.id}`,
      kind: "assigned" as const,
      at: a.a.assignedAt,
      title: `${a.pro} assigned`,
      detail: a.a.responseStatus === "rejected" ? a.a.rejectionReason : null,
      domainName: a.domain,
      actor: null,
    })),
    ...quotes.map((q) => ({
      id: `quote-${q.q.id}`,
      kind: "quote" as const,
      at: q.q.createdAt,
      title: `Quote v${q.q.version} from ${q.pro}`,
      detail: `₹${q.q.total.toLocaleString("en-IN")} · ${q.q.timelineDays} days`,
      domainName: q.domain,
      actor: q.pro,
    })),
    ...meetings.map((m) => ({
      id: `visit-${m.m.id}`,
      kind: "meeting" as const,
      at: m.m.scheduledAt,
      title: `${m.m.type.replace(/_/g, " ")} with ${m.pro}`,
      detail: m.m.outcome ?? m.m.notes,
      domainName: m.domain,
      actor: m.pro,
    })),
    ...messages.map((m) => ({
      id: `msg-${m.m.id}`,
      kind: "message" as const,
      at: m.m.createdAt,
      title:
        m.m.channel === "client_platform"
          ? m.m.senderRole === "client"
            ? "Client wrote in"
            : "We replied to the client"
          : m.m.senderRole === "professional"
            ? "Vendor wrote in"
            : "We wrote to a vendor",
      detail: m.m.body.slice(0, 160),
      domainName: m.domain,
      actor: null,
    })),
    ...agreements.map((a) => ({
      id: `agr-${a.a.id}`,
      kind: "agreement" as const,
      at: a.a.signedAt ?? a.a.createdAt,
      title: a.a.signedAt ? `Agreement signed with ${a.pro}` : `Agreement sent to ${a.pro}`,
      detail: `${a.a.reference} · ₹${a.a.totalValue.toLocaleString("en-IN")}`,
      domainName: null,
      actor: null,
    })),
    ...projects.map((p) => ({
      id: `prj-${p.p.id}`,
      kind: "project" as const,
      at: p.p.createdAt,
      title: `Work started — ${p.p.reference}`,
      detail: null,
      domainName: p.domain,
      actor: null,
    })),
    ...stages.map((s) => ({
      id: `stage-${s.s.id}`,
      kind: "stage" as const,
      at: s.s.verifiedAt ?? s.s.submittedAt!,
      title:
        s.s.verification === "approved"
          ? `Stage approved — ${s.s.title}`
          : s.s.verification === "rejected"
            ? `Stage sent back — ${s.s.title}`
            : `Stage evidence submitted — ${s.s.title}`,
      detail: s.s.verifierNote ?? s.s.proofNote,
      domainName: s.domain,
      actor: null,
    })),
  ];

  return events.sort((a, b) => b.at.localeCompare(a.at));
}

export async function getLeadProjects(leadId: string): Promise<LeadProjectView[]> {
  const rows = await db
    .select({
      project: t.projects,
      domainName: t.domains.name,
      leadDomainId: t.leadDomains.id,
      professionalName: t.professionals.companyName,
    })
    .from(t.projects)
    .innerJoin(t.leadDomains, eq(t.leadDomains.id, t.projects.leadDomainId))
    .innerJoin(t.domains, eq(t.domains.id, t.leadDomains.domainId))
    .innerJoin(t.professionals, eq(t.professionals.id, t.projects.professionalId))
    .where(eq(t.leadDomains.leadId, leadId));

  if (rows.length === 0) return [];

  const milestones = await db
    .select()
    .from(t.projectMilestones)
    .where(
      inArray(
        t.projectMilestones.projectId,
        rows.map((r) => r.project.id),
      ),
    )
    .orderBy(asc(t.projectMilestones.sortOrder));

  return rows.map((row) => {
    const mine = milestones.filter((m) => m.projectId === row.project.id);
    const approved = mine.filter((m) => m.verification === "approved");
    return {
      projectId: row.project.id,
      reference: row.project.reference,
      leadDomainId: row.leadDomainId,
      domainName: row.domainName,
      professionalName: row.professionalName,
      professionalId: row.project.professionalId,
      status: row.project.status,
      completionPercent: row.project.completionPercent,
      approvedStages: approved.length,
      totalStages: mine.length,
      awaitingReview: mine.filter((m) => m.verification === "submitted").length,
      // The next thing that has to happen, which is what ops are asked about.
      currentStage: mine.find((m) => m.verification !== "approved")?.title ?? null,
      milestones: mine as unknown as LeadProjectView["milestones"],
    };
  });
}

/* ------------------------------------------------------------------ *
 * Dashboards — aggregates in SQL, not by loading every row
 * ------------------------------------------------------------------ */

export async function getSalesDashboard(agentId: string | null): Promise<SalesDashboard> {
  const today = new Date().toISOString().slice(0, 10);

  // A null agent means "everything" — an admin covering the team has no queue
  // of their own, and an empty screen would be the wrong answer.
  const mine = agentId
    ? eq(t.leads.assignedSalesAgentId, agentId)
    : sql`${t.leads.deletedAt} IS NULL`;

  const [agent, counts, urgency, byDomain] = await Promise.all([
    agentId
      ? db
          .select({ target: t.salesAgents.dailyTarget, name: t.users.name })
          .from(t.salesAgents)
          .innerJoin(t.users, eq(t.users.id, t.salesAgents.userId))
          .where(eq(t.salesAgents.id, agentId))
          .limit(1)
      : [],
    db.execute<{
      new_leads: number;
      needs_assignment: number;
      awaiting_reply: number;
      follow_ups_due: number;
      visits_today: number;
    }>(sql`
      SELECT
        count(*) FILTER (WHERE l.overall_status = 'new')::int AS new_leads,
        count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM ${t.leadDomains} ld
          WHERE ld.lead_id = l.id AND ld.status = 'pending_assignment'
        ))::int AS needs_assignment,
        count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM ${t.leadDomains} ld
          JOIN ${t.messages} m ON m.lead_domain_id = ld.id
          WHERE ld.lead_id = l.id
            AND m.channel = 'client_platform' AND m.sender_role = 'client'
            AND m.created_at > COALESCE((
              SELECT max(r.created_at) FROM ${t.messages} r
              WHERE r.lead_domain_id = ld.id AND r.channel = 'client_platform'
                AND r.sender_role = 'platform'
            ), '-infinity'::timestamptz)
        ))::int AS awaiting_reply,
        count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM ${t.leadSalesActivities} a
          WHERE a.lead_id = l.id AND a.follow_up_date <= ${today}::date
        ))::int AS follow_ups_due,
        0::int AS visits_today
      FROM ${t.leads} l
      WHERE l.deleted_at IS NULL
        AND (${agentId}::uuid IS NULL OR l.assigned_sales_agent_id = ${agentId}::uuid)
    `),
    db
      .select({ urgency: t.leads.urgency, value: count() })
      .from(t.leads)
      .where(and(mine, isNull(t.leads.deletedAt)))
      .groupBy(t.leads.urgency),
    db
      .select({ domain: t.domains, value: count() })
      .from(t.leadDomains)
      .innerJoin(t.domains, eq(t.domains.id, t.leadDomains.domainId))
      .innerJoin(t.leads, eq(t.leads.id, t.leadDomains.leadId))
      .where(and(mine, isNull(t.leads.deletedAt)))
      .groupBy(t.domains.id),
  ]);

  const [visits] = await db
    .select({ value: count() })
    .from(t.meetings)
    .innerJoin(t.leadDomains, eq(t.leadDomains.id, t.meetings.leadDomainId))
    .innerJoin(t.leads, eq(t.leads.id, t.leadDomains.leadId))
    .where(and(mine, sql`${t.meetings.scheduledAt}::date = ${today}::date`));

  const c = (counts as unknown as Array<Record<string, number>>)[0] ?? {};

  return {
    agentName: agent[0]?.name ?? "All agents",
    target: agent[0]?.target ?? 0,
    newLeads: Number(c.new_leads ?? 0),
    needsAssignment: Number(c.needs_assignment ?? 0),
    awaitingReply: Number(c.awaiting_reply ?? 0),
    followUpsDue: Number(c.follow_ups_due ?? 0),
    visitsToday: visits?.value ?? 0,
    byUrgency: urgency.map((u) => ({ urgency: u.urgency, count: u.value })),
    byDomain: byDomain.map((d) => ({ domain: toDomain(d.domain), count: d.value })),
  };
}

/**
 * The day screen.
 *
 * Deliberately excludes finished work: a closed lead is not a thing to do, and
 * a day screen that lists them buries the handful that need action today. The
 * buckets are capped rather than unbounded — an agent with four hundred stalled
 * leads needs the first twenty and a number, not four hundred rows.
 */
export async function getMyDay(agentId: string | null): Promise<MyDayView> {
  const today = new Date().toISOString().slice(0, 10);
  const BUCKET = 25;

  const dashboard = await getSalesDashboard(agentId);

  const live = await listLeads({
    ...(agentId ? { agentId } : {}),
    limit: 200,
    status: "all",
  });

  const open = live.items.filter((r) =>
    ["new", "verified", "in_progress"].includes(r.lead.lead.overallStatus),
  );

  const [visitCounts, invoices] = await Promise.all([
    db.execute<{ today: number; needing_outcome: number }>(sql`
      SELECT
        count(*) FILTER (WHERE m.scheduled_at::date = ${today}::date)::int AS today,
        count(*) FILTER (
          WHERE m.scheduled_at::date < ${today}::date
            AND m.outcome IS NULL AND m.status <> 'no_show'
        )::int AS needing_outcome
      FROM ${t.meetings} m
    `),
    db
      .select({
        invoice: t.commissionInvoices,
        professionalName: t.professionals.companyName,
      })
      .from(t.commissionInvoices)
      .innerJoin(t.professionals, eq(t.professionals.id, t.commissionInvoices.professionalId))
      .where(inArray(t.commissionInvoices.status, ["pending", "overdue"]))
      .orderBy(asc(t.commissionInvoices.dueDate)),
  ]);

  const domainsByAgreement = invoices.length
    ? await db
        .select({ agreementId: t.agreementLeadDomains.agreementId, name: t.domains.name })
        .from(t.agreementLeadDomains)
        .innerJoin(t.leadDomains, eq(t.leadDomains.id, t.agreementLeadDomains.leadDomainId))
        .innerJoin(t.domains, eq(t.domains.id, t.leadDomains.domainId))
        .where(
          inArray(
            t.agreementLeadDomains.agreementId,
            invoices.map((i) => i.invoice.agreementId),
          ),
        )
    : [];

  const soon = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const sumBy = (status: string) =>
    invoices.filter((i) => i.invoice.status === status).reduce((s, i) => s + i.invoice.amount, 0);

  const v = (visitCounts as unknown as Array<Record<string, number>>)[0] ?? {};

  return {
    agentName: dashboard.agentName,
    target: dashboard.target,
    live: open.slice(0, BUCKET),
    awaitingReply: open.filter((r) => r.awaitingReply > 0).slice(0, BUCKET),
    needsAssignment: open.filter((r) => r.unassignedDomains > 0).slice(0, BUCKET),
    followUpsDue: open.filter((r) => r.followUpDate && r.followUpDate <= today).slice(0, BUCKET),
    neverCalled: open.filter((r) => !r.lastActivity).slice(0, BUCKET),
    // Two weeks with nothing finished is a lead going quietly cold.
    stalled: open.filter((r) => r.ageDays >= 14).slice(0, BUCKET),
    visitsToday: Number(v.today ?? 0),
    visitsNeedingOutcome: Number(v.needing_outcome ?? 0),
    commission: {
      pending: sumBy("pending"),
      overdue: sumBy("overdue"),
      overdueCount: invoices.filter((i) => i.invoice.status === "overdue").length,
      dueSoonCount: invoices.filter(
        (i) => i.invoice.status === "pending" && i.invoice.dueDate <= soon,
      ).length,
      rows: invoices.slice(0, 30).map(
        (i): CommissionFocusRow => ({
          invoiceId: i.invoice.id,
          reference: i.invoice.reference,
          professionalId: i.invoice.professionalId,
          professionalName: i.professionalName,
          amount: i.invoice.amount,
          dueDate: i.invoice.dueDate,
          status: i.invoice.status,
          daysOverdue: Math.max(
            0,
            Math.floor((Date.now() - new Date(i.invoice.dueDate).getTime()) / 86_400_000),
          ),
          domains: domainsByAgreement
            .filter((d) => d.agreementId === i.invoice.agreementId)
            .map((d) => d.name),
        }),
      ),
    },
  };
}

export async function listSalesAgents() {
  const rows = await db
    .select({ agent: t.salesAgents, name: t.users.name })
    .from(t.salesAgents)
    .innerJoin(t.users, eq(t.users.id, t.salesAgents.userId))
    .orderBy(asc(t.users.name));

  return rows.map((r) => ({ ...r.agent, name: r.name }));
}
