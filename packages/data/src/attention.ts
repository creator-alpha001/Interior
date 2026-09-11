/**
 * Everything across the ops panel that is waiting on our team, for the
 * dashboard's "needs your attention" row.
 *
 * With a backend this is one request; the API counts in SQL. Without one it is
 * worked out from the seed store by the same rules, so a local walkthrough shows
 * the same cards.
 */
import type { AttentionCard, AttentionEntry, AttentionKey, AttentionView } from "@repo/types";
import { api } from "./client";
import { callingApiAsUser } from "./session";
import { delay, nowIso, store } from "./store";

const SHOWN = 3;

export async function getOpsAttention(): Promise<AttentionView> {
  if (await callingApiAsUser()) return api<AttentionView>("/ops/attention");

  const today = nowIso().slice(0, 10);
  const leadById = new Map(store.leads.map((l) => [l.id, l]));
  const leadDomainById = new Map(store.leadDomains.map((ld) => [ld.id, ld]));
  const vendorName = (id: string) =>
    store.professionals.find((p) => p.id === id)?.companyName ?? "Vendor";
  const clientName = (clientId: string) => {
    const client = store.clients.find((c) => c.id === clientId);
    return store.users.find((u) => u.id === client?.userId)?.name ?? "Customer";
  };
  const domainName = (id: string) => store.domains.find((d) => d.id === id)?.name ?? "";
  const byAt = (a: AttentionEntry, b: AttentionEntry) => (a.at ?? "").localeCompare(b.at ?? "");
  const openLead = (id: string) => {
    const lead = leadById.get(id);
    return lead && ["new", "verified", "in_progress"].includes(lead.overallStatus) ? lead : undefined;
  };

  const card = (
    key: AttentionKey,
    entries: AttentionEntry[],
    count = entries.length,
    note: string | null = null,
  ): AttentionCard => ({ key, count, note, failed: false, entries: entries.slice(0, SHOWN) });

  // Newest message per client thread.
  const latestByThread = new Map<string, (typeof store.messages)[number]>();
  for (const message of store.messages) {
    if (message.channel !== "client_platform") continue;
    const seen = latestByThread.get(message.leadDomainId);
    if (!seen || seen.createdAt < message.createdAt) latestByThread.set(message.leadDomainId, message);
  }
  const awaiting = [...latestByThread.values()]
    .filter((m) => m.senderRole === "client")
    .flatMap((m) => {
      const ld = leadDomainById.get(m.leadDomainId);
      const lead = ld && leadById.get(ld.leadId);
      return ld && lead
        ? [{
            targetId: lead.id,
            title: `${lead.reference} · ${domainName(ld.domainId)}`,
            detail: `“${m.body.length > 70 ? `${m.body.slice(0, 70)}…` : m.body}”`,
            at: m.createdAt,
          }]
        : [];
    })
    .sort(byAt);

  const unassigned = store.leadDomains
    .filter((ld) => ld.status === "pending_assignment" && leadById.has(ld.leadId))
    .map((ld) => ({
      targetId: ld.leadId,
      title: `${leadById.get(ld.leadId)!.reference} · ${domainName(ld.domainId)}`,
      detail: "No vendors assigned yet",
      at: ld.createdAt,
    }))
    .sort(byAt);

  const latestCall = new Map<string, (typeof store.leadSalesActivities)[number]>();
  for (const activity of store.leadSalesActivities) {
    const seen = latestCall.get(activity.leadId);
    if (!seen || seen.createdAt < activity.createdAt) latestCall.set(activity.leadId, activity);
  }
  const followUps = [...latestCall.values()]
    .filter((a) => a.followUpDate && a.followUpDate <= today && openLead(a.leadId))
    .map((a) => {
      const lead = leadById.get(a.leadId)!;
      return {
        targetId: lead.id,
        title: clientName(lead.clientId),
        detail: `${lead.reference} · follow-up due`,
        at: a.followUpDate,
      };
    })
    .sort(byAt);

  const paperworkByVendor = new Map<string, string[]>();
  const note = (professionalId: string, item: string) =>
    paperworkByVendor.set(professionalId, [...(paperworkByVendor.get(professionalId) ?? []), item]);
  for (const agreement of store.partnerAgreements) {
    if (agreement.status === "superseded") continue;
    if (agreement.signedCopyStatus === "submitted") note(agreement.professionalId, "signed agreement");
    if (agreement.hardcopyStatus === "dispatched") note(agreement.professionalId, "original on its way");
  }
  for (const document of store.vendorDocuments) {
    if (document.status === "submitted" && document.deletedAt === null) {
      note(document.professionalId, "document");
    }
  }

  const stageProof = store.projects
    .flatMap((project) =>
      project.milestones
        .filter((m) => m.verification === "submitted")
        .map((m) => ({
          targetId: leadDomainById.get(project.leadDomainId)?.leadId ?? null,
          title: `${m.title} · ${vendorName(project.professionalId)}`,
          detail: project.reference,
          at: m.submittedAt,
        })),
    )
    .sort(byAt);

  const meetingEntry = (meeting: (typeof store.meetings)[number], at: string | null, detail: string) => {
    const lead = leadById.get(leadDomainById.get(meeting.leadDomainId)?.leadId ?? "");
    return {
      targetId: lead?.id ?? null,
      title: `${lead?.reference ?? "Visit"} · ${vendorName(meeting.professionalId)}`,
      detail,
      at,
    };
  };

  const overdue = store.commissionInvoices.filter((i) => i.status === "overdue");
  const overdueTotal = overdue.reduce((sum, i) => sum + i.amount, 0);
  const inProgressTickets = store.supportTickets.filter((t) => t.status === "in_progress").length;

  return delay({
    cards: [
      card(
        "new_leads",
        store.leads
          .filter((l) => l.overallStatus === "new")
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((l) => ({
            targetId: l.id,
            title: clientName(l.clientId),
            detail: `${l.reference} · ${store.cities.find((c) => c.id === l.cityId)?.name ?? ""}`,
            at: l.createdAt,
          })),
      ),
      card("awaiting_reply", awaiting, new Set(awaiting.map((a) => a.targetId)).size),
      card("unassigned_leads", unassigned, new Set(unassigned.map((u) => u.targetId)).size),
      card("follow_ups", followUps),
      card(
        "applications",
        store.professionalApplications
          .filter((a) => a.deletedAt === null && (a.status === "submitted" || a.status === "under_review"))
          .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
          .map((a) => ({
            targetId: a.id,
            title: a.companyName,
            detail: `${store.users.find((u) => u.id === a.userId)?.name ?? "Applicant"} · ${
              a.status === "under_review" ? "being reviewed" : "not opened yet"
            }`,
            at: a.submittedAt,
          })),
      ),
      card(
        "paperwork",
        [...paperworkByVendor.entries()].map(([professionalId, items]) => {
          const documents = items.filter((i) => i === "document").length;
          return {
            targetId: professionalId,
            title: vendorName(professionalId),
            detail: [
              items.includes("signed agreement") ? "signed agreement" : null,
              documents > 0 ? `${documents} ${documents === 1 ? "document" : "documents"}` : null,
              items.includes("original on its way") ? "original on its way" : null,
            ]
              .filter(Boolean)
              .join(" · "),
            at: null,
          };
        }),
      ),
      card(
        "trade_requests",
        store.professionalDomains
          .filter((pd) => pd.verificationStatus === "pending")
          .map((pd) => ({
            targetId: pd.professionalId,
            title: vendorName(pd.professionalId),
            detail: `Wants approval for ${domainName(pd.domainId)}`,
            at: pd.createdAt,
          }))
          .sort(byAt),
      ),
      card("stage_proof", stageProof),
      card(
        "visit_writeups",
        store.meetings
          .filter((m) => m.scheduledAt.slice(0, 10) < today && !m.outcome && m.status !== "no_show")
          .map((m) => meetingEntry(m, m.scheduledAt, "Visit not written up"))
          .sort(byAt),
      ),
      card(
        "reschedules",
        store.meetings
          .filter((m) => m.rescheduleRequestedAt !== null && m.status !== "completed")
          .map((m) => meetingEntry(m, m.rescheduleRequestedAt, "Customer asked for a new slot"))
          .sort(byAt),
      ),
      card(
        "overdue_commission",
        overdue
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
          .map((i) => ({
            targetId: null,
            title: vendorName(i.professionalId),
            detail: `${i.reference} · ₹${i.amount.toLocaleString("en-IN")}`,
            at: i.dueDate,
          })),
        overdue.length,
        overdueTotal > 0 ? `₹${overdueTotal.toLocaleString("en-IN")} outstanding` : null,
      ),
      card(
        "open_tickets",
        store.supportTickets
          .filter((t) => t.status === "open")
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .map((t) => ({
            targetId: null,
            title: t.subject,
            detail: `${t.reference} · ${t.priority} priority`,
            at: t.createdAt,
          })),
        store.supportTickets.filter((t) => t.status === "open").length,
        inProgressTickets > 0 ? `${inProgressTickets} more in progress` : null,
      ),
    ],
  });
}
