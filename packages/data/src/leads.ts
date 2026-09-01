import type {
  AgreementView,
  ID,
  Lead,
  LeadStatus,
  LeadView,
  MaterialSource,
  Message,
  Notification,
  ProjectView,
  SiteAccessibilityTag,
  Urgency,
} from "@repo/types";
import { toAgreementView, toLeadView, toProjectView } from "./mappers";
import { delay, demoClientId, nextId, nowIso, store } from "./store";

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

export async function listLeadsForClient(clientId = demoClientId): Promise<LeadView[]> {
  return delay(
    store.leads
      .filter((l) => l.clientId === clientId && l.overallStatus !== "archived")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((l) => toLeadView(l.id)),
  );
}

export async function getLead(leadId: string): Promise<LeadView | null> {
  const exists = store.leads.some((l) => l.id === leadId);
  return delay(exists ? toLeadView(leadId) : null);
}

export async function listAgreementsForClient(
  clientId = demoClientId,
): Promise<AgreementView[]> {
  return delay(
    store.agreements
      .filter((a) => a.clientId === clientId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((a) => toAgreementView(a.id)),
  );
}

export async function getAgreement(agreementId: string): Promise<AgreementView | null> {
  const exists = store.agreements.some((a) => a.id === agreementId);
  return delay(exists ? toAgreementView(agreementId) : null);
}

export async function listProjectsForClient(clientId = demoClientId): Promise<ProjectView[]> {
  return delay(
    store.projects
      .filter((p) => p.clientId === clientId)
      .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""))
      .map((p) => toProjectView(p.id)),
  );
}

/**
 * The client's thread with the platform for one service. Vendor threads are a
 * separate channel and are never returned to a client-facing screen — there is
 * no query here that hands a client a vendor's words unmediated.
 */
export async function listClientMessages(leadDomainId: string): Promise<Message[]> {
  return delay(
    store.messages
      .filter((m) => m.leadDomainId === leadDomainId && m.channel === "client_platform")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  );
}

/** The platform's thread with one specific vendor, for the vendor panel and ops. */
export async function listVendorMessages(
  leadDomainId: string,
  professionalId: string,
): Promise<Message[]> {
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

/** A client writing in. Always lands in the platform thread. */
export async function sendClientMessage(
  leadDomainId: string,
  clientId: string,
  body: string,
): Promise<Message> {
  return delay(
    push({
      leadDomainId,
      channel: "client_platform",
      senderRole: "client",
      senderId: clientId,
      professionalId: null,
      body,
    }),
  );
}

/**
 * Our team relaying a client's question out to the assigned vendors, or a
 * vendor's answer back to the client. One question can go to all three vendors
 * at once, which is the point of routing through us rather than one-to-one.
 */
export async function relayToVendors(
  leadDomainId: string,
  agentId: string,
  body: string,
  sourceMessageId?: string,
): Promise<Message[]> {
  const vendorIds = store.leadDomainAssignments
    .filter((a) => a.leadDomainId === leadDomainId && a.responseStatus === "accepted")
    .map((a) => a.professionalId);

  return delay(
    vendorIds.map((professionalId) =>
      push({
        leadDomainId,
        channel: "platform_vendor",
        senderRole: "platform",
        senderId: agentId,
        professionalId,
        body,
        relayedFromMessageId: sourceMessageId ?? null,
      }),
    ),
  );
}

export async function replyToClient(
  leadDomainId: string,
  agentId: string,
  body: string,
  sourceMessageId?: string,
): Promise<Message> {
  return delay(
    push({
      leadDomainId,
      channel: "client_platform",
      senderRole: "platform",
      senderId: agentId,
      professionalId: null,
      body,
      relayedFromMessageId: sourceMessageId ?? null,
    }),
  );
}

function push(
  input: Pick<
    Message,
    "leadDomainId" | "channel" | "senderRole" | "senderId" | "professionalId" | "body"
  > & { relayedFromMessageId?: ID | null },
): Message {
  const message: Message = {
    id: nextId("msg"),
    attachmentUrl: null,
    readAt: null,
    relayedFromMessageId: input.relayedFromMessageId ?? null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    deletedAt: null,
    ...input,
  };
  store.messages.push(message);
  return message;
}

export async function listNotifications(userId: string): Promise<Notification[]> {
  return delay(
    store.notifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

/* ------------------------------------------------------------------ *
 * Submit requirement — the lean multi-select form
 * ------------------------------------------------------------------ */

export interface RequirementInput {
  name: string;
  mobile: string;
  cityId: string;
  /** One or more domain ids — this drives everything downstream. */
  domainIds: string[];
  description: string;
  urgency: Urgency;
  /** Asked once per selected domain: who supplies the material. */
  materialSource: Record<string, MaterialSource>;
  siteAccessibilityTags?: SiteAccessibilityTag[];
  budgetMin?: number | null;
  budgetMax?: number | null;
  /**
   * A professional the client asked for by name. Recorded as a preference on
   * every selected service that professional is approved for — ops honour it
   * where they can, and say so where they cannot.
   */
  preferredProfessionalId?: string | null;
  /** Optional catalogue selection that started this requirement. */
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
  clientId?: string;
}

/**
 * Creates one lead plus one lead_domain per selected service. A single dining
 * table and a full multi-trade renovation both come through here — the only
 * difference is how many lead_domain rows get written.
 */
export async function submitRequirement(input: RequirementInput): Promise<LeadView> {
  const clientId = input.clientId ?? demoClientId;
  const leadId = nextId("lead");
  const sequence = 1062 + store.leads.filter((l) => l.id.startsWith("lead-1")).length;

  const lead: Lead = {
    id: leadId,
    reference: `LD-${sequence}`,
    clientId,
    cityId: input.cityId,
    description: input.description,
    urgency: input.urgency,
    budgetMin: input.budgetMin ?? null,
    budgetMax: input.budgetMax ?? null,
    siteAccessibilityTags: input.siteAccessibilityTags ?? [],
    photos: [],
    source: input.catalogueItems?.length ? "catalogue" : "app",
    overallStatus: "new",
    assignedSalesAgentId: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    deletedAt: null,
  };
  store.leads.unshift(lead);

  for (const domainId of input.domainIds) {
    const leadDomainId = nextId("ldom");

    // The preference only applies where that professional is actually approved
    // for the service — asking for a painter on a fabrication job is not a
    // request we can act on.
    const preferred =
      input.preferredProfessionalId &&
      store.professionalDomains.some(
        (pd) =>
          pd.professionalId === input.preferredProfessionalId &&
          pd.domainId === domainId &&
          pd.verificationStatus === "approved",
      )
        ? input.preferredProfessionalId
        : null;

    store.leadDomains.push({
      id: leadDomainId,
      leadId,
      domainId,
      materialSource: input.materialSource[domainId] ?? "undecided",
      status: "pending_assignment",
      preferredProfessionalId: preferred,
      preferenceUnmetReason: null,
      selectedProfessionalId: null,
      selectedQuoteId: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    });

    for (const item of input.catalogueItems ?? []) {
      if (item.domainId !== domainId) continue;
      store.leadDomainItems.push({
        id: nextId("ldi"),
        leadDomainId,
        productId: item.productId ?? null,
        packageId: item.packageId ?? null,
        itemName: item.itemName,
        quantity: item.quantity,
        selectedOptions: item.selectedOptions ?? {},
        indicativePrice: item.indicativePrice ?? null,
        customerNotes: item.notes ?? null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        deletedAt: null,
      });
    }
  }

  return delay(toLeadView(leadId));
}

/* ------------------------------------------------------------------ *
 * Selecting a professional, and the agreement grouping rule
 * ------------------------------------------------------------------ */

/** Records the client's choice of vendor for one service of their requirement. */
export async function selectQuote(leadDomainId: string, quoteId: string): Promise<LeadView> {
  const leadDomain = store.leadDomains.find((ld) => ld.id === leadDomainId);
  const quote = store.quotes.find((q) => q.id === quoteId);
  if (!leadDomain || !quote) throw new Error("Unknown lead domain or quote");

  leadDomain.selectedProfessionalId = quote.professionalId;
  leadDomain.selectedQuoteId = quoteId;
  leadDomain.status = "vendor_selected";
  leadDomain.updatedAt = nowIso();

  for (const q of store.quotes.filter((q) => q.leadDomainId === leadDomainId)) {
    q.status = q.id === quoteId ? "selected" : "rejected";
  }

  recomputeLeadStatus(leadDomain.leadId);
  return delay(toLeadView(leadDomain.leadId));
}

/**
 * Generates agreements for a lead, grouped by professional — the business rule
 * at the heart of the platform:
 *
 *   different professionals across domains -> one agreement each
 *   same professional across domains       -> a single combined agreement
 *
 * Called once every domain of the lead has a selected vendor.
 */
export async function generateAgreements(leadId: string): Promise<AgreementView[]> {
  const lead = store.leads.find((l) => l.id === leadId);
  if (!lead) throw new Error("Unknown lead");

  const selected = store.leadDomains.filter(
    (ld) => ld.leadId === leadId && ld.selectedProfessionalId && ld.selectedQuoteId,
  );

  const byProfessional = new Map<string, typeof selected>();
  for (const ld of selected) {
    const list = byProfessional.get(ld.selectedProfessionalId!) ?? [];
    list.push(ld);
    byProfessional.set(ld.selectedProfessionalId!, list);
  }

  const created: string[] = [];
  let index = store.agreements.filter((a) => a.leadId === leadId).length;

  for (const [professionalId, leadDomainsForPro] of byProfessional) {
    const already = store.agreements.some(
      (a) => a.leadId === leadId && a.professionalId === professionalId && a.status !== "cancelled",
    );
    if (already) continue;

    index += 1;
    const agreementId = nextId("agr");
    const lines = leadDomainsForPro.map((ld) => {
      const quote = store.quotes.find((q) => q.id === ld.selectedQuoteId)!;
      return { leadDomainId: ld.id, quoteId: quote.id, value: quote.total };
    });
    const totalValue = lines.reduce((sum, l) => sum + l.value, 0);

    store.agreements.push({
      id: agreementId,
      reference: `${lead.reference.replace("LD-", "AGR-")}-${String(index).padStart(2, "0")}`,
      leadId,
      clientId: lead.clientId,
      professionalId,
      totalValue,
      paymentTerms: "30% advance on signing, 40% at midpoint, 30% on handover.",
      status: "draft",
      documentUrl: null,
      sentAt: null,
      signedAt: null,
      startDate: null,
      cancelledReason: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    });

    for (const line of lines) {
      store.agreementLeadDomains.push({
        id: nextId("ald"),
        agreementId,
        leadDomainId: line.leadDomainId,
        quoteId: line.quoteId,
        value: line.value,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        deletedAt: null,
      });
    }

    created.push(agreementId);
  }

  return delay(created.map((id) => toAgreementView(id)));
}

/**
 * `leads.overallStatus` is derived from its lead_domains, never set directly.
 * This is the single place that rule lives.
 */
export function recomputeLeadStatus(leadId: string): LeadStatus {
  const lead = store.leads.find((l) => l.id === leadId);
  if (!lead) return "new";
  if (lead.overallStatus === "archived") return "archived";

  const domainRows = store.leadDomains.filter((ld) => ld.leadId === leadId);
  const statuses = domainRows.map((d) => d.status);

  let next: LeadStatus;
  if (statuses.length === 0) next = "new";
  else if (statuses.every((s) => s === "completed" || s === "cancelled")) next = "closed";
  else if (statuses.some((s) => s !== "pending_assignment")) next = "in_progress";
  else next = lead.assignedSalesAgentId ? "verified" : "new";

  lead.overallStatus = next;
  lead.updatedAt = nowIso();
  return next;
}
