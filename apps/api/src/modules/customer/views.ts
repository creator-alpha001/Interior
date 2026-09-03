/**
 * Assembling the deep view models the customer screens render.
 *
 * `LeadView` is the largest shape in the system — a requirement, its services,
 * and for each service the vendors assigned, their quotes, the visits booked
 * and the catalogue items it started from. The screens never assemble that
 * themselves, which is what let the frontend be built before this existed.
 *
 * Everything here loads by the *set* of ids in play rather than one row at a
 * time. A customer with three requirements across six services would otherwise
 * be forty queries; it is eight.
 */
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type {
  AgreementView,
  MediaAsset,
  ClientSummary,
  LeadDomainView,
  LeadView,
  ProfessionalSummary,
  ProjectView,
  QuoteView,
} from "@repo/types";
import { db } from "../../db/client";
import * as t from "../../db/schema";
import { groupMediaByOwner } from "../../lib/media";
import { toCity, toDomain, toProfessionalSummary } from "../../lib/mappers";

/* ------------------------------------------------------------------ *
 * Shared lookups
 * ------------------------------------------------------------------ */

/**
 * Vendor cards for a set of professionals, keyed by id.
 *
 * `domainId` is passed where the vendor is being shown in the context of one
 * trade, so the rating on the card is the one for that trade.
 */
async function professionalSummaries(
  professionalIds: string[],
): Promise<Map<string, ProfessionalSummary>> {
  const unique = [...new Set(professionalIds)].filter(Boolean);
  if (unique.length === 0) return new Map();

  const [rows, domainRows] = await Promise.all([
    db
      .select({ professional: t.professionals, user: t.users, city: t.cities })
      .from(t.professionals)
      .innerJoin(t.users, eq(t.users.id, t.professionals.userId))
      .innerJoin(t.cities, eq(t.cities.id, t.users.cityId))
      .where(inArray(t.professionals.id, unique)),
    db
      .select({ link: t.professionalDomains, domain: t.domains })
      .from(t.professionalDomains)
      .innerJoin(t.domains, eq(t.domains.id, t.professionalDomains.domainId))
      .where(
        and(
          inArray(t.professionalDomains.professionalId, unique),
          eq(t.professionalDomains.verificationStatus, "approved"),
        ),
      ),
  ]);

  const domainsByPro = new Map<string, Array<typeof t.domains.$inferSelect>>();
  const linksByPro = new Map<string, Array<typeof t.professionalDomains.$inferSelect>>();

  for (const row of domainRows) {
    const id = row.link.professionalId;

    const domains = domainsByPro.get(id);
    if (domains) domains.push(row.domain);
    else domainsByPro.set(id, [row.domain]);

    const links = linksByPro.get(id);
    if (links) links.push(row.link);
    else linksByPro.set(id, [row.link]);
  }

  const byId = new Map<string, ProfessionalSummary>();
  for (const row of rows) {
    byId.set(
      row.professional.id,
      toProfessionalSummary({
        professional: row.professional,
        user: row.user,
        city: row.city,
        domains: domainsByPro.get(row.professional.id) ?? [],
      }),
    );
  }
  return byId;
}

/** Narrows a vendor card to one trade, so the rating shown is that trade's. */
function inDomain(
  summary: ProfessionalSummary | undefined,
  domainId: string,
  links: Map<string, Array<typeof t.professionalDomains.$inferSelect>>,
): ProfessionalSummary | null {
  if (!summary) return null;
  const link = links.get(summary.id)?.find((l) => l.domainId === domainId);
  if (!link) return summary;
  return {
    ...summary,
    domainRating: {
      domainId,
      avgRating: Math.round(link.avgRatingX10) / 10,
      ratingCount: link.ratingCount,
    },
  };
}

async function professionalDomainLinks(professionalIds: string[]) {
  const unique = [...new Set(professionalIds)].filter(Boolean);
  const byPro = new Map<string, Array<typeof t.professionalDomains.$inferSelect>>();
  if (unique.length === 0) return byPro;

  const rows = await db
    .select()
    .from(t.professionalDomains)
    .where(inArray(t.professionalDomains.professionalId, unique));

  for (const row of rows) {
    const list = byPro.get(row.professionalId);
    if (list) list.push(row);
    else byPro.set(row.professionalId, [row]);
  }
  return byPro;
}

export async function clientSummary(clientId: string): Promise<ClientSummary> {
  const [row] = await db
    .select({ client: t.clients, user: t.users, city: t.cities })
    .from(t.clients)
    .innerJoin(t.users, eq(t.users.id, t.clients.userId))
    .innerJoin(t.cities, eq(t.cities.id, t.users.cityId))
    .where(eq(t.clients.id, clientId))
    .limit(1);

  if (!row) throw new Error(`No client ${clientId}`);

  return {
    id: row.client.id,
    userId: row.user.id,
    name: row.user.name,
    mobile: row.user.mobile,
    email: row.user.email,
    city: toCity(row.city),
    address: row.client.address,
  };
}

/* ------------------------------------------------------------------ *
 * Leads
 * ------------------------------------------------------------------ */

/**
 * Builds `LeadView` for a set of leads.
 *
 * Written to take many leads rather than one because the account overview
 * renders every requirement a customer has, and doing this per lead is where a
 * dashboard quietly becomes a hundred queries.
 */
export async function buildLeadViews(leadIds: string[]): Promise<LeadView[]> {
  if (leadIds.length === 0) return [];

  const leadRows = await db
    .select({ lead: t.leads, city: t.cities })
    .from(t.leads)
    .innerJoin(t.cities, eq(t.cities.id, t.leads.cityId))
    .where(inArray(t.leads.id, leadIds))
    .orderBy(asc(t.leads.createdAt));

  if (leadRows.length === 0) return [];

  const domainRows = await db
    .select({ leadDomain: t.leadDomains, domain: t.domains })
    .from(t.leadDomains)
    .innerJoin(t.domains, eq(t.domains.id, t.leadDomains.domainId))
    .where(
      and(
        inArray(
          t.leadDomains.leadId,
          leadRows.map((r) => r.lead.id),
        ),
        isNull(t.leadDomains.deletedAt),
      ),
    );

  const leadDomainIds = domainRows.map((r) => r.leadDomain.id);

  const [assignmentRows, quoteRows, meetingRows, itemRows, unreadRows, clients] =
    await Promise.all([
      leadDomainIds.length
        ? db
            .select()
            .from(t.leadDomainAssignments)
            .where(inArray(t.leadDomainAssignments.leadDomainId, leadDomainIds))
        : [],
      leadDomainIds.length
        ? db
            .select()
            .from(t.quotes)
            .where(and(inArray(t.quotes.leadDomainId, leadDomainIds), isNull(t.quotes.deletedAt)))
            // Cheapest first: the compare table shows them in this order.
            .orderBy(asc(t.quotes.total))
        : [],
      leadDomainIds.length
        ? db
            .select()
            .from(t.meetings)
            .where(inArray(t.meetings.leadDomainId, leadDomainIds))
            .orderBy(asc(t.meetings.scheduledAt))
        : [],
      leadDomainIds.length
        ? db
            .select()
            .from(t.leadDomainItems)
            .where(inArray(t.leadDomainItems.leadDomainId, leadDomainIds))
        : [],
      leadDomainIds.length
        ? db
            .select({ leadDomainId: t.messages.leadDomainId, id: t.messages.id })
            .from(t.messages)
            .where(
              and(
                inArray(t.messages.leadDomainId, leadDomainIds),
                eq(t.messages.channel, "client_platform"),
                eq(t.messages.senderRole, "platform"),
                isNull(t.messages.readAt),
              ),
            )
        : [],
      clientSummariesFor(leadRows.map((r) => r.lead.clientId)),
    ]);

  const photosByLead = await mediaByOwner(
    "lead",
    leadRows.map((r) => r.lead.id),
  );

  const professionalIds = [
    ...assignmentRows.map((a) => a.professionalId),
    ...quoteRows.map((q) => q.professionalId),
    ...meetingRows.map((m) => m.professionalId),
    ...domainRows.map((d) => d.leadDomain.selectedProfessionalId).filter((x): x is string => !!x),
  ];

  const [summaries, links] = await Promise.all([
    professionalSummaries(professionalIds),
    professionalDomainLinks(professionalIds),
  ]);

  const unreadByDomain = new Map<string, number>();
  for (const row of unreadRows) {
    unreadByDomain.set(row.leadDomainId, (unreadByDomain.get(row.leadDomainId) ?? 0) + 1);
  }

  const viewsByLead = new Map<string, LeadDomainView[]>();

  for (const { leadDomain, domain } of domainRows) {
    const domainId = domain.id;

    const view: LeadDomainView = {
      leadDomain: {
        id: leadDomain.id,
        leadId: leadDomain.leadId,
        domainId: leadDomain.domainId,
        materialSource: leadDomain.materialSource,
        status: leadDomain.status,
        preferredProfessionalId: leadDomain.preferredProfessionalId,
        preferenceUnmetReason: leadDomain.preferenceUnmetReason,
        selectedProfessionalId: leadDomain.selectedProfessionalId,
        selectedQuoteId: leadDomain.selectedQuoteId,
        createdAt: leadDomain.createdAt,
        updatedAt: leadDomain.updatedAt,
        deletedAt: leadDomain.deletedAt,
      },
      domain: toDomain(domain),
      assignments: assignmentRows
        .filter((a) => a.leadDomainId === leadDomain.id)
        .map((assignment) => ({
          assignment: {
            id: assignment.id,
            leadDomainId: assignment.leadDomainId,
            professionalId: assignment.professionalId,
            responseStatus: assignment.responseStatus,
            assignedAt: assignment.assignedAt,
            respondedAt: assignment.respondedAt,
            rejectionReason: assignment.rejectionReason,
            createdAt: assignment.createdAt,
            updatedAt: assignment.updatedAt,
            deletedAt: assignment.deletedAt,
          },
          professional: inDomain(summaries.get(assignment.professionalId), domainId, links)!,
        }))
        .filter((a) => a.professional),
      quotes: quoteRows
        .filter((q) => q.leadDomainId === leadDomain.id)
        .map(
          (quote): QuoteView => ({
            quote: {
              id: quote.id,
              leadDomainId: quote.leadDomainId,
              professionalId: quote.professionalId,
              version: quote.version,
              supersedesQuoteId: quote.supersedesQuoteId,
              lineItems: quote.lineItems,
              subtotal: quote.subtotal,
              taxPercent: quote.taxPercent,
              taxAmount: quote.taxAmount,
              total: quote.total,
              timelineDays: quote.timelineDays,
              warrantyMonths: quote.warrantyMonths,
              warrantyDetails: quote.warrantyDetails,
              materialsSummary: quote.materialsSummary,
              boqUrl: quote.boqUrl,
              quotePdfUrl: quote.quotePdfUrl,
              status: quote.status,
              notes: quote.notes,
              createdAt: quote.createdAt,
              updatedAt: quote.updatedAt,
              deletedAt: quote.deletedAt,
            },
            professional: inDomain(summaries.get(quote.professionalId), domainId, links)!,
            domain: toDomain(domain),
          }),
        )
        .filter((q) => q.professional),
      meetings: meetingRows
        .filter((m) => m.leadDomainId === leadDomain.id)
        .map((meeting) => ({
          meeting: {
            id: meeting.id,
            leadDomainId: meeting.leadDomainId,
            professionalId: meeting.professionalId,
            type: meeting.type,
            scheduledAt: meeting.scheduledAt,
            location: meeting.location,
            status: meeting.status,
            notes: meeting.notes,
            coordinatorId: meeting.coordinatorId,
            addressReleasedAt: meeting.addressReleasedAt,
            rescheduleRequestedAt: meeting.rescheduleRequestedAt,
            rescheduleNote: meeting.rescheduleNote,
            outcome: meeting.outcome,
            outcomeRecordedAt: meeting.outcomeRecordedAt,
            outcomeChangedScope: meeting.outcomeChangedScope,
            createdAt: meeting.createdAt,
            updatedAt: meeting.updatedAt,
            deletedAt: meeting.deletedAt,
          },
          professional: inDomain(summaries.get(meeting.professionalId), domainId, links)!,
        }))
        .filter((m) => m.professional),
      items: itemRows
        .filter((i) => i.leadDomainId === leadDomain.id)
        .map((item) => ({
          id: item.id,
          leadDomainId: item.leadDomainId,
          productId: item.productId,
          packageId: item.packageId,
          itemName: item.itemName,
          quantity: item.quantity,
          selectedOptions: item.selectedOptions,
          indicativePrice: item.indicativePrice,
          customerNotes: item.customerNotes,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          deletedAt: item.deletedAt,
        })),
      selectedProfessional: leadDomain.selectedProfessionalId
        ? inDomain(summaries.get(leadDomain.selectedProfessionalId), domainId, links)
        : null,
      unreadMessages: unreadByDomain.get(leadDomain.id) ?? 0,
    };

    const list = viewsByLead.get(leadDomain.leadId);
    if (list) list.push(view);
    else viewsByLead.set(leadDomain.leadId, [view]);
  }

  return leadRows.map(({ lead, city }) => {
    const domains = viewsByLead.get(lead.id) ?? [];
    return {
      lead: {
        id: lead.id,
        reference: lead.reference,
        clientId: lead.clientId,
        cityId: lead.cityId,
        description: lead.description,
        urgency: lead.urgency,
        budgetMin: lead.budgetMin,
        budgetMax: lead.budgetMax,
        siteAccessibilityTags: lead.siteAccessibilityTags,
        photos: photosByLead.get(lead.id) ?? [],
        source: lead.source,
        overallStatus: lead.overallStatus,
        assignedSalesAgentId: lead.assignedSalesAgentId,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
        deletedAt: lead.deletedAt,
      },
      client: clients.get(lead.clientId)!,
      city: toCity(city),
      domains,
      domainNames: domains.map((d) => d.domain.name),
      isMultiDomain: domains.length > 1,
    };
  });
}

async function clientSummariesFor(clientIds: string[]): Promise<Map<string, ClientSummary>> {
  const unique = [...new Set(clientIds)];
  const byId = new Map<string, ClientSummary>();
  if (unique.length === 0) return byId;

  const rows = await db
    .select({ client: t.clients, user: t.users, city: t.cities })
    .from(t.clients)
    .innerJoin(t.users, eq(t.users.id, t.clients.userId))
    .innerJoin(t.cities, eq(t.cities.id, t.users.cityId))
    .where(inArray(t.clients.id, unique));

  for (const row of rows) {
    byId.set(row.client.id, {
      id: row.client.id,
      userId: row.user.id,
      name: row.user.name,
      mobile: row.user.mobile,
      email: row.user.email,
      city: toCity(row.city),
      address: row.client.address,
    });
  }
  return byId;
}

/* ------------------------------------------------------------------ *
 * Projects and agreements
 * ------------------------------------------------------------------ */

export async function buildProjectViews(projectIds: string[]): Promise<ProjectView[]> {
  if (projectIds.length === 0) return [];

  const rows = await db
    .select({ project: t.projects, domain: t.domains, leadDomain: t.leadDomains })
    .from(t.projects)
    .innerJoin(t.leadDomains, eq(t.leadDomains.id, t.projects.leadDomainId))
    .innerJoin(t.domains, eq(t.domains.id, t.leadDomains.domainId))
    .where(inArray(t.projects.id, projectIds));

  if (rows.length === 0) return [];

  const [milestoneRows, reviewRows, summaries, links, clients] = await Promise.all([
    db
      .select()
      .from(t.projectMilestones)
      .where(
        and(
          inArray(
            t.projectMilestones.projectId,
            rows.map((r) => r.project.id),
          ),
          isNull(t.projectMilestones.deletedAt),
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
    professionalSummaries(rows.map((r) => r.project.professionalId)),
    professionalDomainLinks(rows.map((r) => r.project.professionalId)),
    clientSummariesFor(rows.map((r) => r.project.clientId)),
  ]);

  const proofByMilestone = await mediaByOwner(
    "project_milestone",
    milestoneRows.map((m) => m.id),
  );

  return rows.map(({ project, domain }) => ({
    project: {
      id: project.id,
      reference: project.reference,
      leadDomainId: project.leadDomainId,
      agreementId: project.agreementId,
      clientId: project.clientId,
      professionalId: project.professionalId,
      quoteId: project.quoteId,
      value: project.value,
      commissionPercent: project.commissionPercent,
      commissionAmount: project.commissionAmount,
      startDate: project.startDate,
      estimatedEndDate: project.estimatedEndDate,
      actualEndDate: project.actualEndDate,
      completionPercent: project.completionPercent,
      status: project.status,
      milestones: milestoneRows
        .filter((m) => m.projectId === project.id)
        .map((m) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          completedAt: m.completedAt,
          proof: proofByMilestone.get(m.id) ?? [],
          proofNote: m.proofNote,
          submittedAt: m.submittedAt,
          verification: m.verification,
          verifiedAt: m.verifiedAt,
          verifiedByUserId: m.verifiedByUserId,
          verifierNote: m.verifierNote,
        })),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      deletedAt: project.deletedAt,
    },
    domain: toDomain(domain),
    professional: inDomain(summaries.get(project.professionalId), domain.id, links)!,
    client: clients.get(project.clientId)!,
    review: reviewRows
      .filter((r) => r.projectId === project.id)
      .map((r) => ({
        id: r.id,
        projectId: r.projectId,
        clientId: r.clientId,
        professionalId: r.professionalId,
        domainId: r.domainId,
        rating: r.rating as 1 | 2 | 3 | 4 | 5,
        comment: r.comment,
        qualityRating: r.qualityRating,
        timelinessRating: r.timelinessRating,
        professionalismRating: r.professionalismRating,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        deletedAt: r.deletedAt,
      }))[0] ?? null,
  }));
}

export async function buildAgreementViews(agreementIds: string[]): Promise<AgreementView[]> {
  if (agreementIds.length === 0) return [];

  const rows = await db
    .select()
    .from(t.agreements)
    .where(inArray(t.agreements.id, agreementIds));

  if (rows.length === 0) return [];

  const [linkRows, invoiceRows, projectRows, summaries, clients] = await Promise.all([
    db
      .select({ link: t.agreementLeadDomains, domain: t.domains, quote: t.quotes })
      .from(t.agreementLeadDomains)
      .innerJoin(t.leadDomains, eq(t.leadDomains.id, t.agreementLeadDomains.leadDomainId))
      .innerJoin(t.domains, eq(t.domains.id, t.leadDomains.domainId))
      .innerJoin(t.quotes, eq(t.quotes.id, t.agreementLeadDomains.quoteId))
      .where(
        inArray(
          t.agreementLeadDomains.agreementId,
          rows.map((a) => a.id),
        ),
      ),
    db
      .select()
      .from(t.commissionInvoices)
      .where(
        inArray(
          t.commissionInvoices.agreementId,
          rows.map((a) => a.id),
        ),
      ),
    db
      .select({ id: t.projects.id, agreementId: t.projects.agreementId })
      .from(t.projects)
      .where(
        inArray(
          t.projects.agreementId,
          rows.map((a) => a.id),
        ),
      ),
    professionalSummaries(rows.map((a) => a.professionalId)),
    clientSummariesFor(rows.map((a) => a.clientId)),
  ]);

  const projectViews = await buildProjectViews(projectRows.map((p) => p.id));

  return rows.map((agreement) => {
    const lines = linkRows.filter((l) => l.link.agreementId === agreement.id);
    return {
      agreement: {
        id: agreement.id,
        reference: agreement.reference,
        leadId: agreement.leadId,
        clientId: agreement.clientId,
        professionalId: agreement.professionalId,
        totalValue: agreement.totalValue,
        paymentTerms: agreement.paymentTerms,
        status: agreement.status,
        documentUrl: agreement.documentUrl,
        sentAt: agreement.sentAt,
        signedAt: agreement.signedAt,
        startDate: agreement.startDate,
        cancelledReason: agreement.cancelledReason,
        createdAt: agreement.createdAt,
        updatedAt: agreement.updatedAt,
        deletedAt: agreement.deletedAt,
      },
      professional: summaries.get(agreement.professionalId)!,
      client: clients.get(agreement.clientId)!,
      lines: lines.map(({ link, domain, quote }) => ({
        link: {
          id: link.id,
          agreementId: link.agreementId,
          leadDomainId: link.leadDomainId,
          quoteId: link.quoteId,
          value: link.value,
          createdAt: link.createdAt,
          updatedAt: link.updatedAt,
          deletedAt: link.deletedAt,
        },
        domain: toDomain(domain),
        quote: {
          id: quote.id,
          leadDomainId: quote.leadDomainId,
          professionalId: quote.professionalId,
          version: quote.version,
          supersedesQuoteId: quote.supersedesQuoteId,
          lineItems: quote.lineItems,
          subtotal: quote.subtotal,
          taxPercent: quote.taxPercent,
          taxAmount: quote.taxAmount,
          total: quote.total,
          timelineDays: quote.timelineDays,
          warrantyMonths: quote.warrantyMonths,
          warrantyDetails: quote.warrantyDetails,
          materialsSummary: quote.materialsSummary,
          boqUrl: quote.boqUrl,
          quotePdfUrl: quote.quotePdfUrl,
          status: quote.status,
          notes: quote.notes,
          createdAt: quote.createdAt,
          updatedAt: quote.updatedAt,
          deletedAt: quote.deletedAt,
        },
      })),
      // One professional covering several services under one contract.
      isCombined: lines.length > 1,
      projects: projectViews.filter((p) => p.project.agreementId === agreement.id),
      invoice: invoiceRows.find((i) => i.agreementId === agreement.id) ?? null,
    };
  });
}

async function mediaByOwner(
  ownerType: string,
  ownerIds: string[],
): Promise<Map<string, MediaAsset[]>> {
  if (ownerIds.length === 0) return new Map();

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
        eq(t.mediaAssets.ownerType, ownerType),
        inArray(t.mediaAssets.ownerId, ownerIds),
        isNull(t.mediaAssets.deletedAt),
      ),
    )
    .orderBy(asc(t.mediaAssets.sortOrder));

  return groupMediaByOwner(rows);
}
