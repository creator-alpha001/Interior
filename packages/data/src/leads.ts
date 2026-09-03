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
import { ApiError, api } from "./client";
import { toAgreementView, toLeadView, toProjectView } from "./mappers";
import { callingApiAsUser, currentAgentId, currentClientId, currentUserId } from "./session";
import { delay, nextId, nowIso, store } from "./store";

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

export async function listLeadsForClient(): Promise<LeadView[]> {
  if (await callingApiAsUser()) return api<LeadView[]>("/me/requirements");

  const clientId = await currentClientId();
  return delay(
    store.leads
      .filter((l) => l.clientId === clientId && l.overallStatus !== "archived")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((l) => toLeadView(l.id)),
  );
}

/**
 * One requirement.
 *
 * Returns null where it does not exist *or* is not this customer's — the API
 * answers 404 to both, on purpose. A 403 would confirm the record exists, which
 * is more than somebody guessing ids should learn.
 */
export async function getLead(leadId: string): Promise<LeadView | null> {
  if (await callingApiAsUser()) {
    try {
      return await api<LeadView>(`/me/requirements/${encodeURIComponent(leadId)}`);
    } catch (error) {
      if (error instanceof ApiError && error.isNotFound) return null;
      throw error;
    }
  }

  const exists = store.leads.some((l) => l.id === leadId);
  return delay(exists ? toLeadView(leadId) : null);
}

export async function listAgreementsForClient(): Promise<AgreementView[]> {
  if (await callingApiAsUser()) return api<AgreementView[]>("/me/agreements");

  const clientId = await currentClientId();
  return delay(
    store.agreements
      .filter((a) => a.clientId === clientId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((a) => toAgreementView(a.id)),
  );
}

export async function getAgreement(agreementId: string): Promise<AgreementView | null> {
  if (await callingApiAsUser()) {
    // No endpoint of its own: an agreement list is small and always loaded
    // alongside, so a second round trip buys nothing.
    const all = await listAgreementsForClient();
    return all.find((a) => a.agreement.id === agreementId) ?? null;
  }

  const exists = store.agreements.some((a) => a.id === agreementId);
  return delay(exists ? toAgreementView(agreementId) : null);
}

export async function listProjectsForClient(): Promise<ProjectView[]> {
  if (await callingApiAsUser()) return api<ProjectView[]>("/me/projects");

  const clientId = await currentClientId();
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
  if (await callingApiAsUser()) {
    return api<Message[]>(`/me/services/${encodeURIComponent(leadDomainId)}/messages`);
  }

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
export async function sendClientMessage(leadDomainId: string, body: string): Promise<Message> {
  if (await callingApiAsUser()) {
    return api<Message>(`/me/services/${encodeURIComponent(leadDomainId)}/messages`, {
      method: "POST",
      body: { body },
    });
  }

  const clientId = await currentClientId();
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
  body: string,
  sourceMessageId?: string,
): Promise<Message[]> {
  const agentId = await currentAgentId();
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
  body: string,
  sourceMessageId?: string,
): Promise<Message> {
  const agentId = await currentAgentId();
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

export async function listNotifications(): Promise<Notification[]> {
  if (await callingApiAsUser()) return api<Notification[]>("/me/notifications");

  const userId = await currentUserId();
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
  /** Assets already uploaded through `uploadFile`; ids, never bytes. */
  photoIds?: string[];
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
}

/**
 * Creates one lead plus one lead_domain per selected service. A single dining
 * table and a full multi-trade renovation both come through here — the only
 * difference is how many lead_domain rows get written.
 */
export async function submitRequirement(
  input: RequirementInput,
  /**
   * A session cookie to use instead of the request's own.
   *
   * The public form verifies a mobile number as its last step, so the account
   * comes into existence moments before the requirement is written. Passing the
   * cookie through means both happen in one action, rather than redirecting to
   * sign in and losing everything the visitor just typed.
   */
  options: { cookie?: string } = {},
): Promise<LeadView> {
  if (await callingApiAsUser()) {
    return api<LeadView>("/me/requirements", {
      method: "POST",
      body: {
        cityId: input.cityId,
        domainIds: input.domainIds,
        description: input.description,
        urgency: input.urgency,
        materialSource: input.materialSource,
        siteAccessibilityTags: input.siteAccessibilityTags,
        budgetMin: input.budgetMin,
        budgetMax: input.budgetMax,
        preferredProfessionalId: input.preferredProfessionalId,
        photoIds: input.photoIds,
        catalogueItems: input.catalogueItems,
      },
      ...(options.cookie ? { headers: { cookie: options.cookie } } : {}),
    });
  }

  const clientId = await currentClientId();
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
  if (await callingApiAsUser()) {
    return api<LeadView>(`/me/services/${encodeURIComponent(leadDomainId)}/select-quote`, {
      method: "POST",
      body: { quoteId },
    });
  }

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
  if (await callingApiAsUser()) {
    return api<AgreementView[]>(`/me/requirements/${encodeURIComponent(leadId)}/agreements`, {
      method: "POST",
      body: {},
    });
  }

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
