/**
 * Write operations available to a signed-in client.
 *
 * Each of these is a future API endpoint. They are grouped here rather than
 * scattered so the surface a client can actually mutate stays obvious — and so
 * it stays visible that a client can never write into a vendor's thread, edit a
 * quote, or change an agreement's terms.
 */
import type {
  Agreement,
  Meeting,
  Referral,
  Review,
  SupportTicket,
  TicketReply,
} from "@repo/types";
import { delay, demoClientId, nextId, nowIso, store } from "./store";

/* ---------------- Reviews ---------------- */

export interface ReviewInput {
  projectId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  qualityRating?: number | null;
  timelinessRating?: number | null;
  professionalismRating?: number | null;
}

/**
 * One review per project — therefore per service, even when one professional
 * covered several services under a single combined agreement. Submitting also
 * recalculates that professional's rating for that domain specifically.
 */
export async function submitReview(input: ReviewInput): Promise<Review> {
  const project = store.projects.find((p) => p.id === input.projectId);
  if (!project) throw new Error("Unknown project");
  if (store.reviews.some((r) => r.projectId === input.projectId)) {
    throw new Error("This project has already been reviewed");
  }

  const leadDomain = store.leadDomains.find((ld) => ld.id === project.leadDomainId)!;

  const review: Review = {
    id: nextId("rev"),
    projectId: project.id,
    clientId: project.clientId,
    professionalId: project.professionalId,
    domainId: leadDomain.domainId,
    rating: input.rating,
    comment: input.comment,
    qualityRating: input.qualityRating ?? null,
    timelinessRating: input.timelinessRating ?? null,
    professionalismRating: input.professionalismRating ?? null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    deletedAt: null,
  };
  store.reviews.push(review);

  recalculateRatings(project.professionalId, leadDomain.domainId);
  return delay(review);
}

/** Keeps the cached per-domain and overall ratings honest after a new review. */
function recalculateRatings(professionalId: string, domainId: string) {
  const domainReviews = store.reviews.filter(
    (r) => r.professionalId === professionalId && r.domainId === domainId,
  );
  const link = store.professionalDomains.find(
    (pd) => pd.professionalId === professionalId && pd.domainId === domainId,
  );
  if (link && domainReviews.length) {
    link.ratingCount = domainReviews.length;
    link.avgRating =
      Math.round(
        (domainReviews.reduce((sum, r) => sum + r.rating, 0) / domainReviews.length) * 10,
      ) / 10;
  }

  const allReviews = store.reviews.filter((r) => r.professionalId === professionalId);
  const pro = store.professionals.find((p) => p.id === professionalId);
  if (pro && allReviews.length) {
    pro.ratingCount = allReviews.length;
    pro.avgRating =
      Math.round((allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length) * 10) / 10;
  }
}

/* ---------------- Agreements ---------------- */

/**
 * The client signing their copy. Signing starts the projects under the
 * agreement — one per service it covers, because they finish independently.
 */
export async function signAgreement(agreementId: string): Promise<Agreement> {
  const agreement = store.agreements.find((a) => a.id === agreementId);
  if (!agreement) throw new Error("Unknown agreement");

  agreement.status = "active";
  agreement.signedAt = nowIso();
  agreement.startDate = nowIso().slice(0, 10);
  agreement.updatedAt = nowIso();

  const links = store.agreementLeadDomains.filter((l) => l.agreementId === agreementId);

  for (const link of links) {
    const leadDomain = store.leadDomains.find((ld) => ld.id === link.leadDomainId);
    if (!leadDomain) continue;
    leadDomain.status = "in_progress";
    leadDomain.updatedAt = nowIso();

    if (store.projects.some((p) => p.leadDomainId === leadDomain.id)) continue;

    const quote = store.quotes.find((q) => q.id === link.quoteId)!;
    const domainLink = store.professionalDomains.find(
      (pd) =>
        pd.professionalId === agreement.professionalId && pd.domainId === leadDomain.domainId,
    );
    const domain = store.domains.find((d) => d.id === leadDomain.domainId)!;
    // Commission is locked in at signing, from the vendor's rate for that
    // service — an override if they have one, otherwise the domain default.
    const commissionPercent =
      domainLink?.commissionPercentOverride ?? domain.defaultCommissionPercent;

    store.projects.push({
      id: nextId("prj"),
      reference: `PRJ-${agreement.reference.replace("AGR-", "")}-${domain.slug
        .slice(0, 3)
        .toUpperCase()}`,
      leadDomainId: leadDomain.id,
      agreementId,
      clientId: agreement.clientId,
      professionalId: agreement.professionalId,
      quoteId: quote.id,
      value: link.value,
      commissionPercent,
      commissionAmount: Math.round((link.value * commissionPercent) / 100),
      startDate: nowIso().slice(0, 10),
      estimatedEndDate: new Date(Date.now() + quote.timelineDays * 86_400_000)
        .toISOString()
        .slice(0, 10),
      actualEndDate: null,
      completionPercent: 0,
      status: "ongoing",
      // Every stage starts empty and is closed by the vendor uploading proof,
      // which is what the customer and our team both track against.
      milestones: [
        ["Advance received, work scheduled", "Dates agreed and crew allocated."],
        ["Material procured", "Materials on site or in the workshop, as quoted."],
        ["Work in progress", "Main execution stage."],
        ["Handover", "Snagging cleared and the site handed back clean."],
      ].map(([title, description]) => ({
        id: nextId("ms"),
        title,
        description,
        completedAt: null,
        proof: [],
        proofNote: null,
        submittedAt: null,
        verification: "not_started" as const,
        verifiedAt: null,
        verifiedByUserId: null,
        verifierNote: null,
      })),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    });
  }

  // One invoice per agreement, covering every project under it.
  if (!store.commissionInvoices.some((i) => i.agreementId === agreementId)) {
    const amount = store.projects
      .filter((p) => p.agreementId === agreementId)
      .reduce((sum, p) => sum + p.commissionAmount, 0);

    store.commissionInvoices.push({
      id: nextId("inv"),
      reference: `INV-${new Date().getFullYear()}-${String(
        store.commissionInvoices.length + 500,
      ).padStart(4, "0")}`,
      professionalId: agreement.professionalId,
      agreementId,
      amount,
      status: "pending",
      dueDate: new Date(Date.now() + 15 * 86_400_000).toISOString().slice(0, 10),
      paidDate: null,
      adjustmentNote: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    });
  }

  return delay(agreement);
}

/* ---------------- Site visits ---------------- */

/**
 * A client cannot rebook a visit themselves — they ask, and the coordinator
 * re-confirms with the professional before a new slot is set.
 */
export async function requestReschedule(meetingId: string, note: string): Promise<Meeting> {
  const meeting = store.meetings.find((m) => m.id === meetingId);
  if (!meeting) throw new Error("Unknown meeting");
  meeting.rescheduleRequestedAt = nowIso();
  meeting.rescheduleNote = note;
  meeting.status = "rescheduled";
  meeting.updatedAt = nowIso();
  return delay(meeting);
}

/* ---------------- Notifications ---------------- */

export async function markNotificationsRead(userId: string): Promise<number> {
  const unread = store.notifications.filter((n) => n.userId === userId && !n.isRead);
  for (const n of unread) {
    n.isRead = true;
    n.updatedAt = nowIso();
  }
  return delay(unread.length);
}

/* ---------------- Support ---------------- */

export interface TicketInput {
  raisedByUserId: string;
  category: SupportTicket["category"];
  subject: string;
  body: string;
  leadId?: string | null;
  projectId?: string | null;
}

export async function createSupportTicket(input: TicketInput): Promise<SupportTicket> {
  const ticket: SupportTicket = {
    id: nextId("tkt"),
    reference: `TKT-${new Date().getFullYear()}-${String(
      store.supportTickets.length + 200,
    ).padStart(4, "0")}`,
    raisedByUserId: input.raisedByUserId,
    leadId: input.leadId ?? null,
    projectId: input.projectId ?? null,
    category: input.category,
    subject: input.subject,
    body: input.body,
    priority: input.category === "escalation" || input.category === "complaint" ? "high" : "medium",
    status: "open",
    assignedToUserId: null,
    replies: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    deletedAt: null,
  };
  store.supportTickets.unshift(ticket);
  return delay(ticket);
}

export async function listSupportTickets(userId: string): Promise<SupportTicket[]> {
  return delay(
    store.supportTickets
      .filter((t) => t.raisedByUserId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

export async function replyToTicket(
  ticketId: string,
  authorName: string,
  body: string,
): Promise<TicketReply> {
  const ticket = store.supportTickets.find((t) => t.id === ticketId);
  if (!ticket) throw new Error("Unknown ticket");
  const reply: TicketReply = {
    id: nextId("trep"),
    authorRole: "client",
    authorName,
    body,
    createdAt: nowIso(),
  };
  ticket.replies.push(reply);
  ticket.updatedAt = nowIso();
  return delay(reply);
}

/* ---------------- Referrals ---------------- */

export interface ReferralSummary {
  code: string;
  shareUrl: string;
  invited: number;
  earned: number;
  pending: number;
  rewardPerReferral: number;
  referrals: Array<{ referral: Referral; name: string }>;
}

export async function getReferralSummary(
  clientId = demoClientId,
): Promise<ReferralSummary> {
  const client = store.clients.find((c) => c.id === clientId)!;
  const rows = store.referrals.filter((r) => r.referrerUserId === client.userId);

  return delay({
    code: client.referralCode,
    shareUrl: `https://aangan.example.com/join?ref=${client.referralCode}`,
    invited: rows.length,
    earned: rows
      .filter((r) => r.rewardStatus === "paid" || r.rewardStatus === "earned")
      .reduce((sum, r) => sum + r.rewardAmount, 0),
    pending: rows
      .filter((r) => r.rewardStatus === "pending")
      .reduce((sum, r) => sum + r.rewardAmount, 0),
    rewardPerReferral: 1000,
    referrals: rows.map((referral) => ({
      referral,
      name: store.users.find((u) => u.id === referral.referredUserId)?.name ?? "Invited friend",
    })),
  });
}
