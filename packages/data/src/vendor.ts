/**
 * The professional's own view of the platform.
 *
 * The important boundary is enforced here rather than in the UI: nothing this
 * module returns contains a client's phone number or email. Vendors get a
 * masked client — locality up front, full address only once a visit has been
 * confirmed — because every conversation is coordinated by the platform.
 */
import type {
  Agreement,
  AgreementLeadDomain,
  CommissionInvoice,
  Domain,
  LeadDomain,
  LeadDomainAssignment,
  LeadDomainItem,
  MaskedClientSummary,
  Meeting,
  Message,
  PortfolioItem,
  Professional,
  ProfessionalDomain,
  Project,
  Quote,
  QuoteLineItem,
  Review,
  Rupees,
} from "@repo/types";
import { cityById, domainById, toMaskedClientSummary } from "./mappers";
import { currentProfessionalId } from "./session";
import { delay, nextId, nowIso, seedRow, store } from "./store";

/* ------------------------------------------------------------------ *
 * Leads offered to this vendor
 * ------------------------------------------------------------------ */

export interface VendorLeadCard {
  assignment: LeadDomainAssignment;
  leadDomain: LeadDomain;
  domain: Domain;
  leadReference: string;
  client: MaskedClientSummary;
  /** The client's own description of the job. */
  description: string;
  urgency: string;
  materialSource: LeadDomain["materialSource"];
  items: LeadDomainItem[];
  /** The brief our team captured on the call — the real scope. */
  brief: string | null;
  siteNotes: string[];
  budgetMax: Rupees | null;
  myQuote: Quote | null;
  visits: Meeting[];
  unreadMessages: number;
  /**
   * True where this vendor is one of several quoting. Stated plainly so nobody
   * assumes the job is theirs.
   */
  competingQuotes: number;
  /**
   * Decided here rather than in the UI. A screen comparing
   * `selectedProfessionalId` against a hardcoded "who am I" constant is a bug
   * waiting for the day that constant is wrong.
   */
  won: boolean;
  lost: boolean;
}

function toVendorLeadCard(assignment: LeadDomainAssignment, professionalId: string): VendorLeadCard {
  const leadDomain = store.leadDomains.find((ld) => ld.id === assignment.leadDomainId)!;
  const lead = store.leads.find((l) => l.id === leadDomain.leadId)!;
  // The brief is the last call where somebody actually spoke to the customer.
  // A "not reachable" note is an activity log, not scope, and must never be
  // handed to a vendor as the thing to quote against.
  const activity = store.leadSalesActivities
    .filter((a) => a.leadId === lead.id && a.callStatus === "connected")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  return {
    assignment,
    leadDomain,
    domain: domainById(leadDomain.domainId),
    leadReference: lead.reference,
    client: toMaskedClientSummary(lead.clientId, leadDomain.id),
    description: lead.description,
    urgency: lead.urgency,
    materialSource: leadDomain.materialSource,
    items: store.leadDomainItems.filter((i) => i.leadDomainId === leadDomain.id),
    brief: activity?.remarks ?? null,
    siteNotes: lead.siteAccessibilityTags,
    budgetMax: lead.budgetMax,
    myQuote:
      store.quotes.find(
        (q) => q.leadDomainId === leadDomain.id && q.professionalId === professionalId,
      ) ?? null,
    visits: store.meetings.filter(
      (m) => m.leadDomainId === leadDomain.id && m.professionalId === professionalId,
    ),
    unreadMessages: store.messages.filter(
      (m) =>
        m.leadDomainId === leadDomain.id &&
        m.channel === "platform_vendor" &&
        m.professionalId === professionalId &&
        m.senderRole === "platform" &&
        m.readAt === null,
    ).length,
    competingQuotes: store.quotes.filter(
      (q) => q.leadDomainId === leadDomain.id && q.professionalId !== professionalId,
    ).length,
    won: leadDomain.selectedProfessionalId === professionalId,
    lost:
      leadDomain.selectedProfessionalId !== null &&
      leadDomain.selectedProfessionalId !== professionalId,
  };
}

export async function listVendorLeads(
  filter: "all" | "new" | "quoting" | "won" | "lost" = "all",
): Promise<VendorLeadCard[]> {
  const professionalId = await currentProfessionalId();
  const cards = store.leadDomainAssignments
    .filter((a) => a.professionalId === professionalId)
    .map((a) => toVendorLeadCard(a, professionalId))
    .filter((card) => {
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
    })
    .sort((a, b) => b.assignment.assignedAt.localeCompare(a.assignment.assignedAt));

  return delay(cards);
}

export async function getVendorLead(leadDomainId: string): Promise<VendorLeadCard | null> {
  const professionalId = await currentProfessionalId();
  const assignment = store.leadDomainAssignments.find(
    (a) => a.leadDomainId === leadDomainId && a.professionalId === professionalId,
  );
  return delay(assignment ? toVendorLeadCard(assignment, professionalId) : null);
}

export async function respondToLead(
  leadDomainId: string,
  response: "accepted" | "rejected",
  reason?: string,
): Promise<void> {
  const professionalId = await currentProfessionalId();
  const assignment = store.leadDomainAssignments.find(
    (a) => a.leadDomainId === leadDomainId && a.professionalId === professionalId,
  );
  if (!assignment) throw new Error("Not assigned to this lead");
  assignment.responseStatus = response;
  assignment.respondedAt = nowIso();
  assignment.rejectionReason = reason ?? null;
  assignment.updatedAt = nowIso();
  return delay(undefined);
}

/* ------------------------------------------------------------------ *
 * Quoting
 * ------------------------------------------------------------------ */

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
 * Quotes are versioned because they get renegotiated. Submitting a revision
 * supersedes the previous one rather than overwriting it — the history is what
 * lets ops see how a price moved and why.
 */
export async function submitQuote(input: QuoteDraftInput): Promise<Quote> {
  const professionalId = await currentProfessionalId();
  const existing = store.quotes
    .filter((q) => q.leadDomainId === input.leadDomainId && q.professionalId === professionalId)
    .sort((a, b) => b.version - a.version)[0];

  const lineItems: QuoteLineItem[] = input.lineItems.map((line, i) => ({
    id: nextId(`li-${i}`),
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    rate: line.rate,
    amount: Math.round(line.quantity * line.rate),
  }));

  const subtotal = lineItems.reduce((sum, l) => sum + l.amount, 0);
  const taxAmount = Math.round((subtotal * input.taxPercent) / 100);

  const quote: Quote = {
    id: nextId("q"),
    leadDomainId: input.leadDomainId,
    professionalId,
    version: existing ? existing.version + 1 : 1,
    supersedesQuoteId: existing?.id ?? null,
    lineItems,
    subtotal,
    taxPercent: input.taxPercent,
    taxAmount,
    total: subtotal + taxAmount,
    timelineDays: input.timelineDays,
    warrantyMonths: input.warrantyMonths,
    warrantyDetails: input.warrantyDetails,
    materialsSummary: input.materialsSummary,
    boqUrl: null,
    quotePdfUrl: null,
    status: "submitted",
    notes: input.notes ?? null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    deletedAt: null,
  };

  if (existing) existing.status = "revised";
  store.quotes.push(quote);

  const leadDomain = store.leadDomains.find((ld) => ld.id === input.leadDomainId);
  if (leadDomain && leadDomain.status === "assigned") {
    leadDomain.status = "quoted";
    leadDomain.updatedAt = nowIso();
  }

  // The client is told a quote arrived, never given the vendor's number.
  const lead = store.leads.find((l) => l.id === leadDomain?.leadId);
  const client = store.clients.find((c) => c.id === lead?.clientId);
  const pro = store.professionals.find((p) => p.id === professionalId);
  if (client && pro) {
    store.notifications.push({
      id: nextId("ntf"),
      userId: client.userId,
      type: "quote_uploaded",
      title: `New quote from ${pro.companyName}`,
      body: "Compare it against the others side by side before you decide.",
      entityType: "quote",
      entityId: quote.id,
      isRead: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    });
  }

  return delay(quote);
}

/* ------------------------------------------------------------------ *
 * Dashboard, agreements, projects, money
 * ------------------------------------------------------------------ */

export interface VendorDashboard {
  professional: Professional;
  displayName: string;
  domains: Array<{ link: ProfessionalDomain; domain: Domain }>;
  newLeads: number;
  awaitingQuote: number;
  quotesOut: number;
  wonThisPeriod: number;
  liveProjects: number;
  visitsToday: number;
  commissionDue: Rupees;
  commissionOverdue: Rupees;
  unreadMessages: number;
}

export async function getVendorDashboard(): Promise<VendorDashboard> {
  const professionalId = await currentProfessionalId();
  const professional = seedRow(
    store.professionals.find((p) => p.id === professionalId),
    "professional",
    professionalId,
  );
  const user = store.users.find((u) => u.id === professional.userId)!;
  const cards = await listVendorLeads();
  const today = nowIso().slice(0, 10);

  const invoices = store.commissionInvoices.filter((i) => i.professionalId === professionalId);

  return delay({
    professional,
    displayName: user.name,
    domains: store.professionalDomains
      .filter((pd) => pd.professionalId === professionalId)
      .map((link) => ({ link, domain: domainById(link.domainId) })),
    newLeads: cards.filter((c) => c.assignment.responseStatus === "pending").length,
    awaitingQuote: cards.filter(
      (c) => c.assignment.responseStatus === "accepted" && !c.myQuote,
    ).length,
    quotesOut: cards.filter(
      (c) => c.myQuote && c.leadDomain.selectedProfessionalId === null,
    ).length,
    wonThisPeriod: cards.filter((c) => c.won)
      .length,
    liveProjects: store.projects.filter(
      (p) => p.professionalId === professionalId && p.status === "ongoing",
    ).length,
    visitsToday: store.meetings.filter(
      (m) => m.professionalId === professionalId && m.scheduledAt.slice(0, 10) === today,
    ).length,
    commissionDue: invoices
      .filter((i) => i.status === "pending")
      .reduce((sum, i) => sum + i.amount, 0),
    commissionOverdue: invoices
      .filter((i) => i.status === "overdue")
      .reduce((sum, i) => sum + i.amount, 0),
    unreadMessages: cards.reduce((sum, c) => sum + c.unreadMessages, 0),
  });
}

export interface VendorAgreementView {
  agreement: Agreement;
  client: MaskedClientSummary;
  lines: Array<{ link: AgreementLeadDomain; domain: Domain; quote: Quote }>;
  isCombined: boolean;
  projects: Array<{ project: Project; domain: Domain }>;
  invoice: CommissionInvoice | null;
}

export async function listVendorAgreements(): Promise<VendorAgreementView[]> {
  const professionalId = await currentProfessionalId();
  return delay(
    store.agreements
      .filter((a) => a.professionalId === professionalId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((agreement) => {
        const links = store.agreementLeadDomains.filter((l) => l.agreementId === agreement.id);
        return {
          agreement,
          client: toMaskedClientSummary(agreement.clientId),
          lines: links.map((link) => {
            const leadDomain = store.leadDomains.find((ld) => ld.id === link.leadDomainId)!;
            return {
              link,
              domain: domainById(leadDomain.domainId),
              quote: store.quotes.find((q) => q.id === link.quoteId)!,
            };
          }),
          isCombined: links.length > 1,
          projects: store.projects
            .filter((p) => p.agreementId === agreement.id)
            .map((project) => {
              const leadDomain = store.leadDomains.find((ld) => ld.id === project.leadDomainId)!;
              return { project, domain: domainById(leadDomain.domainId) };
            }),
          invoice:
            store.commissionInvoices.find((i) => i.agreementId === agreement.id) ?? null,
        };
      }),
  );
}

export interface VendorProjectView {
  project: Project;
  domain: Domain;
  client: MaskedClientSummary;
  cityName: string;
  review: Review | null;
}

export async function listVendorProjects(): Promise<VendorProjectView[]> {
  const professionalId = await currentProfessionalId();
  return delay(
    store.projects
      .filter((p) => p.professionalId === professionalId)
      .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""))
      .map((project) => {
        const leadDomain = store.leadDomains.find((ld) => ld.id === project.leadDomainId)!;
        const lead = store.leads.find((l) => l.id === leadDomain.leadId)!;
        return {
          project,
          domain: domainById(leadDomain.domainId),
          client: toMaskedClientSummary(project.clientId, leadDomain.id),
          cityName: cityById(lead.cityId).name,
          review: store.reviews.find((r) => r.projectId === project.id) ?? null,
        };
      }),
  );
}

export async function updateProjectProgress(
  projectId: string,
  completionPercent: number,
  milestoneId?: string,
): Promise<void> {
  const project = store.projects.find((p) => p.id === projectId);
  if (!project) throw new Error("Unknown project");

  project.completionPercent = Math.max(0, Math.min(100, completionPercent));
  if (milestoneId) {
    const milestone = project.milestones.find((m) => m.id === milestoneId);
    if (milestone && !milestone.completedAt) milestone.completedAt = nowIso();
  }
  if (project.completionPercent === 100 && project.status === "ongoing") {
    project.status = "completed";
    project.actualEndDate = nowIso().slice(0, 10);

    const leadDomain = store.leadDomains.find((ld) => ld.id === project.leadDomainId);
    if (leadDomain) leadDomain.status = "completed";
  }
  project.updatedAt = nowIso();
  return delay(undefined);
}

export async function listVendorInvoices(): Promise<
  Array<{ invoice: CommissionInvoice; agreementReference: string; domains: string[] }>
> {
  const professionalId = await currentProfessionalId();
  return delay(
    store.commissionInvoices
      .filter((i) => i.professionalId === professionalId)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((invoice) => {
        const agreement = store.agreements.find((a) => a.id === invoice.agreementId);
        const links = store.agreementLeadDomains.filter(
          (l) => l.agreementId === invoice.agreementId,
        );
        return {
          invoice,
          agreementReference: agreement?.reference ?? "—",
          domains: links.map((l) => {
            const ld = store.leadDomains.find((x) => x.id === l.leadDomainId);
            return ld ? domainById(ld.domainId).name : "";
          }),
        };
      }),
  );
}

/* ------------------------------------------------------------------ *
 * Messages, portfolio, performance
 * ------------------------------------------------------------------ */

/** Their thread with our team for one lead. They never see the client thread. */
export async function listVendorThread(leadDomainId: string): Promise<Message[]> {
  const professionalId = await currentProfessionalId();
  return delay(
    store.messages
      .filter(
        (m) =>
          m.leadDomainId === leadDomainId &&
          m.channel === "platform_vendor" &&
          m.professionalId === professionalId,
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  );
}

export async function sendVendorMessage(leadDomainId: string, body: string): Promise<Message> {
  const professionalId = await currentProfessionalId();
  const message: Message = {
    id: nextId("msg"),
    leadDomainId,
    channel: "platform_vendor",
    senderRole: "professional",
    senderId: professionalId,
    professionalId,
    body,
    attachmentUrl: null,
    readAt: null,
    relayedFromMessageId: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    deletedAt: null,
  };
  store.messages.push(message);
  return delay(message);
}

export async function listVendorPortfolio(): Promise<PortfolioItem[]> {
  const professionalId = await currentProfessionalId();
  return delay(store.portfolioItems.filter((p) => p.professionalId === professionalId));
}

export interface VendorPerformance {
  byDomain: Array<{
    domain: Domain;
    rating: number;
    ratingCount: number;
    completed: number;
    won: number;
    lost: number;
    winRatePercent: number;
    commissionPercent: number;
  }>;
  avgResponseHours: number;
  totalRevenue: Rupees;
  reviews: Array<{ review: Review; domain: Domain; clientName: string }>;
}

export async function getVendorPerformance(): Promise<VendorPerformance> {
  const professionalId = await currentProfessionalId();
  const links = store.professionalDomains.filter((pd) => pd.professionalId === professionalId);
  const professional = seedRow(
    store.professionals.find((p) => p.id === professionalId),
    "professional",
    professionalId,
  );

  const byDomain = links.map((link) => {
    const domain = domainById(link.domainId);
    const assignments = store.leadDomainAssignments.filter((a) => {
      if (a.professionalId !== professionalId) return false;
      const ld = store.leadDomains.find((l) => l.id === a.leadDomainId);
      return ld?.domainId === link.domainId;
    });
    const won = assignments.filter((a) => {
      const ld = store.leadDomains.find((l) => l.id === a.leadDomainId);
      return ld?.selectedProfessionalId === professionalId;
    }).length;
    const lost = assignments.filter((a) => {
      const ld = store.leadDomains.find((l) => l.id === a.leadDomainId);
      return ld?.selectedProfessionalId && ld.selectedProfessionalId !== professionalId;
    }).length;

    return {
      domain,
      rating: link.avgRating,
      ratingCount: link.ratingCount,
      completed: link.completedProjects,
      won,
      lost,
      winRatePercent: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0,
      commissionPercent: link.commissionPercentOverride ?? domain.defaultCommissionPercent,
    };
  });

  return delay({
    byDomain,
    avgResponseHours: professional.avgResponseHours,
    totalRevenue: store.projects
      .filter((p) => p.professionalId === professionalId)
      .reduce((sum, p) => sum + p.value, 0),
    reviews: store.reviews
      .filter((r) => r.professionalId === professionalId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((review) => {
        const client = store.clients.find((c) => c.id === review.clientId);
        const user = store.users.find((u) => u.id === client?.userId);
        const first = (user?.name ?? "Customer").split(" ")[0];
        return { review, domain: domainById(review.domainId), clientName: first };
      }),
  });
}

export async function listVendorVisits(): Promise<
  Array<{ meeting: Meeting; domain: Domain; client: MaskedClientSummary; leadReference: string }>
> {
  const professionalId = await currentProfessionalId();
  return delay(
    store.meetings
      .filter((m) => m.professionalId === professionalId)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
      .map((meeting) => {
        const leadDomain = store.leadDomains.find((ld) => ld.id === meeting.leadDomainId)!;
        const lead = store.leads.find((l) => l.id === leadDomain.leadId)!;
        return {
          meeting,
          domain: domainById(leadDomain.domainId),
          client: toMaskedClientSummary(lead.clientId, leadDomain.id),
          leadReference: lead.reference,
        };
      }),
  );
}
