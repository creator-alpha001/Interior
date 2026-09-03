/**
 * What a vendor can change.
 *
 * Two rules shape this file:
 *
 * A vendor writes only into their own thread with our team. The channel is
 * hardcoded on every insert and the table's check constraint makes the other
 * one unrepresentable, so there is no path from here to the customer.
 *
 * Submitting evidence is not the same as finishing. `submitMilestoneProof`
 * marks a stage *submitted*; only an approval from ops moves the completion the
 * customer sees. That gap is the whole point — "done" should mean somebody
 * checked.
 */
import { and, desc, eq, ne } from "drizzle-orm";
import type { Message, PartnerAgreement, Quote } from "@repo/types";
import { db, transaction } from "../../db/client";
import * as t from "../../db/schema";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors";
import { attachMedia } from "../uploads/repository";

/** Confirms this vendor was actually offered the service before they act on it. */
async function assignedTo(professionalId: string, leadDomainId: string) {
  const [row] = await db
    .select({ assignment: t.leadDomainAssignments, leadDomain: t.leadDomains })
    .from(t.leadDomainAssignments)
    .innerJoin(t.leadDomains, eq(t.leadDomains.id, t.leadDomainAssignments.leadDomainId))
    .where(
      and(
        eq(t.leadDomainAssignments.leadDomainId, leadDomainId),
        eq(t.leadDomainAssignments.professionalId, professionalId),
      ),
    )
    .limit(1);

  if (!row) throw new NotFoundError("That lead");
  return row;
}

export async function respondToLead(
  professionalId: string,
  leadDomainId: string,
  response: "accepted" | "rejected",
  reason?: string,
): Promise<void> {
  await assignedTo(professionalId, leadDomainId);

  await db
    .update(t.leadDomainAssignments)
    .set({
      responseStatus: response,
      respondedAt: new Date().toISOString(),
      rejectionReason: reason ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(t.leadDomainAssignments.leadDomainId, leadDomainId),
        eq(t.leadDomainAssignments.professionalId, professionalId),
      ),
    );
}

export interface QuoteDraftInput {
  leadDomainId: string;
  lineItems: Array<{ description: string; quantity: number; unit: string; rate: number }>;
  taxPercent: number;
  timelineDays: number;
  warrantyMonths: number;
  warrantyDetails: string;
  materialsSummary: string;
  notes?: string | null;
}

/**
 * Submitting or revising a quote.
 *
 * Versioned rather than overwritten: prices get renegotiated, and the history
 * is what lets ops see how one moved and why. The previous version is marked
 * superseded in the same transaction, so there is never a moment with two live
 * quotes from one vendor — the partial unique index would refuse it anyway.
 */
export async function submitQuote(
  professionalId: string,
  input: QuoteDraftInput,
): Promise<Quote> {
  if (input.lineItems.length === 0) {
    throw new ValidationError("A quote needs at least one line");
  }

  const { leadDomain } = await assignedTo(professionalId, input.leadDomainId);

  if (leadDomain.selectedProfessionalId && leadDomain.selectedProfessionalId !== professionalId) {
    throw new ConflictError("This job has already gone to another professional");
  }

  return transaction(async (tx) => {
    const [previous] = await tx
      .select()
      .from(t.quotes)
      .where(
        and(
          eq(t.quotes.leadDomainId, input.leadDomainId),
          eq(t.quotes.professionalId, professionalId),
        ),
      )
      .orderBy(desc(t.quotes.version))
      .limit(1)
      // Locked so two submissions cannot both read the same latest version and
      // both try to write the next one.
      .for("update");

    const lineItems = input.lineItems.map((line, index) => ({
      id: `li-${index + 1}`,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      rate: line.rate,
      amount: Math.round(line.quantity * line.rate),
    }));

    const subtotal = lineItems.reduce((sum, l) => sum + l.amount, 0);
    const taxAmount = Math.round((subtotal * input.taxPercent) / 100);

    if (previous) {
      await tx
        .update(t.quotes)
        .set({ status: "revised", updatedAt: new Date().toISOString() })
        .where(eq(t.quotes.id, previous.id));
    }

    const [quote] = await tx
      .insert(t.quotes)
      .values({
        leadDomainId: input.leadDomainId,
        professionalId,
        version: previous ? previous.version + 1 : 1,
        supersedesQuoteId: previous?.id ?? null,
        lineItems,
        subtotal,
        taxPercent: input.taxPercent,
        taxAmount,
        total: subtotal + taxAmount,
        timelineDays: input.timelineDays,
        warrantyMonths: input.warrantyMonths,
        warrantyDetails: input.warrantyDetails,
        materialsSummary: input.materialsSummary,
        status: "submitted",
        notes: input.notes ?? null,
      })
      .returning();

    if (leadDomain.status === "assigned" || leadDomain.status === "pending_assignment") {
      await tx
        .update(t.leadDomains)
        .set({ status: "quoted", updatedAt: new Date().toISOString() })
        .where(eq(t.leadDomains.id, input.leadDomainId));
    }

    // The customer is told a quote arrived. They are never given the vendor's
    // number to chase it with.
    const [lead] = await tx
      .select({ clientUserId: t.users.id, reference: t.leads.reference })
      .from(t.leadDomains)
      .innerJoin(t.leads, eq(t.leads.id, t.leadDomains.leadId))
      .innerJoin(t.clients, eq(t.clients.id, t.leads.clientId))
      .innerJoin(t.users, eq(t.users.id, t.clients.userId))
      .where(eq(t.leadDomains.id, input.leadDomainId))
      .limit(1);

    if (lead) {
      await tx.insert(t.notifications).values({
        userId: lead.clientUserId,
        type: "quote_uploaded",
        title: "A new quote is in",
        body: `A professional has quoted on ${lead.reference}.`,
        entityType: "quote",
        entityId: quote!.id,
      });
    }

    return quote as unknown as Quote;
  });
}

export async function sendMessage(
  professionalId: string,
  leadDomainId: string,
  body: string,
): Promise<Message> {
  await assignedTo(professionalId, leadDomainId);

  const [message] = await db
    .insert(t.messages)
    .values({
      leadDomainId,
      // Hardcoded, and backed by the table's check constraint: a vendor
      // structurally cannot write into the customer's thread.
      channel: "platform_vendor",
      senderRole: "professional",
      senderId: professionalId,
      professionalId,
      body,
    })
    .returning();

  return message as unknown as Message;
}

/* ------------------------------------------------------------------ *
 * Stage evidence
 * ------------------------------------------------------------------ */

export interface MilestoneProofInput {
  projectId: string;
  milestoneId: string;
  note: string;
  /** Already uploaded through the ticket flow — ids, never bytes. */
  proof: string[];
}

/**
 * A vendor closing out a stage.
 *
 * The stage is marked *submitted*, not complete. Our team approves it, and only
 * then does the customer's progress bar move. The vendor-facing endpoint that
 * used to write `completionPercent` directly is gone — it let somebody declare
 * themselves finished.
 */
export async function submitMilestoneProof(
  professionalId: string,
  input: MilestoneProofInput,
): Promise<void> {
  if (input.proof.length === 0) {
    throw new ValidationError("At least one photograph is required");
  }

  await transaction(async (tx) => {
    const [row] = await tx
      .select({ milestone: t.projectMilestones, project: t.projects })
      .from(t.projectMilestones)
      .innerJoin(t.projects, eq(t.projects.id, t.projectMilestones.projectId))
      .where(
        and(
          eq(t.projectMilestones.id, input.milestoneId),
          eq(t.projectMilestones.projectId, input.projectId),
          eq(t.projects.professionalId, professionalId),
        ),
      )
      .limit(1);

    if (!row) throw new NotFoundError("That stage");
    if (row.milestone.verification === "approved") {
      throw new ConflictError("That stage has already been approved");
    }

    await attachMedia(
      tx,
      input.proof,
      "project_milestone",
      input.milestoneId,
      "milestone_proof",
    );

    await tx
      .update(t.projectMilestones)
      .set({
        proofNote: input.note,
        submittedAt: new Date().toISOString(),
        verification: "submitted",
        // Cleared on resubmission, so an old rejection note does not sit
        // against fresh evidence.
        verifierNote: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(t.projectMilestones.id, input.milestoneId));

    const staff = await tx
      .select({ userId: t.users.id })
      .from(t.users)
      .where(eq(t.users.role, "admin"))
      .limit(1);

    if (staff[0]) {
      await tx.insert(t.notifications).values({
        userId: staff[0].userId,
        type: "project_started",
        title: `Stage evidence submitted — ${row.milestone.title}`,
        body: `${row.project.reference} is waiting for review.`,
        entityType: "project",
        entityId: row.project.id,
      });
    }
  });
}

/* ------------------------------------------------------------------ *
 * The partner agreement
 * ------------------------------------------------------------------ */

export interface SignPartnerAgreementInput {
  signatoryName: string;
  signatoryRole: string;
  signatureText: string;
  acknowledgedClauses: string[];
}

/**
 * A vendor signing the platform's terms.
 *
 * Signing is what unlocks lead assignment, so this is a legal record rather
 * than a checkbox. Every clause is stored individually — consent that cannot be
 * shown clause by clause is not much use the day somebody disputes it — and the
 * IP and user agent are captured here from the request, not accepted from the
 * signatory, because a value they supply is not evidence of anything.
 */
export async function signPartnerAgreement(
  professionalId: string,
  input: SignPartnerAgreementInput,
  context: { ip?: string; userAgent?: string },
): Promise<PartnerAgreement> {
  return transaction(async (tx) => {
    const [terms] = await tx
      .select()
      .from(t.partnerTerms)
      .where(eq(t.partnerTerms.isCurrent, true))
      .limit(1);

    if (!terms) throw new ConflictError("No partner terms are published");

    const required = terms.acknowledgements.map((a) => a.key);
    const missing = required.filter((key) => !input.acknowledgedClauses.includes(key));
    if (missing.length > 0) {
      throw new ValidationError("Every clause must be acknowledged before signing", { missing });
    }
    if (input.signatureText.trim().length < 3) {
      throw new ValidationError("A signature is required");
    }

    // The previous agreement is superseded rather than deleted: which version
    // somebody agreed to, and when, is the whole point of versioning them.
    await tx
      .update(t.partnerAgreements)
      .set({ status: "superseded", updatedAt: new Date().toISOString() })
      .where(
        and(
          eq(t.partnerAgreements.professionalId, professionalId),
          ne(t.partnerAgreements.status, "superseded"),
        ),
      );

    const [agreement] = await tx
      .insert(t.partnerAgreements)
      .values({
        professionalId,
        termsVersion: terms.version,
        status: "signed",
        signatureText: input.signatureText.trim(),
        signatoryName: input.signatoryName.trim(),
        signatoryRole: input.signatoryRole.trim(),
        signedAt: new Date().toISOString(),
        acknowledgedClauses: input.acknowledgedClauses,
        signedFromIp: context.ip ?? null,
        signedUserAgent: context.userAgent ?? null,
      })
      .returning();

    const staff = await tx
      .select({ userId: t.users.id })
      .from(t.users)
      .where(eq(t.users.role, "admin"))
      .limit(1);

    if (staff[0]) {
      const [pro] = await tx
        .select({ companyName: t.professionals.companyName })
        .from(t.professionals)
        .where(eq(t.professionals.id, professionalId))
        .limit(1);

      await tx.insert(t.notifications).values({
        userId: staff[0].userId,
        type: "agreement_signed",
        title: `${pro?.companyName ?? "A vendor"} signed the partner agreement`,
        body: `Version ${terms.version}. They can now be assigned leads.`,
        entityType: "agreement",
        entityId: agreement!.id,
      });
    }

    return agreement as unknown as PartnerAgreement;
  });
}
