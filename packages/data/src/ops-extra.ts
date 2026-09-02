/**
 * Timeline, visit outcomes and the "my day" view.
 *
 * Split from ops.ts so the lead-queue plumbing stays readable — these are the
 * screens a coordinator actually works from, and they read across almost every
 * table rather than one.
 */
import type { Project, Rupees } from "@repo/types";
import { domainById } from "./mappers";
import { listOpsLeads, type OpsLeadRow } from "./ops";
import { currentAgentId } from "./session";
import { delay, nowIso, store } from "./store";

function rupees(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/* ------------------------------------------------------------------ *
 * Lead timeline
 * ------------------------------------------------------------------ */

export type TimelineKind =
  | "raised"
  | "call"
  | "assigned"
  | "visit"
  | "outcome"
  | "quote"
  | "selected"
  | "agreement";

export interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  at: string;
  title: string;
  detail: string | null;
  domainName: string | null;
  actor: string | null;
}

/**
 * Ops answer "what has actually happened on this lead?" constantly, usually
 * with a customer on the phone. Reconstructing that from six separate lists is
 * the slow part, so it is assembled once, here.
 */
export async function getLeadTimeline(leadId: string): Promise<TimelineEvent[]> {
  const lead = store.leads.find((l) => l.id === leadId);
  if (!lead) return delay([]);

  const domainRows = store.leadDomains.filter((ld) => ld.leadId === leadId);
  const ids = domainRows.map((d) => d.id);
  const nameFor = (leadDomainId: string) => {
    const row = domainRows.find((d) => d.id === leadDomainId);
    return row ? domainById(row.domainId).name : null;
  };
  const proName = (id: string) =>
    store.professionals.find((p) => p.id === id)?.companyName ?? "A professional";

  const events: TimelineEvent[] = [
    {
      id: `t-raised-${lead.id}`,
      kind: "raised",
      at: lead.createdAt,
      title: "Requirement submitted",
      detail: `${domainRows.length} service${domainRows.length === 1 ? "" : "s"} · via ${lead.source.replace("_", " ")}`,
      domainName: null,
      actor: null,
    },
  ];

  for (const activity of store.leadSalesActivities.filter((a) => a.leadId === leadId)) {
    const agent = store.salesAgents.find((s) => s.id === activity.salesAgentId);
    events.push({
      id: `t-call-${activity.id}`,
      kind: "call",
      at: activity.createdAt,
      title: `Call — ${activity.callStatus.replace("_", " ")}`,
      detail: activity.remarks,
      domainName: null,
      actor: store.users.find((u) => u.id === agent?.userId)?.name ?? null,
    });
  }

  for (const a of store.leadDomainAssignments.filter((x) => ids.includes(x.leadDomainId))) {
    events.push({
      id: `t-asg-${a.id}`,
      kind: "assigned",
      at: a.assignedAt,
      title: `${proName(a.professionalId)} assigned`,
      detail: a.responseStatus === "rejected" ? a.rejectionReason : null,
      domainName: nameFor(a.leadDomainId),
      actor: null,
    });
  }

  for (const m of store.meetings.filter((x) => ids.includes(x.leadDomainId))) {
    events.push({
      id: `t-visit-${m.id}`,
      kind: "visit",
      at: m.scheduledAt,
      title: `${m.type.replace("_", " ")} — ${proName(m.professionalId)}`,
      detail: m.notes,
      domainName: nameFor(m.leadDomainId),
      actor: null,
    });
    if (m.outcome && m.outcomeRecordedAt) {
      events.push({
        id: `t-outcome-${m.id}`,
        kind: "outcome",
        at: m.outcomeRecordedAt,
        title: m.outcomeChangedScope ? "Visit outcome — scope changed" : "Visit outcome recorded",
        detail: m.outcome,
        domainName: nameFor(m.leadDomainId),
        actor: null,
      });
    }
  }

  for (const q of store.quotes.filter((x) => ids.includes(x.leadDomainId))) {
    events.push({
      id: `t-quote-${q.id}`,
      kind: "quote",
      at: q.createdAt,
      title: `Quote ${q.version > 1 ? `v${q.version} ` : ""}from ${proName(q.professionalId)}`,
      detail: `${rupees(q.total)} · ${q.timelineDays} days · ${q.warrantyMonths} month warranty`,
      domainName: nameFor(q.leadDomainId),
      actor: null,
    });
  }

  for (const row of domainRows) {
    if (row.selectedProfessionalId) {
      events.push({
        id: `t-sel-${row.id}`,
        kind: "selected",
        at: row.updatedAt,
        title: `${proName(row.selectedProfessionalId)} chosen`,
        detail: null,
        domainName: domainById(row.domainId).name,
        actor: "Client",
      });
    }
  }

  for (const agreement of store.agreements.filter((a) => a.leadId === leadId)) {
    events.push({
      id: `t-agr-${agreement.id}`,
      kind: "agreement",
      at: agreement.signedAt ?? agreement.sentAt ?? agreement.createdAt,
      title: agreement.signedAt
        ? `${agreement.reference} signed`
        : `${agreement.reference} sent for signature`,
      detail: `${proName(agreement.professionalId)} · ${rupees(agreement.totalValue)}`,
      domainName: null,
      actor: null,
    });
  }

  return delay(events.sort((a, b) => b.at.localeCompare(a.at)));
}

/* ------------------------------------------------------------------ *
 * Visit outcomes
 * ------------------------------------------------------------------ */

/**
 * What the visit established. Optional by design — plenty of visits simply
 * confirm what was already known — but when the scope moves, this becomes the
 * record every vendor quoting the job works from.
 */
export async function recordVisitOutcome(
  meetingId: string,
  outcome: string,
  changedScope: boolean,
): Promise<void> {
  const meeting = store.meetings.find((m) => m.id === meetingId);
  if (!meeting) throw new Error("Unknown meeting");
  meeting.outcome = outcome;
  meeting.outcomeRecordedAt = nowIso();
  meeting.outcomeChangedScope = changedScope;
  if (meeting.status === "scheduled" || meeting.status === "confirmed") {
    meeting.status = "completed";
  }
  meeting.updatedAt = nowIso();
  return delay(undefined);
}

/* ------------------------------------------------------------------ *
 * Execution tracking on a lead
 * ------------------------------------------------------------------ */

export interface LeadProjectView {
  projectId: string;
  reference: string;
  leadDomainId: string;
  domainName: string;
  professionalName: string;
  professionalId: string;
  status: string;
  completionPercent: number;
  approvedStages: number;
  totalStages: number;
  awaitingReview: number;
  currentStage: string | null;
  milestones: Project["milestones"];
}

/**
 * What is actually happening on the ground for each service of a lead. This is
 * the answer to "which stage is my kitchen at?" — the question that otherwise
 * costs a phone call to the vendor every time a customer asks it.
 */
export async function getLeadProjects(leadId: string): Promise<LeadProjectView[]> {
  const leadDomainIds = store.leadDomains
    .filter((ld) => ld.leadId === leadId)
    .map((ld) => ld.id);

  return delay(
    store.projects
      .filter((p) => leadDomainIds.includes(p.leadDomainId))
      .map((project) => {
        const leadDomain = store.leadDomains.find((ld) => ld.id === project.leadDomainId)!;
        const pro = store.professionals.find((p) => p.id === project.professionalId);
        const approved = project.milestones.filter((m) => m.verification === "approved");
        const current = project.milestones.find(
          (m) => m.verification !== "approved",
        );
        return {
          projectId: project.id,
          reference: project.reference,
          leadDomainId: project.leadDomainId,
          domainName: domainById(leadDomain.domainId).name,
          professionalName: pro?.companyName ?? "Vendor",
          professionalId: project.professionalId,
          status: project.status,
          completionPercent: project.completionPercent,
          approvedStages: approved.length,
          totalStages: project.milestones.length,
          awaitingReview: project.milestones.filter((m) => m.verification === "submitted").length,
          currentStage: current?.title ?? null,
          milestones: project.milestones,
        };
      }),
  );
}

/* ------------------------------------------------------------------ *
 * My day
 * ------------------------------------------------------------------ */

export interface CommissionFocusRow {
  invoiceId: string;
  reference: string;
  professionalId: string;
  professionalName: string;
  amount: Rupees;
  dueDate: string;
  status: string;
  daysOverdue: number;
  domains: string[];
}

export interface MyDayView {
  agentName: string;
  target: number;
  live: OpsLeadRow[];
  awaitingReply: OpsLeadRow[];
  needsAssignment: OpsLeadRow[];
  followUpsDue: OpsLeadRow[];
  neverCalled: OpsLeadRow[];
  stalled: OpsLeadRow[];
  visitsToday: number;
  visitsNeedingOutcome: number;
  commission: {
    pending: Rupees;
    overdue: Rupees;
    overdueCount: number;
    dueSoonCount: number;
    rows: CommissionFocusRow[];
  };
}

/**
 * Deliberately excludes finished work. A closed lead is not a thing to do, and
 * a day screen that lists them buries the handful that need action today.
 */
export async function getMyDay(): Promise<MyDayView> {
  const agentId = await currentAgentId();
  const all = await listOpsLeads({ agentId });
  const agent = store.salesAgents.find((s) => s.id === agentId);
  const agentUser = agent ? store.users.find((u) => u.id === agent.userId) : undefined;
  const today = nowIso().slice(0, 10);

  const live = all.filter((r) =>
    ["new", "verified", "in_progress"].includes(r.lead.lead.overallStatus),
  );

  const openInvoices = store.commissionInvoices.filter((i) =>
    ["pending", "overdue"].includes(i.status),
  );
  const soon = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

  return delay({
    agentName: agentUser?.name ?? "All agents",
    target: agent?.dailyTarget ?? 0,
    live,
    awaitingReply: live.filter((r) => r.awaitingReply > 0),
    needsAssignment: live.filter((r) => r.unassignedDomains > 0),
    followUpsDue: live.filter((r) => r.followUpDate && r.followUpDate <= today),
    neverCalled: live.filter((r) => !r.lastActivity),
    // Two weeks with nothing finished is a lead going quietly cold.
    stalled: live.filter((r) => r.ageDays >= 14),
    visitsToday: store.meetings.filter((m) => m.scheduledAt.slice(0, 10) === today).length,
    visitsNeedingOutcome: store.meetings.filter(
      (m) => m.scheduledAt.slice(0, 10) < today && !m.outcome && m.status !== "no_show",
    ).length,
    commission: {
      pending: openInvoices
        .filter((i) => i.status === "pending")
        .reduce((s, i) => s + i.amount, 0),
      overdue: openInvoices
        .filter((i) => i.status === "overdue")
        .reduce((s, i) => s + i.amount, 0),
      overdueCount: openInvoices.filter((i) => i.status === "overdue").length,
      dueSoonCount: openInvoices.filter((i) => i.status === "pending" && i.dueDate <= soon).length,
      rows: openInvoices
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .map((invoice) => {
          const pro = store.professionals.find((p) => p.id === invoice.professionalId);
          const links = store.agreementLeadDomains.filter(
            (l) => l.agreementId === invoice.agreementId,
          );
          return {
            invoiceId: invoice.id,
            reference: invoice.reference,
            professionalId: invoice.professionalId,
            professionalName: pro?.companyName ?? "Vendor",
            amount: invoice.amount,
            dueDate: invoice.dueDate,
            status: invoice.status,
            daysOverdue:
              invoice.status === "overdue"
                ? Math.max(
                    0,
                    Math.round(
                      (new Date(today).getTime() - new Date(invoice.dueDate).getTime()) /
                        86_400_000,
                    ),
                  )
                : 0,
            domains: links.map((l) => {
              const ld = store.leadDomains.find((x) => x.id === l.leadDomainId);
              return ld ? domainById(ld.domainId).name : "";
            }),
          };
        }),
    },
  });
}
