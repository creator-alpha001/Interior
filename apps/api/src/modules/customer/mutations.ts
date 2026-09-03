/**
 * Everything a customer can change.
 *
 * All of it is scoped by the client id from the session — never from the
 * request — so a customer cannot address another customer's records by
 * changing an id in a URL.
 *
 * The multi-table writes here run in one transaction each. `signAgreement` is
 * the reason that matters: it creates the projects, their stages and the
 * commission invoice together, and a half-applied version of that leaves a
 * customer holding a signed contract with no work scheduled against it.
 */
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type {
  Agreement,
  LeadView,
  MaterialSource,
  Meeting,
  Review,
  SiteAccessibilityTag,
  SupportTicket,
  Urgency,
} from "@repo/types";
import { db, transaction, type Tx } from "../../db/client";
import * as t from "../../db/schema";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors";
import { buildLeadViews } from "./views";
import { attachMedia } from "../uploads/repository";

/* ------------------------------------------------------------------ *
 * Ownership
 * ------------------------------------------------------------------ */

/**
 * Confirms a lead-domain belongs to this customer.
 *
 * Returns 404 rather than 403 for somebody else's record: a 403 confirms it
 * exists, which is more than a stranger should learn from guessing an id.
 */
async function ownedLeadDomain(clientId: string, leadDomainId: string) {
  const [row] = await db
    .select({ leadDomain: t.leadDomains, leadId: t.leads.id })
    .from(t.leadDomains)
    .innerJoin(t.leads, eq(t.leads.id, t.leadDomains.leadId))
    .where(and(eq(t.leadDomains.id, leadDomainId), eq(t.leads.clientId, clientId)))
    .limit(1);

  if (!row) throw new NotFoundError("That service");
  return row;
}

/* ------------------------------------------------------------------ *
 * Submitting a requirement
 * ------------------------------------------------------------------ */

export interface RequirementInput {
  cityId: string;
  domainIds: string[];
  description: string;
  urgency: Urgency;
  materialSource: Record<string, MaterialSource>;
  siteAccessibilityTags?: SiteAccessibilityTag[];
  budgetMin?: number | null;
  budgetMax?: number | null;
  preferredProfessionalId?: string | null;
  photoIds?: string[];
  catalogueItems?: Array<{
    domainId: string;
    productId?: string;
    packageId?: string;
    itemName: string;
    quantity: number;
    selectedOptions?: Record<string, string>;
    indicativePrice?: number | null;
    notes?: string | null;
  }>;
}

export async function submitRequirement(
  clientId: string,
  input: RequirementInput,
): Promise<LeadView> {
  if (input.domainIds.length === 0) {
    throw new ValidationError("Choose at least one service");
  }

  const leadId = await transaction(async (tx) => {
    // The reference comes from a sequence. The previous implementation counted
    // rows, which races and collides after a delete.
    const [seq] = await tx.execute<{ value: string }>(
      sql`SELECT nextval('lead_reference_seq') AS value`,
    );

    const [lead] = await tx
      .insert(t.leads)
      .values({
        reference: `LD-${seq!.value}`,
        clientId,
        cityId: input.cityId,
        description: input.description,
        urgency: input.urgency,
        budgetMin: input.budgetMin ?? null,
        budgetMax: input.budgetMax ?? null,
        siteAccessibilityTags: input.siteAccessibilityTags ?? [],
        // Where a requirement started tells sales how to open the call.
        source: input.catalogueItems?.length ? "catalogue" : "app",
      })
      .returning({ id: t.leads.id });

    // A named preference is only honoured for trades that vendor is actually
    // approved for — otherwise it is a promise ops cannot keep.
    const approvedForPreferred = input.preferredProfessionalId
      ? new Set(
          (
            await tx
              .select({ domainId: t.professionalDomains.domainId })
              .from(t.professionalDomains)
              .where(
                and(
                  eq(t.professionalDomains.professionalId, input.preferredProfessionalId),
                  eq(t.professionalDomains.verificationStatus, "approved"),
                ),
              )
          ).map((r) => r.domainId),
        )
      : new Set<string>();

    const domains = await tx
      .insert(t.leadDomains)
      .values(
        input.domainIds.map((domainId) => ({
          leadId: lead!.id,
          domainId,
          materialSource: input.materialSource[domainId] ?? "undecided",
          preferredProfessionalId: approvedForPreferred.has(domainId)
            ? input.preferredProfessionalId!
            : null,
        })),
      )
      .returning({ id: t.leadDomains.id, domainId: t.leadDomains.domainId });

    const items = (input.catalogueItems ?? []).flatMap((item) => {
      const leadDomain = domains.find((d) => d.domainId === item.domainId);
      if (!leadDomain) return [];
      return [
        {
          leadDomainId: leadDomain.id,
          productId: item.productId ?? null,
          packageId: item.packageId ?? null,
          itemName: item.itemName,
          quantity: item.quantity,
          selectedOptions: item.selectedOptions ?? {},
          indicativePrice: item.indicativePrice ?? null,
          customerNotes: item.notes ?? null,
        },
      ];
    });

    if (items.length > 0) await tx.insert(t.leadDomainItems).values(items);

    if (input.photoIds?.length) {
      await attachMedia(tx, input.photoIds, "lead", lead!.id, "requirement_photo");
    }

    return lead!.id;
  });

  const [view] = await buildLeadViews([leadId]);
  return view!;
}

/* ------------------------------------------------------------------ *
 * Choosing a quote
 * ------------------------------------------------------------------ */

export async function selectQuote(
  clientId: string,
  leadDomainId: string,
  quoteId: string,
): Promise<LeadView> {
  const owned = await ownedLeadDomain(clientId, leadDomainId);

  await transaction(async (tx) => {
    const [quote] = await tx
      .select()
      .from(t.quotes)
      .where(and(eq(t.quotes.id, quoteId), eq(t.quotes.leadDomainId, leadDomainId)))
      .limit(1);

    // The composite foreign key would catch this too. Checking first turns a
    // constraint violation into a sentence somebody can act on.
    if (!quote) throw new NotFoundError("That quote");

    await tx
      .update(t.leadDomains)
      .set({
        selectedProfessionalId: quote.professionalId,
        selectedQuoteId: quote.id,
        status: "vendor_selected",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(t.leadDomains.id, leadDomainId));

    // Choosing one quote rejects the rest: a service with two selected quotes
    // is a contract nobody can price.
    await tx
      .update(t.quotes)
      .set({ status: sql`CASE WHEN ${t.quotes.id} = ${quoteId} THEN 'selected' ELSE 'rejected' END` })
      .where(eq(t.quotes.leadDomainId, leadDomainId));
  });

  const [view] = await buildLeadViews([owned.leadId]);
  return view!;
}

/* ------------------------------------------------------------------ *
 * Agreements
 * ------------------------------------------------------------------ */

/**
 * Groups the vendors chosen across a requirement into contracts.
 *
 * One agreement per professional, not per service: the same vendor hired for
 * two trades gets one contract and one commission invoice, while execution
 * stays tracked per service because a painting job finishing does not mean the
 * furniture job has.
 */
export async function generateAgreements(clientId: string, leadId: string): Promise<string[]> {
  return transaction(async (tx) => {
    const [lead] = await tx
      .select()
      .from(t.leads)
      .where(and(eq(t.leads.id, leadId), eq(t.leads.clientId, clientId)))
      .limit(1);

    if (!lead) throw new NotFoundError("That requirement");

    const selected = await tx
      .select({ leadDomain: t.leadDomains, quote: t.quotes })
      .from(t.leadDomains)
      .innerJoin(t.quotes, eq(t.quotes.id, t.leadDomains.selectedQuoteId))
      .where(and(eq(t.leadDomains.leadId, leadId), isNull(t.leadDomains.deletedAt)));

    if (selected.length === 0) {
      throw new ConflictError("No vendor has been chosen for any service yet");
    }

    const byProfessional = new Map<string, typeof selected>();
    for (const row of selected) {
      const id = row.quote.professionalId;
      const list = byProfessional.get(id);
      if (list) list.push(row);
      else byProfessional.set(id, [row]);
    }

    const existing = await tx
      .select({ id: t.agreements.id, professionalId: t.agreements.professionalId })
      .from(t.agreements)
      .where(and(eq(t.agreements.leadId, leadId), sql`${t.agreements.status} <> 'cancelled'`));

    const created: string[] = [];
    let index = existing.length;

    for (const [professionalId, lines] of byProfessional) {
      if (existing.some((a) => a.professionalId === professionalId)) continue;

      const [agreement] = await tx
        .insert(t.agreements)
        .values({
          reference: `${lead.reference.replace("LD-", "AGR-")}-${String(index).padStart(2, "0")}`,
          leadId,
          clientId,
          professionalId,
          totalValue: lines.reduce((sum, l) => sum + l.quote.total, 0),
          paymentTerms:
            "Paid directly to the professional. 40% advance, 40% on material delivery, 20% on handover.",
          status: "sent",
          sentAt: new Date().toISOString(),
        })
        .returning({ id: t.agreements.id });

      await tx.insert(t.agreementLeadDomains).values(
        lines.map((line) => ({
          agreementId: agreement!.id,
          leadDomainId: line.leadDomain.id,
          quoteId: line.quote.id,
          // Snapshotted: the quote can be superseded later, the contract cannot.
          value: line.quote.total,
        })),
      );

      created.push(agreement!.id);
      index += 1;
    }

    return created;
  });
}

/** The four stages every project starts with. */
const DEFAULT_MILESTONES: Array<[string, string]> = [
  ["Advance received, work scheduled", "Dates agreed and crew allocated."],
  ["Material procured", "Materials on site or in the workshop, as quoted."],
  ["Work in progress", "Main execution stage."],
  ["Handover", "Snagging cleared and the site handed back clean."],
];

/**
 * Signing: the largest transaction in the system.
 *
 * It activates the contract, moves every covered service into execution,
 * creates one project per service with its stages, and raises a single
 * commission invoice. Five tables. A partial failure here is a customer with a
 * signed agreement and no work scheduled, or a vendor billed for work that was
 * never created — so it is all or nothing.
 */
export async function signAgreement(clientId: string, agreementId: string): Promise<Agreement> {
  return transaction(async (tx) => {
    // Locked for the duration: two taps on a slow connection must not produce
    // two sets of projects, and the unique indexes should be the backstop
    // rather than the mechanism.
    const [agreement] = await tx
      .select()
      .from(t.agreements)
      .where(and(eq(t.agreements.id, agreementId), eq(t.agreements.clientId, clientId)))
      .limit(1)
      .for("update");

    if (!agreement) throw new NotFoundError("That agreement");
    if (agreement.status === "active" || agreement.status === "completed") {
      throw new ConflictError("This agreement has already been signed");
    }
    if (agreement.status === "cancelled") {
      throw new ConflictError("This agreement was cancelled");
    }

    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    await tx
      .update(t.agreements)
      .set({ status: "active", signedAt: now.toISOString(), startDate: today, updatedAt: now.toISOString() })
      .where(eq(t.agreements.id, agreementId));

    const lines = await tx
      .select({ link: t.agreementLeadDomains, quote: t.quotes, leadDomain: t.leadDomains, domain: t.domains })
      .from(t.agreementLeadDomains)
      .innerJoin(t.quotes, eq(t.quotes.id, t.agreementLeadDomains.quoteId))
      .innerJoin(t.leadDomains, eq(t.leadDomains.id, t.agreementLeadDomains.leadDomainId))
      .innerJoin(t.domains, eq(t.domains.id, t.leadDomains.domainId))
      .where(eq(t.agreementLeadDomains.agreementId, agreementId));

    const overrides = await tx
      .select()
      .from(t.professionalDomains)
      .where(eq(t.professionalDomains.professionalId, agreement.professionalId));

    let commissionTotal = 0;

    for (const line of lines) {
      await tx
        .update(t.leadDomains)
        .set({ status: "in_progress", updatedAt: now.toISOString() })
        .where(eq(t.leadDomains.id, line.leadDomain.id));

      const already = await tx
        .select({ id: t.projects.id })
        .from(t.projects)
        .where(eq(t.projects.leadDomainId, line.leadDomain.id))
        .limit(1);
      if (already.length > 0) continue;

      // Locked in now, from this vendor's rate for this trade. A later override
      // or a change to the domain default must not reprice work already agreed.
      const commissionPercent =
        overrides.find((o) => o.domainId === line.domain.id)?.commissionPercentOverride ??
        line.domain.defaultCommissionPercent;
      const commissionAmount = Math.round((line.link.value * commissionPercent) / 100);
      commissionTotal += commissionAmount;

      const [seq] = await tx.execute<{ value: string }>(
        sql`SELECT nextval('project_reference_seq') AS value`,
      );

      const [project] = await tx
        .insert(t.projects)
        .values({
          reference: `PRJ-${seq!.value}-${line.domain.slug.slice(0, 3).toUpperCase()}`,
          leadDomainId: line.leadDomain.id,
          agreementId,
          clientId,
          professionalId: agreement.professionalId,
          quoteId: line.quote.id,
          value: line.link.value,
          commissionPercent,
          commissionAmount,
          startDate: today,
          estimatedEndDate: new Date(now.getTime() + line.quote.timelineDays * 86_400_000)
            .toISOString()
            .slice(0, 10),
          status: "ongoing",
        })
        .returning({ id: t.projects.id });

      // Every stage starts empty and is closed by the vendor uploading proof
      // that ops then approve. Completion follows approvals, never claims.
      await tx.insert(t.projectMilestones).values(
        DEFAULT_MILESTONES.map(([title, description], sortOrder) => ({
          projectId: project!.id,
          sortOrder,
          title,
          description,
        })),
      );
    }

    // One invoice per agreement, covering every project under it. The unique
    // index enforces that; this check keeps a re-sign from erroring.
    const existingInvoice = await tx
      .select({ id: t.commissionInvoices.id })
      .from(t.commissionInvoices)
      .where(eq(t.commissionInvoices.agreementId, agreementId))
      .limit(1);

    if (existingInvoice.length === 0 && commissionTotal > 0) {
      const [seq] = await tx.execute<{ value: string }>(
        sql`SELECT nextval('invoice_reference_seq') AS value`,
      );

      await tx.insert(t.commissionInvoices).values({
        reference: `INV-${now.getFullYear()}-${String(seq!.value).padStart(4, "0")}`,
        professionalId: agreement.professionalId,
        agreementId,
        amount: commissionTotal,
        status: "pending",
        dueDate: new Date(now.getTime() + 15 * 86_400_000).toISOString().slice(0, 10),
      });
    }

    const [updated] = await tx
      .select()
      .from(t.agreements)
      .where(eq(t.agreements.id, agreementId))
      .limit(1);

    return toAgreement(updated!);
  });
}

function toAgreement(row: typeof t.agreements.$inferSelect): Agreement {
  return {
    id: row.id,
    reference: row.reference,
    leadId: row.leadId,
    clientId: row.clientId,
    professionalId: row.professionalId,
    totalValue: row.totalValue,
    paymentTerms: row.paymentTerms,
    status: row.status,
    documentUrl: row.documentUrl,
    sentAt: row.sentAt,
    signedAt: row.signedAt,
    startDate: row.startDate,
    cancelledReason: row.cancelledReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

/* ------------------------------------------------------------------ *
 * Messages, reviews, visits, tickets
 * ------------------------------------------------------------------ */

export async function sendMessage(clientId: string, leadDomainId: string, body: string) {
  await ownedLeadDomain(clientId, leadDomainId);

  const [message] = await db
    .insert(t.messages)
    .values({
      leadDomainId,
      // A customer can only ever write to the platform. The check constraint on
      // the table makes the alternative impossible, not merely unwritten.
      channel: "client_platform",
      senderRole: "client",
      senderId: clientId,
      professionalId: null,
      body,
    })
    .returning();

  return message!;
}

export async function submitReview(
  clientId: string,
  input: {
    projectId: string;
    rating: number;
    comment: string;
    qualityRating?: number | null;
    timelinessRating?: number | null;
    professionalismRating?: number | null;
  },
): Promise<Review> {
  return transaction(async (tx) => {
    const [project] = await tx
      .select({ project: t.projects, domainId: t.leadDomains.domainId })
      .from(t.projects)
      .innerJoin(t.leadDomains, eq(t.leadDomains.id, t.projects.leadDomainId))
      .where(and(eq(t.projects.id, input.projectId), eq(t.projects.clientId, clientId)))
      .limit(1);

    if (!project) throw new NotFoundError("That project");
    if (project.project.status !== "completed") {
      throw new ConflictError("You can review a project once it is finished");
    }

    const [review] = await tx
      .insert(t.reviews)
      .values({
        projectId: input.projectId,
        clientId,
        professionalId: project.project.professionalId,
        // Denormalised from the service, so per-trade ratings need no join.
        domainId: project.domainId,
        rating: input.rating,
        comment: input.comment,
        qualityRating: input.qualityRating ?? null,
        timelinessRating: input.timelinessRating ?? null,
        professionalismRating: input.professionalismRating ?? null,
      })
      .returning();

    // The rating caches on professionals and professional_domains are updated
    // by a trigger, so they cannot drift from the reviews underneath them.
    return {
      id: review!.id,
      projectId: review!.projectId,
      clientId: review!.clientId,
      professionalId: review!.professionalId,
      domainId: review!.domainId,
      rating: review!.rating as 1 | 2 | 3 | 4 | 5,
      comment: review!.comment,
      qualityRating: review!.qualityRating,
      timelinessRating: review!.timelinessRating,
      professionalismRating: review!.professionalismRating,
      createdAt: review!.createdAt,
      updatedAt: review!.updatedAt,
      deletedAt: review!.deletedAt,
    };
  });
}

/**
 * A customer asking for a different slot.
 *
 * They cannot rebook: the coordinator re-confirms with the vendor and proposes
 * a new time, because both sides have to be free and only one of them is here.
 */
export async function requestReschedule(
  clientId: string,
  meetingId: string,
  note: string,
): Promise<Meeting> {
  const [row] = await db
    .select({ meeting: t.meetings })
    .from(t.meetings)
    .innerJoin(t.leadDomains, eq(t.leadDomains.id, t.meetings.leadDomainId))
    .innerJoin(t.leads, eq(t.leads.id, t.leadDomains.leadId))
    .where(and(eq(t.meetings.id, meetingId), eq(t.leads.clientId, clientId)))
    .limit(1);

  if (!row) throw new NotFoundError("That visit");

  const [updated] = await db
    .update(t.meetings)
    .set({
      rescheduleRequestedAt: new Date().toISOString(),
      rescheduleNote: note,
      status: "rescheduled",
      updatedAt: new Date().toISOString(),
    })
    .where(eq(t.meetings.id, meetingId))
    .returning();

  return updated as unknown as Meeting;
}

export async function markNotificationsRead(userId: string): Promise<number> {
  const rows = await db
    .update(t.notifications)
    .set({ isRead: true, updatedAt: new Date().toISOString() })
    .where(and(eq(t.notifications.userId, userId), eq(t.notifications.isRead, false)))
    .returning({ id: t.notifications.id });

  return rows.length;
}

export async function createTicket(
  userId: string,
  input: {
    category: SupportTicket["category"];
    subject: string;
    body: string;
    leadId?: string | null;
    projectId?: string | null;
  },
): Promise<SupportTicket> {
  const [seq] = await db.execute<{ value: string }>(
    sql`SELECT nextval('ticket_reference_seq') AS value`,
  );

  const [ticket] = await db
    .insert(t.supportTickets)
    .values({
      reference: `TKT-${new Date().getFullYear()}-${String(seq!.value).padStart(4, "0")}`,
      raisedByUserId: userId,
      leadId: input.leadId ?? null,
      projectId: input.projectId ?? null,
      category: input.category,
      subject: input.subject,
      body: input.body,
      // A complaint or an escalation starts high. Somebody unhappy enough to
      // use those words should not queue behind a question about timings.
      priority:
        input.category === "escalation" || input.category === "complaint" ? "high" : "medium",
    })
    .returning();

  return { ...ticket!, replies: [] } as unknown as SupportTicket;
}

export async function replyToTicket(userId: string, ticketId: string, body: string) {
  const [ticket] = await db
    .select()
    .from(t.supportTickets)
    .where(and(eq(t.supportTickets.id, ticketId), eq(t.supportTickets.raisedByUserId, userId)))
    .limit(1);

  if (!ticket) throw new NotFoundError("That ticket");

  const [user] = await db
    .select({ name: t.users.name })
    .from(t.users)
    .where(eq(t.users.id, userId))
    .limit(1);

  const [reply] = await db
    .insert(t.ticketReplies)
    .values({
      ticketId,
      // Taken from the session. The previous implementation accepted the
      // author's name from the request body, which anybody could set.
      authorRole: "client",
      authorUserId: userId,
      authorName: user?.name ?? "Customer",
      body,
    })
    .returning();

  return reply!;
}
