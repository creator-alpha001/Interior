/**
 * Queries and actions for internal staff — sales agents and admins.
 *
 * Kept in its own module because the access boundary is real: these functions
 * see client contact details, every vendor thread, and commission figures, none
 * of which may leak into a client or vendor payload.
 */
import type {
  City,
  Domain,
  LeadDomainStatus,
  LeadSalesActivity,
  LeadStatus,
  LeadView,
  Meeting,
  MeetingType,
  Message,
  ProfessionalSummary,
  Urgency,
} from "@repo/types";
import { cityById, domainById, toLeadView, toProfessionalSummary } from "./mappers";
import { hasSignedPartnerAgreementSync } from "./onboarding";
import { recomputeLeadStatus } from "./leads";
import { currentAgentId } from "./session";
import { delay, nextId, nowIso, store } from "./store";

/* ------------------------------------------------------------------ *
 * Lead queue
 * ------------------------------------------------------------------ */

export interface OpsLeadFilters {
  status?: LeadStatus | "all";
  domainSlug?: string;
  cityId?: string;
  urgency?: Urgency;
  agentId?: string;
  search?: string;
  /** Only leads with at least one service still awaiting assignment. */
  needsAssignment?: boolean;
}

export interface OpsLeadRow {
  lead: LeadView;
  agentName: string | null;
  lastActivity: LeadSalesActivity | null;
  followUpDate: string | null;
  /** Services still waiting on us to assign professionals. */
  unassignedDomains: number;
  /** Client questions with no reply from us yet. */
  awaitingReply: number;
  ageDays: number;
}

export async function listOpsLeads(filters: OpsLeadFilters = {}): Promise<OpsLeadRow[]> {
  const domain = filters.domainSlug
    ? store.domains.find((d) => d.slug === filters.domainSlug)
    : undefined;
  const search = filters.search?.trim().toLowerCase();

  const rows = store.leads
    .filter((lead) => {
      if (filters.status && filters.status !== "all" && lead.overallStatus !== filters.status)
        return false;
      if (filters.cityId && lead.cityId !== filters.cityId) return false;
      if (filters.urgency && lead.urgency !== filters.urgency) return false;
      if (filters.agentId && lead.assignedSalesAgentId !== filters.agentId) return false;

      const domainRows = store.leadDomains.filter((ld) => ld.leadId === lead.id);
      if (domain && !domainRows.some((ld) => ld.domainId === domain.id)) return false;
      if (
        filters.needsAssignment &&
        !domainRows.some((ld) => ld.status === "pending_assignment")
      )
        return false;

      if (search) {
        const client = store.clients.find((c) => c.id === lead.clientId);
        const user = store.users.find((u) => u.id === client?.userId);
        const haystack =
          `${lead.reference} ${lead.description} ${user?.name ?? ""} ${user?.mobile ?? ""}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    })
    .map((lead) => toOpsLeadRow(lead.id));

  // Urgent first, then oldest — the queue a coordinator should work top-down.
  const urgencyWeight: Record<Urgency, number> = {
    immediate: 0,
    within_month: 1,
    exploring: 2,
  };
  rows.sort(
    (a, b) =>
      urgencyWeight[a.lead.lead.urgency] - urgencyWeight[b.lead.lead.urgency] ||
      b.ageDays - a.ageDays,
  );

  return delay(rows);
}

function toOpsLeadRow(leadId: string): OpsLeadRow {
  const lead = toLeadView(leadId);
  const activities = store.leadSalesActivities
    .filter((a) => a.leadId === leadId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const agent = lead.lead.assignedSalesAgentId
    ? store.salesAgents.find((s) => s.id === lead.lead.assignedSalesAgentId)
    : undefined;
  const agentUser = agent ? store.users.find((u) => u.id === agent.userId) : undefined;

  const leadDomainIds = lead.domains.map((d) => d.leadDomain.id);

  // A client message is "awaiting reply" if nothing from us followed it.
  let awaitingReply = 0;
  for (const id of leadDomainIds) {
    const thread = store.messages
      .filter((m) => m.leadDomainId === id && m.channel === "client_platform")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const last = thread[thread.length - 1];
    if (last?.senderRole === "client") awaitingReply += 1;
  }

  return {
    lead,
    agentName: agentUser?.name ?? null,
    lastActivity: activities[0] ?? null,
    followUpDate: activities.find((a) => a.followUpDate)?.followUpDate ?? null,
    unassignedDomains: lead.domains.filter(
      (d) => d.leadDomain.status === "pending_assignment",
    ).length,
    awaitingReply,
    ageDays: Math.max(
      0,
      Math.round((Date.now() - new Date(lead.lead.createdAt).getTime()) / 86_400_000),
    ),
  };
}

export async function getOpsLead(leadId: string): Promise<OpsLeadRow | null> {
  const exists = store.leads.some((l) => l.id === leadId);
  return delay(exists ? toOpsLeadRow(leadId) : null);
}

/* ------------------------------------------------------------------ *
 * The relay — the screen the team lives in
 * ------------------------------------------------------------------ */

export interface RelayThread {
  professional: ProfessionalSummary;
  messages: Message[];
  /** True when their last message has had no reply from us. */
  awaitingReply: boolean;
}

export interface RelayView {
  leadDomainId: string;
  domain: Domain;
  clientName: string;
  clientThread: Message[];
  clientAwaitingReply: boolean;
  vendorThreads: RelayThread[];
}

/**
 * Both sides of one service, side by side. The client thread on the left, one
 * thread per assigned vendor on the right — because a question asked once
 * should go to all of them, not to whichever vendor happened to ask.
 */
export async function getRelay(leadDomainId: string): Promise<RelayView | null> {
  const leadDomain = store.leadDomains.find((ld) => ld.id === leadDomainId);
  if (!leadDomain) return delay(null);

  const lead = store.leads.find((l) => l.id === leadDomain.leadId)!;
  const client = store.clients.find((c) => c.id === lead.clientId)!;
  const clientUser = store.users.find((u) => u.id === client.userId)!;

  const clientThread = store.messages
    .filter((m) => m.leadDomainId === leadDomainId && m.channel === "client_platform")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const vendorThreads = store.leadDomainAssignments
    .filter((a) => a.leadDomainId === leadDomainId && a.responseStatus !== "rejected")
    .map((assignment) => {
      const messages = store.messages
        .filter(
          (m) =>
            m.leadDomainId === leadDomainId &&
            m.channel === "platform_vendor" &&
            m.professionalId === assignment.professionalId,
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return {
        professional: toProfessionalSummary(assignment.professionalId, leadDomain.domainId),
        messages,
        awaitingReply: messages[messages.length - 1]?.senderRole === "professional",
      };
    });

  return delay({
    leadDomainId,
    domain: domainById(leadDomain.domainId),
    clientName: clientUser.name,
    clientThread,
    clientAwaitingReply: clientThread[clientThread.length - 1]?.senderRole === "client",
    vendorThreads,
  });
}

/* ------------------------------------------------------------------ *
 * Assignment — manual, after the coordinator has called round
 * ------------------------------------------------------------------ */

export interface VendorPoolEntry {
  professional: ProfessionalSummary;
  /** Already assigned to this lead-domain. */
  isAssigned: boolean;
  /** The client asked for this one by name. */
  isPreferred: boolean;
  /** How many other live leads they are already quoting on. */
  activeLoad: number;
}

/**
 * Everyone eligible for this service in this city, ranked so the coordinator
 * has a shortlist to call rather than a raw list. Nothing is auto-assigned.
 */
export async function getVendorPool(leadDomainId: string): Promise<VendorPoolEntry[]> {
  const leadDomain = store.leadDomains.find((ld) => ld.id === leadDomainId);
  if (!leadDomain) return delay([]);
  const lead = store.leads.find((l) => l.id === leadDomain.leadId)!;

  const eligible = store.professionals.filter((pro) => {
    const approved = store.professionalDomains.some(
      (pd) =>
        pd.professionalId === pro.id &&
        pd.domainId === leadDomain.domainId &&
        pd.verificationStatus === "approved",
    );
    const serves = store.professionalServiceAreas.some(
      (a) => a.professionalId === pro.id && a.cityId === lead.cityId,
    );
    // Signing the partner agreement is what makes a vendor assignable. An
    // approved trade on an unsigned account is not enough.
    return (
      approved &&
      serves &&
      pro.verificationStatus === "verified" &&
      hasSignedPartnerAgreementSync(pro.id)
    );
  });

  const assignedIds = new Set(
    store.leadDomainAssignments
      .filter((a) => a.leadDomainId === leadDomainId)
      .map((a) => a.professionalId),
  );

  const entries = eligible.map((pro) => {
    const link = store.professionalDomains.find(
      (pd) => pd.professionalId === pro.id && pd.domainId === leadDomain.domainId,
    );
    return {
      professional: toProfessionalSummary(pro.id, leadDomain.domainId),
      isAssigned: assignedIds.has(pro.id),
      isPreferred: leadDomain.preferredProfessionalId === pro.id,
      activeLoad: store.leadDomainAssignments.filter((a) => {
        if (a.professionalId !== pro.id || a.responseStatus === "rejected") return false;
        const other = store.leadDomains.find((ld) => ld.id === a.leadDomainId);
        return other && ["assigned", "quoted"].includes(other.status);
      }).length,
      rating: link?.avgRating ?? pro.avgRating,
    };
  });

  // Requested vendors first, then rating, then whoever is least loaded.
  entries.sort(
    (a, b) =>
      Number(b.isPreferred) - Number(a.isPreferred) ||
      b.rating - a.rating ||
      a.activeLoad - b.activeLoad,
  );

  return delay(entries.map(({ rating: _rating, ...entry }) => entry));
}

export async function assignProfessionals(
  leadDomainId: string,
  professionalIds: string[],
): Promise<void> {
  const leadDomain = store.leadDomains.find((ld) => ld.id === leadDomainId);
  if (!leadDomain) throw new Error("Unknown lead domain");

  for (const professionalId of professionalIds) {
    if (
      store.leadDomainAssignments.some(
        (a) => a.leadDomainId === leadDomainId && a.professionalId === professionalId,
      )
    )
      continue;

    store.leadDomainAssignments.push({
      id: nextId("asg"),
      leadDomainId,
      professionalId,
      // The coordinator only assigns after the vendor has confirmed by phone.
      responseStatus: "accepted",
      assignedAt: nowIso(),
      respondedAt: nowIso(),
      rejectionReason: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    });

    const pro = store.professionals.find((p) => p.id === professionalId);
    if (pro) {
      store.notifications.push({
        id: nextId("ntf"),
        userId: pro.userId,
        type: "new_lead",
        title: `New ${domainById(leadDomain.domainId).name.toLowerCase()} lead assigned`,
        body: "Scope and site details are on the lead. Contact is coordinated by our team.",
        entityType: "lead_domain",
        entityId: leadDomainId,
        isRead: false,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        deletedAt: null,
      });
    }
  }

  if (store.leadDomainAssignments.some((a) => a.leadDomainId === leadDomainId)) {
    leadDomain.status = "assigned";
    leadDomain.updatedAt = nowIso();
  }

  // If the client asked for someone we did not assign, that has to be said.
  if (
    leadDomain.preferredProfessionalId &&
    !professionalIds.includes(leadDomain.preferredProfessionalId) &&
    !leadDomain.preferenceUnmetReason
  ) {
    leadDomain.preferenceUnmetReason =
      "They were not available for this job, so we assigned three others.";
  }

  const lead = store.leads.find((l) => l.id === leadDomain.leadId);
  if (lead) {
    store.notifications.push({
      id: nextId("ntf"),
      userId: store.clients.find((c) => c.id === lead.clientId)!.userId,
      type: "professional_assigned",
      title: `${professionalIds.length} professionals assigned for ${
        domainById(leadDomain.domainId).name
      }`,
      body: "They will visit, measure and send you a written quote to compare.",
      entityType: "lead_domain",
      entityId: leadDomainId,
      isRead: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    });
  }

  recomputeLeadStatus(leadDomain.leadId);
  return delay(undefined);
}

export async function setLeadDomainStatus(
  leadDomainId: string,
  status: LeadDomainStatus,
): Promise<void> {
  const leadDomain = store.leadDomains.find((ld) => ld.id === leadDomainId);
  if (!leadDomain) throw new Error("Unknown lead domain");
  leadDomain.status = status;
  leadDomain.updatedAt = nowIso();
  recomputeLeadStatus(leadDomain.leadId);
  return delay(undefined);
}

/* ------------------------------------------------------------------ *
 * Call logging and visits
 * ------------------------------------------------------------------ */

export interface CallLogInput {
  leadId: string;
  callStatus: LeadSalesActivity["callStatus"];
  remarks: string;
  followUpDate?: string | null;
}

/**
 * Where the detailed scoping deliberately left off the client form actually
 * gets captured — exact sizes, finishes, site constraints.
 */
export async function logCall(input: CallLogInput): Promise<LeadSalesActivity> {
  const salesAgentId = await currentAgentId();
  const activity: LeadSalesActivity = {
    id: nextId("lsa"),
    leadId: input.leadId,
    salesAgentId,
    callStatus: input.callStatus,
    remarks: input.remarks,
    recordingUrl: null,
    followUpDate: input.followUpDate ?? null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    deletedAt: null,
  };
  store.leadSalesActivities.push(activity);

  const lead = store.leads.find((l) => l.id === input.leadId);
  if (lead) {
    if (!lead.assignedSalesAgentId) lead.assignedSalesAgentId = salesAgentId;
    if (lead.overallStatus === "new") lead.overallStatus = "verified";
    lead.updatedAt = nowIso();
  }
  return delay(activity);
}

export async function listCallLog(leadId: string): Promise<
  Array<{ activity: LeadSalesActivity; agentName: string }>
> {
  return delay(
    store.leadSalesActivities
      .filter((a) => a.leadId === leadId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((activity) => {
        const agent = store.salesAgents.find((s) => s.id === activity.salesAgentId);
        const user = store.users.find((u) => u.id === agent?.userId);
        return { activity, agentName: user?.name ?? "Team" };
      }),
  );
}

export interface ScheduleVisitInput {
  leadDomainId: string;
  professionalId: string;
  scheduledAt: string;
  type: MeetingType;
  notes?: string | null;
}

/**
 * The coordinator books it, having confirmed the slot with both sides. The
 * address is released to the vendor at this point and not before.
 */
export async function scheduleVisit(input: ScheduleVisitInput): Promise<Meeting> {
  const coordinatorId = await currentAgentId();
  const leadDomain = store.leadDomains.find((ld) => ld.id === input.leadDomainId)!;
  const lead = store.leads.find((l) => l.id === leadDomain.leadId)!;
  const client = store.clients.find((c) => c.id === lead.clientId)!;

  const meeting: Meeting = {
    id: nextId("mtg"),
    leadDomainId: input.leadDomainId,
    professionalId: input.professionalId,
    type: input.type,
    scheduledAt: input.scheduledAt,
    location: client.address ?? cityById(lead.cityId).name,
    status: "confirmed",
    notes: input.notes ?? null,
    coordinatorId,
    addressReleasedAt: nowIso(),
    rescheduleRequestedAt: null,
    rescheduleNote: null,
    outcome: null,
    outcomeRecordedAt: null,
    outcomeChangedScope: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    deletedAt: null,
  };
  store.meetings.push(meeting);
  return delay(meeting);
}

export async function listVisitsForAgent(): Promise<
  Array<{
    meeting: Meeting;
    professional: ProfessionalSummary;
    leadId: string;
    leadReference: string;
    domain: Domain;
    city: City;
  }>
> {
  return delay(
    store.meetings
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
      .map((meeting) => {
        const leadDomain = store.leadDomains.find((ld) => ld.id === meeting.leadDomainId)!;
        const lead = store.leads.find((l) => l.id === leadDomain.leadId)!;
        return {
          meeting,
          professional: toProfessionalSummary(meeting.professionalId, leadDomain.domainId),
          leadId: lead.id,
          leadReference: lead.reference,
          domain: domainById(leadDomain.domainId),
          city: cityById(lead.cityId),
        };
      }),
  );
}

/* ------------------------------------------------------------------ *
 * Dashboards
 * ------------------------------------------------------------------ */

export interface SalesDashboard {
  agentName: string;
  target: number;
  newLeads: number;
  needsAssignment: number;
  awaitingReply: number;
  followUpsDue: number;
  visitsToday: number;
  byUrgency: Array<{ urgency: Urgency; count: number }>;
  byDomain: Array<{ domain: Domain; count: number }>;
}

export async function getSalesDashboard(): Promise<SalesDashboard> {
  const agentId = await currentAgentId();
  const rows = await listOpsLeads({ agentId });
  const agent = store.salesAgents.find((s) => s.id === agentId);
  const agentUser = agent ? store.users.find((u) => u.id === agent.userId) : undefined;
  const today = nowIso().slice(0, 10);

  return delay({
    agentName: agentUser?.name ?? "All agents",
    target: agent?.dailyTarget ?? 0,
    newLeads: rows.filter((r) => r.lead.lead.overallStatus === "new").length,
    needsAssignment: rows.filter((r) => r.unassignedDomains > 0).length,
    awaitingReply: rows.filter((r) => r.awaitingReply > 0).length,
    followUpsDue: rows.filter((r) => r.followUpDate && r.followUpDate <= today).length,
    visitsToday: store.meetings.filter((m) => m.scheduledAt.slice(0, 10) === today).length,
    byUrgency: (["immediate", "within_month", "exploring"] as Urgency[]).map((urgency) => ({
      urgency,
      count: rows.filter((r) => r.lead.lead.urgency === urgency).length,
    })),
    byDomain: store.domains.map((domain) => ({
      domain,
      count: rows.filter((r) => r.lead.domains.some((d) => d.domain.id === domain.id)).length,
    })),
  });
}

export async function listSalesAgents(): Promise<Array<{ id: string; name: string }>> {
  return delay(
    store.salesAgents.map((agent) => ({
      id: agent.id,
      name: store.users.find((u) => u.id === agent.userId)?.name ?? agent.id,
    })),
  );
}
