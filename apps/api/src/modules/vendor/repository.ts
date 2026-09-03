/**
 * What a vendor sees.
 *
 * Every query is scoped by the professional id from the session, and every
 * customer that appears comes back masked. Read `./views.ts` first — it holds
 * the rule this whole module exists to keep.
 */
import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import type {
  Meeting,
  Message,
  Quote,
  VendorAgreementView,
  VendorDashboard,
  VendorInvoiceView,
  VendorLeadCard,
  VendorPerformance,
  VendorProjectView,
  VendorVisitView,
} from "@repo/types";
import { db } from "../../db/client";
import * as t from "../../db/schema";
import { NotFoundError } from "../../lib/errors";
import { fromX10, toDomain } from "../../lib/mappers";
import { maskedClientsById, maskedClientsFor } from "./views";

export type LeadFilter = "all" | "new" | "quoting" | "won" | "lost";

/* ------------------------------------------------------------------ *
 * Leads
 * ------------------------------------------------------------------ */

export async function listLeads(
  professionalId: string,
  filter: LeadFilter = "all",
): Promise<VendorLeadCard[]> {
  const rows = await db
    .select({
      assignment: t.leadDomainAssignments,
      leadDomain: t.leadDomains,
      domain: t.domains,
      lead: t.leads,
    })
    .from(t.leadDomainAssignments)
    .innerJoin(t.leadDomains, eq(t.leadDomains.id, t.leadDomainAssignments.leadDomainId))
    .innerJoin(t.domains, eq(t.domains.id, t.leadDomains.domainId))
    .innerJoin(t.leads, eq(t.leads.id, t.leadDomains.leadId))
    .where(
      and(
        eq(t.leadDomainAssignments.professionalId, professionalId),
        isNull(t.leadDomainAssignments.deletedAt),
      ),
    )
    .orderBy(desc(t.leadDomainAssignments.assignedAt));

  if (rows.length === 0) return [];

  const leadDomainIds = rows.map((r) => r.leadDomain.id);
  const leadIds = [...new Set(rows.map((r) => r.lead.id))];

  const [clients, quoteRows, meetingRows, itemRows, unreadRows, briefRows] = await Promise.all([
    maskedClientsFor(leadDomainIds),
    db
      .select()
      .from(t.quotes)
      .where(and(inArray(t.quotes.leadDomainId, leadDomainIds), isNull(t.quotes.deletedAt))),
    db
      .select()
      .from(t.meetings)
      .where(
        and(
          inArray(t.meetings.leadDomainId, leadDomainIds),
          eq(t.meetings.professionalId, professionalId),
        ),
      )
      .orderBy(asc(t.meetings.scheduledAt)),
    db
      .select()
      .from(t.leadDomainItems)
      .where(inArray(t.leadDomainItems.leadDomainId, leadDomainIds)),
    db
      .select({ leadDomainId: t.messages.leadDomainId, id: t.messages.id })
      .from(t.messages)
      .where(
        and(
          inArray(t.messages.leadDomainId, leadDomainIds),
          eq(t.messages.channel, "platform_vendor"),
          eq(t.messages.professionalId, professionalId),
          eq(t.messages.senderRole, "platform"),
          isNull(t.messages.readAt),
        ),
      ),
    /**
     * The brief is the last call where somebody actually *spoke* to the
     * customer. A "not reachable" note is an activity log, not scope, and
     * handing it to a vendor as the thing to quote against is how a job gets
     * priced against nothing.
     */
    db
      .select({ leadId: t.leadSalesActivities.leadId, remarks: t.leadSalesActivities.remarks })
      .from(t.leadSalesActivities)
      .where(
        and(
          inArray(t.leadSalesActivities.leadId, leadIds),
          eq(t.leadSalesActivities.callStatus, "connected"),
        ),
      )
      .orderBy(desc(t.leadSalesActivities.createdAt)),
  ]);

  const unreadByDomain = new Map<string, number>();
  for (const row of unreadRows) {
    unreadByDomain.set(row.leadDomainId, (unreadByDomain.get(row.leadDomainId) ?? 0) + 1);
  }

  const briefByLead = new Map<string, string>();
  for (const row of briefRows) {
    if (!briefByLead.has(row.leadId)) briefByLead.set(row.leadId, row.remarks);
  }

  const cards = rows.map(({ assignment, leadDomain, domain, lead }): VendorLeadCard => {
    const mine = quoteRows.find(
      (q) => q.leadDomainId === leadDomain.id && q.professionalId === professionalId,
    );

    return {
      assignment: assignment as unknown as VendorLeadCard["assignment"],
      leadDomain: leadDomain as unknown as VendorLeadCard["leadDomain"],
      domain: toDomain(domain),
      leadReference: lead.reference,
      client: clients.get(leadDomain.id)!,
      description: lead.description,
      urgency: lead.urgency,
      materialSource: leadDomain.materialSource,
      items: itemRows.filter(
        (i) => i.leadDomainId === leadDomain.id,
      ) as unknown as VendorLeadCard["items"],
      brief: briefByLead.get(lead.id) ?? null,
      siteNotes: lead.siteAccessibilityTags,
      budgetMax: lead.budgetMax,
      myQuote: (mine ?? null) as Quote | null,
      visits: meetingRows.filter(
        (m) => m.leadDomainId === leadDomain.id,
      ) as unknown as Meeting[],
      unreadMessages: unreadByDomain.get(leadDomain.id) ?? 0,
      // Others quoting the same service. Named plainly, because a vendor
      // deciding how hard to sharpen a price deserves to know.
      competingQuotes: quoteRows.filter(
        (q) => q.leadDomainId === leadDomain.id && q.professionalId !== professionalId,
      ).length,
      won: leadDomain.selectedProfessionalId === professionalId,
      lost:
        leadDomain.selectedProfessionalId !== null &&
        leadDomain.selectedProfessionalId !== professionalId,
    };
  });

  return cards.filter((card) => {
    switch (filter) {
      case "new":
        return card.assignment.responseStatus === "pending" || !card.myQuote;
      case "quoting":
        return Boolean(card.myQuote) && card.leadDomain.selectedProfessionalId === null;
      case "won":
        return card.won;
      case "lost":
        return card.lost;
      default:
        return true;
    }
  });
}

export async function getLead(
  professionalId: string,
  leadDomainId: string,
): Promise<VendorLeadCard> {
  const all = await listLeads(professionalId);
  const card = all.find((c) => c.leadDomain.id === leadDomainId);
  // 404 rather than 403 for a service this vendor was never offered: a 403
  // would confirm the lead exists.
  if (!card) throw new NotFoundError("That lead");
  return card;
}

/**
 * This vendor's thread with our team for one service.
 *
 * Scoped three ways — the service, the channel, and this professional — so
 * there is no shape of query here that returns another vendor's conversation
 * or the customer's.
 */
export async function listThread(
  professionalId: string,
  leadDomainId: string,
): Promise<Message[]> {
  const [assigned] = await db
    .select({ id: t.leadDomainAssignments.id })
    .from(t.leadDomainAssignments)
    .where(
      and(
        eq(t.leadDomainAssignments.leadDomainId, leadDomainId),
        eq(t.leadDomainAssignments.professionalId, professionalId),
      ),
    )
    .limit(1);

  if (!assigned) throw new NotFoundError("That lead");

  const rows = await db
    .select()
    .from(t.messages)
    .where(
      and(
        eq(t.messages.leadDomainId, leadDomainId),
        eq(t.messages.channel, "platform_vendor"),
        eq(t.messages.professionalId, professionalId),
        isNull(t.messages.deletedAt),
      ),
    )
    .orderBy(asc(t.messages.createdAt));

  return rows as unknown as Message[];
}

/* ------------------------------------------------------------------ *
 * Dashboard
 * ------------------------------------------------------------------ */

export async function getDashboard(professionalId: string): Promise<VendorDashboard> {
  const [profile] = await db
    .select({ professional: t.professionals, user: t.users })
    .from(t.professionals)
    .innerJoin(t.users, eq(t.users.id, t.professionals.userId))
    .where(eq(t.professionals.id, professionalId))
    .limit(1);

  if (!profile) throw new NotFoundError("That account");

  const today = new Date().toISOString().slice(0, 10);

  const [cards, domainRows, invoices, visitsToday] = await Promise.all([
    listLeads(professionalId),
    db
      .select({ link: t.professionalDomains, domain: t.domains })
      .from(t.professionalDomains)
      .innerJoin(t.domains, eq(t.domains.id, t.professionalDomains.domainId))
      .where(eq(t.professionalDomains.professionalId, professionalId)),
    db
      .select()
      .from(t.commissionInvoices)
      .where(eq(t.commissionInvoices.professionalId, professionalId)),
    db
      .select({ id: t.meetings.id })
      .from(t.meetings)
      .where(
        and(
          eq(t.meetings.professionalId, professionalId),
          sql`${t.meetings.scheduledAt}::date = ${today}::date`,
        ),
      ),
  ]);

  const liveProjects = await db
    .select({ id: t.projects.id })
    .from(t.projects)
    .where(and(eq(t.projects.professionalId, professionalId), eq(t.projects.status, "ongoing")));

  const sumWhere = (statuses: string[]) =>
    invoices
      .filter((i) => statuses.includes(i.status))
      .reduce((total, i) => total + i.amount, 0);

  return {
    professional: {
      ...profile.professional,
      avgRating: fromX10(profile.professional.avgRatingX10),
    } as unknown as VendorDashboard["professional"],
    displayName: profile.user.name,
    domains: domainRows.map((r) => ({
      link: {
        ...r.link,
        avgRating: fromX10(r.link.avgRatingX10),
      } as unknown as VendorDashboard["domains"][number]["link"],
      domain: toDomain(r.domain),
    })),
    newLeads: cards.filter((c) => c.assignment.responseStatus === "pending").length,
    awaitingQuote: cards.filter((c) => c.assignment.responseStatus === "accepted" && !c.myQuote)
      .length,
    quotesOut: cards.filter((c) => c.myQuote && c.leadDomain.selectedProfessionalId === null)
      .length,
    wonThisPeriod: cards.filter((c) => c.won).length,
    liveProjects: liveProjects.length,
    visitsToday: visitsToday.length,
    commissionDue: sumWhere(["pending"]),
    commissionOverdue: sumWhere(["overdue"]),
    unreadMessages: cards.reduce((total, c) => total + c.unreadMessages, 0),
  };
}

/* ------------------------------------------------------------------ *
 * Agreements, projects, invoices
 * ------------------------------------------------------------------ */

export async function listAgreements(professionalId: string): Promise<VendorAgreementView[]> {
  const rows = await db
    .select()
    .from(t.agreements)
    .where(and(eq(t.agreements.professionalId, professionalId), isNull(t.agreements.deletedAt)))
    .orderBy(desc(t.agreements.createdAt));

  if (rows.length === 0) return [];

  const agreementIds = rows.map((a) => a.id);

  const [lineRows, projectRows, invoiceRows, clients] = await Promise.all([
    db
      .select({ link: t.agreementLeadDomains, domain: t.domains, quote: t.quotes })
      .from(t.agreementLeadDomains)
      .innerJoin(t.leadDomains, eq(t.leadDomains.id, t.agreementLeadDomains.leadDomainId))
      .innerJoin(t.domains, eq(t.domains.id, t.leadDomains.domainId))
      .innerJoin(t.quotes, eq(t.quotes.id, t.agreementLeadDomains.quoteId))
      .where(inArray(t.agreementLeadDomains.agreementId, agreementIds)),
    db
      .select({ project: t.projects, domain: t.domains })
      .from(t.projects)
      .innerJoin(t.leadDomains, eq(t.leadDomains.id, t.projects.leadDomainId))
      .innerJoin(t.domains, eq(t.domains.id, t.leadDomains.domainId))
      .where(inArray(t.projects.agreementId, agreementIds)),
    db
      .select()
      .from(t.commissionInvoices)
      .where(inArray(t.commissionInvoices.agreementId, agreementIds)),
    // No lead-domain in context: the address stays sealed on this screen.
    maskedClientsById(rows.map((a) => a.clientId)),
  ]);

  return rows.map((agreement) => {
    const lines = lineRows.filter((l) => l.link.agreementId === agreement.id);
    return {
      agreement: agreement as unknown as VendorAgreementView["agreement"],
      client: clients.get(agreement.clientId)!,
      lines: lines.map((l) => ({
        link: l.link as unknown as VendorAgreementView["lines"][number]["link"],
        domain: toDomain(l.domain),
        quote: l.quote as unknown as Quote,
      })),
      isCombined: lines.length > 1,
      projects: projectRows
        .filter((p) => p.project.agreementId === agreement.id)
        .map((p) => ({
          project: p.project as unknown as VendorAgreementView["projects"][number]["project"],
          domain: toDomain(p.domain),
        })),
      invoice:
        (invoiceRows.find(
          (i) => i.agreementId === agreement.id,
        ) as unknown as VendorAgreementView["invoice"]) ?? null,
    };
  });
}

export async function listProjects(professionalId: string): Promise<VendorProjectView[]> {
  const rows = await db
    .select({
      project: t.projects,
      domain: t.domains,
      leadDomainId: t.leadDomains.id,
      cityName: t.cities.name,
    })
    .from(t.projects)
    .innerJoin(t.leadDomains, eq(t.leadDomains.id, t.projects.leadDomainId))
    .innerJoin(t.domains, eq(t.domains.id, t.leadDomains.domainId))
    .innerJoin(t.leads, eq(t.leads.id, t.leadDomains.leadId))
    .innerJoin(t.cities, eq(t.cities.id, t.leads.cityId))
    .where(and(eq(t.projects.professionalId, professionalId), isNull(t.projects.deletedAt)))
    .orderBy(desc(t.projects.createdAt));

  if (rows.length === 0) return [];

  const [milestoneRows, reviewRows, clients] = await Promise.all([
    db
      .select()
      .from(t.projectMilestones)
      .where(
        inArray(
          t.projectMilestones.projectId,
          rows.map((r) => r.project.id),
        ),
      )
      .orderBy(asc(t.projectMilestones.sortOrder)),
    db
      .select()
      .from(t.reviews)
      .where(
        inArray(
          t.reviews.projectId,
          rows.map((r) => r.project.id),
        ),
      ),
    maskedClientsFor(rows.map((r) => r.leadDomainId)),
  ]);

  const proof = await proofByMilestone(milestoneRows.map((m) => m.id));

  return rows.map((row) => ({
    project: {
      ...row.project,
      milestones: milestoneRows
        .filter((m) => m.projectId === row.project.id)
        .map((m) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          completedAt: m.completedAt,
          proof: proof.get(m.id) ?? [],
          proofNote: m.proofNote,
          submittedAt: m.submittedAt,
          verification: m.verification,
          verifiedAt: m.verifiedAt,
          verifiedByUserId: m.verifiedByUserId,
          verifierNote: m.verifierNote,
        })),
    } as unknown as VendorProjectView["project"],
    domain: toDomain(row.domain),
    client: clients.get(row.leadDomainId)!,
    cityName: row.cityName,
    review:
      (reviewRows.find(
        (r) => r.projectId === row.project.id,
      ) as unknown as VendorProjectView["review"]) ?? null,
  }));
}

async function proofByMilestone(milestoneIds: string[]) {
  const { groupMediaByOwner } = await import("../../lib/media");
  if (milestoneIds.length === 0) return new Map<string, never[]>() as never;

  const rows = await db
    .select({
      id: t.mediaAssets.id,
      type: t.mediaAssets.type,
      storageKey: t.mediaAssets.storageKey,
      caption: t.mediaAssets.caption,
      ownerType: t.mediaAssets.ownerType,
      ownerId: t.mediaAssets.ownerId,
      sortOrder: t.mediaAssets.sortOrder,
    })
    .from(t.mediaAssets)
    .where(
      and(
        eq(t.mediaAssets.ownerType, "project_milestone"),
        inArray(t.mediaAssets.ownerId, milestoneIds),
        isNull(t.mediaAssets.deletedAt),
      ),
    )
    .orderBy(asc(t.mediaAssets.sortOrder));

  return groupMediaByOwner(rows);
}

export async function listInvoices(professionalId: string): Promise<VendorInvoiceView[]> {
  const rows = await db
    .select({ invoice: t.commissionInvoices, agreementReference: t.agreements.reference })
    .from(t.commissionInvoices)
    .innerJoin(t.agreements, eq(t.agreements.id, t.commissionInvoices.agreementId))
    .where(eq(t.commissionInvoices.professionalId, professionalId))
    .orderBy(asc(t.commissionInvoices.dueDate));

  if (rows.length === 0) return [];

  const domainRows = await db
    .select({ agreementId: t.agreementLeadDomains.agreementId, name: t.domains.name })
    .from(t.agreementLeadDomains)
    .innerJoin(t.leadDomains, eq(t.leadDomains.id, t.agreementLeadDomains.leadDomainId))
    .innerJoin(t.domains, eq(t.domains.id, t.leadDomains.domainId))
    .where(
      inArray(
        t.agreementLeadDomains.agreementId,
        rows.map((r) => r.invoice.agreementId),
      ),
    );

  return rows.map((row) => ({
    invoice: row.invoice as unknown as VendorInvoiceView["invoice"],
    agreementReference: row.agreementReference,
    domains: domainRows
      .filter((d) => d.agreementId === row.invoice.agreementId)
      .map((d) => d.name),
  }));
}

export async function listVisits(professionalId: string): Promise<VendorVisitView[]> {
  const rows = await db
    .select({
      meeting: t.meetings,
      domain: t.domains,
      leadDomainId: t.leadDomains.id,
      leadReference: t.leads.reference,
    })
    .from(t.meetings)
    .innerJoin(t.leadDomains, eq(t.leadDomains.id, t.meetings.leadDomainId))
    .innerJoin(t.domains, eq(t.domains.id, t.leadDomains.domainId))
    .innerJoin(t.leads, eq(t.leads.id, t.leadDomains.leadId))
    .where(eq(t.meetings.professionalId, professionalId))
    .orderBy(asc(t.meetings.scheduledAt));

  if (rows.length === 0) return [];

  const clients = await maskedClientsFor(rows.map((r) => r.leadDomainId));

  return rows.map((row) => ({
    meeting: row.meeting as unknown as Meeting,
    domain: toDomain(row.domain),
    client: clients.get(row.leadDomainId)!,
    leadReference: row.leadReference,
  }));
}

/* ------------------------------------------------------------------ *
 * Performance
 * ------------------------------------------------------------------ */

export async function getPerformance(professionalId: string): Promise<VendorPerformance> {
  const [links, assignments, projects, reviewRows, professional] = await Promise.all([
    db
      .select({ link: t.professionalDomains, domain: t.domains })
      .from(t.professionalDomains)
      .innerJoin(t.domains, eq(t.domains.id, t.professionalDomains.domainId))
      .where(eq(t.professionalDomains.professionalId, professionalId)),
    db
      .select({ leadDomain: t.leadDomains })
      .from(t.leadDomainAssignments)
      .innerJoin(t.leadDomains, eq(t.leadDomains.id, t.leadDomainAssignments.leadDomainId))
      .where(eq(t.leadDomainAssignments.professionalId, professionalId)),
    db
      .select({ project: t.projects, domainId: t.leadDomains.domainId })
      .from(t.projects)
      .innerJoin(t.leadDomains, eq(t.leadDomains.id, t.projects.leadDomainId))
      .where(eq(t.projects.professionalId, professionalId)),
    db
      .select({ review: t.reviews, domain: t.domains, reviewerName: t.users.name })
      .from(t.reviews)
      .innerJoin(t.domains, eq(t.domains.id, t.reviews.domainId))
      .innerJoin(t.clients, eq(t.clients.id, t.reviews.clientId))
      .innerJoin(t.users, eq(t.users.id, t.clients.userId))
      .where(eq(t.reviews.professionalId, professionalId))
      .orderBy(desc(t.reviews.createdAt)),
    db
      .select({ avgResponseHours: t.professionals.avgResponseHours })
      .from(t.professionals)
      .where(eq(t.professionals.id, professionalId))
      .limit(1),
  ]);

  const domainDefaults = new Map(links.map((l) => [l.domain.id, l.domain.defaultCommissionPercent]));

  return {
    byDomain: links.map(({ link, domain }) => {
      const mine = assignments.filter((a) => a.leadDomain.domainId === domain.id);
      const won = mine.filter((a) => a.leadDomain.selectedProfessionalId === professionalId).length;
      const lost = mine.filter(
        (a) =>
          a.leadDomain.selectedProfessionalId !== null &&
          a.leadDomain.selectedProfessionalId !== professionalId,
      ).length;
      const decided = won + lost;

      return {
        domain: toDomain(domain),
        rating: fromX10(link.avgRatingX10),
        ratingCount: link.ratingCount,
        completed: projects.filter(
          (p) => p.domainId === domain.id && p.project.status === "completed",
        ).length,
        won,
        lost,
        // Out of decided leads only. Counting the undecided ones as losses
        // would make a vendor look worse the busier the platform gets.
        winRatePercent: decided === 0 ? 0 : Math.round((won / decided) * 100),
        commissionPercent:
          link.commissionPercentOverride ?? domainDefaults.get(domain.id) ?? 0,
      };
    }),
    avgResponseHours: professional[0]?.avgResponseHours ?? 0,
    totalRevenue: projects.reduce((sum, p) => sum + p.project.value, 0),
    reviews: reviewRows.map((r) => ({
      review: r.review as unknown as VendorPerformance["reviews"][number]["review"],
      domain: toDomain(r.domain),
      // First name only. A vendor does not need a customer's full name against
      // a public opinion of their work.
      clientName: r.reviewerName.split(" ")[0] ?? "Customer",
    })),
  };
}

export async function listPortfolio(professionalId: string) {
  const rows = await db
    .select()
    .from(t.portfolioItems)
    .where(
      and(eq(t.portfolioItems.professionalId, professionalId), isNull(t.portfolioItems.deletedAt)),
    )
    .orderBy(desc(t.portfolioItems.createdAt));

  const { groupMediaByOwner } = await import("../../lib/media");
  if (rows.length === 0) return [];

  const media = await db
    .select({
      id: t.mediaAssets.id,
      type: t.mediaAssets.type,
      storageKey: t.mediaAssets.storageKey,
      caption: t.mediaAssets.caption,
      ownerType: t.mediaAssets.ownerType,
      ownerId: t.mediaAssets.ownerId,
      sortOrder: t.mediaAssets.sortOrder,
    })
    .from(t.mediaAssets)
    .where(
      and(
        eq(t.mediaAssets.ownerType, "portfolio_item"),
        inArray(
          t.mediaAssets.ownerId,
          rows.map((r) => r.id),
        ),
      ),
    )
    .orderBy(asc(t.mediaAssets.sortOrder));

  const byItem = groupMediaByOwner(media);
  return rows.map((row) => ({ ...row, media: byItem.get(row.id) ?? [] }));
}
