import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatRupees,
  getLeadProjects,
  getLeadTimeline,
  getOpsLead,
  getRelay,
  getVendorPool,
  listCallLog,
} from "@repo/data";
import {
  Badge,
  cn,
  formatDate,
  formatDateTime,
  leadDomainStatus,
  materialSourceLabel,
  meetingStatus,
  urgencyLabel,
} from "@repo/ui";
import { AssignPanel } from "@/components/assign-panel";
import { CallLogForm } from "@/components/call-log-form";
import { LeadTimeline } from "@/components/lead-timeline";
import { RelayConsole } from "@/components/relay-console";
import { StageTracker } from "@/components/stage-tracker";
import { ScheduleVisitForm } from "@/components/schedule-visit-form";
import { VisitOutcomeForm } from "@/components/visit-outcome-form";
import { PageBody, PageHeader, Panel } from "@/components/ops-ui";

type Params = { id: string };
type Search = { service?: string };

export default async function OpsLeadPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { id } = await params;
  const { service } = await searchParams;

  const row = await getOpsLead(id);
  if (!row) notFound();

  const { lead } = row;
  const active = lead.domains.find((d) => d.leadDomain.id === service) ?? lead.domains[0];

  const [callLog, relay, pool, timeline, leadProjects] = await Promise.all([
    listCallLog(lead.lead.id),
    getRelay(active.leadDomain.id),
    getVendorPool(active.leadDomain.id),
    getLeadTimeline(lead.lead.id),
    getLeadProjects(lead.lead.id),
  ]);

  // Execution for the service currently in view, if work has started.
  const activeProject = leadProjects.find((p) => p.leadDomainId === active.leadDomain.id);

  const assignedPros = active.assignments
    .filter((a) => a.assignment.responseStatus !== "rejected")
    .map((a) => a.professional);

  // What this service needs next, stated once at the top of the working column.
  const nextAction = (() => {
    if (active.assignments.length === 0)
      return { text: "Call the vendor pool below, then assign whoever confirms", tone: "warning" as const };
    if (active.meetings.length === 0)
      return { text: "Book site visits so vendors can measure", tone: "warning" as const };
    const unwritten = active.meetings.filter(
      (m) => m.meeting.status === "completed" && !m.meeting.outcome,
    );
    if (unwritten.length > 0)
      return { text: `${unwritten.length} completed visit needs an outcome written up`, tone: "warning" as const };
    if (active.quotes.length < active.assignments.length)
      return {
        text: `${active.assignments.length - active.quotes.length} of ${active.assignments.length} vendors have not quoted yet`,
        tone: "neutral" as const,
      };
    if (!active.leadDomain.selectedProfessionalId)
      return { text: "All quotes in — client is deciding", tone: "neutral" as const };
    return { text: "Vendor selected. Nothing outstanding on this service.", tone: "positive" as const };
  })();

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Lead queue", href: "/leads" }, { label: lead.lead.reference }]}
        title={lead.client.name}
        subtitle={`${lead.lead.reference} · ${lead.city.name} · raised ${formatDate(lead.lead.createdAt)} · ${row.ageDays} days old`}
        actions={
          <>
            <Badge tone={lead.lead.urgency === "immediate" ? "danger" : "neutral"}>
              {urgencyLabel[lead.lead.urgency]}
            </Badge>
            {row.awaitingReply > 0 ? (
              <Badge tone="danger">{row.awaitingReply} awaiting reply</Badge>
            ) : null}
            <a
              href={`tel:${lead.client.mobile}`}
              className="rounded-full bg-brand px-4 py-2 text-[13.5px] font-medium text-white hover:bg-brand-hover sm:text-[12.5px]"
            >
              Call {lead.client.mobile}
            </a>
          </>
        }
      />

      <PageBody className="space-y-4">
        {/* Service switcher — the spine of a multi-service lead. */}
        <div className="flex flex-wrap gap-2">
          {lead.domains.map((d) => {
            const status = leadDomainStatus[d.leadDomain.status];
            const isActive = d.leadDomain.id === active.leadDomain.id;
            const needs =
              d.assignments.length === 0
                ? "needs assignment"
                : d.quotes.length < d.assignments.length
                  ? `${d.quotes.length}/${d.assignments.length} quoted`
                  : d.leadDomain.selectedProfessionalId
                    ? "vendor chosen"
                    : "all quotes in";
            return (
              <Link
                key={d.leadDomain.id}
                href={`/leads/${lead.lead.id}?service=${d.leadDomain.id}`}
                className={cn(
                  "min-w-[180px] flex-1 rounded-lg border px-4 py-3 transition-colors sm:flex-none",
                  isActive
                    ? "border-brand bg-brand-soft"
                    : "border-line bg-surface hover:border-ink-4",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "text-[14.5px] font-semibold sm:text-[13.5px]",
                      isActive ? "text-brand" : "text-ink",
                    )}
                  >
                    {d.domain.name}
                  </span>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
                <p className="mt-1 text-[12.5px] text-ink-4 sm:text-[11.5px]">{needs}</p>
              </Link>
            );
          })}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          {/* ---------- Working column ---------- */}
          <div className="min-w-0 space-y-4">
            <div
              className={cn(
                "rounded-lg border px-4 py-3",
                nextAction.tone === "warning"
                  ? "border-warning/30 bg-warning-soft"
                  : nextAction.tone === "positive"
                    ? "border-positive/25 bg-positive-soft"
                    : "border-line bg-surface",
              )}
            >
              <p className="text-[12.5px] font-semibold uppercase tracking-wider text-ink-4 sm:text-[11.5px]">
                Next on {active.domain.name}
              </p>
              <p className="mt-1 text-[14.5px] text-ink sm:text-[13.5px]">{nextAction.text}</p>
            </div>

            {/* Scope */}
            <Panel title={`${active.domain.name} — scope`}>
              <div className="flex flex-wrap gap-2">
                <Badge tone="neutral">{materialSourceLabel[active.leadDomain.materialSource]}</Badge>
                <Badge tone="neutral">{active.domain.labels.pricingBasis}</Badge>
                {active.leadDomain.preferredProfessionalId ? (
                  <Badge tone="clay">Client asked for a specific vendor</Badge>
                ) : null}
              </div>

              {active.items.length > 0 ? (
                <div className="mt-3 rounded-md bg-paper p-3">
                  <p className="text-[12.5px] uppercase tracking-wider text-ink-4 sm:text-[11.5px]">
                    Selected from the catalogue
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {active.items.map((item) => (
                      <li key={item.id} className="text-[13.5px] text-ink-2 sm:text-[12.5px]">
                        {item.quantity > 1 ? `${item.quantity} × ` : ""}
                        {item.itemName}
                        {Object.keys(item.selectedOptions).length > 0
                          ? ` — ${Object.entries(item.selectedOptions).map(([k, v]) => `${k}: ${v}`).join(", ")}`
                          : ""}
                        {item.customerNotes ? (
                          <span className="text-ink-4"> · “{item.customerNotes}”</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {active.leadDomain.preferenceUnmetReason ? (
                <p className="mt-3 rounded-md border border-warning/25 bg-warning-soft px-3 py-2 text-[13px] leading-relaxed text-ink-2 sm:text-[12px]">
                  Requested vendor could not be included — {active.leadDomain.preferenceUnmetReason}{" "}
                  The client sees this on their requirement.
                </p>
              ) : null}
            </Panel>

            {/* Execution — where the work actually is */}
            {activeProject ? (
              <Panel
                title={`Work in progress — ${activeProject.professionalName}`}
                action={
                  activeProject.awaitingReview > 0 ? (
                    <span className="rounded-full bg-brand px-2 py-0.5 text-[11.5px] font-medium text-white">
                      {activeProject.awaitingReview} to review
                    </span>
                  ) : (
                    <span className="text-[12px] text-ink-4">
                      {activeProject.currentStage
                        ? `Now: ${activeProject.currentStage}`
                        : "All stages approved"}
                    </span>
                  )
                }
              >
                <StageTracker
                  projectId={activeProject.projectId}
                  leadId={lead.lead.id}
                  milestones={activeProject.milestones}
                  completionPercent={activeProject.completionPercent}
                  reference={activeProject.reference}
                />
                <p className="mt-3 border-t border-line pt-2.5 text-[12px] leading-relaxed text-ink-4">
                  A stage counts as done only once you approve the vendor&apos;s evidence — that is
                  what moves the customer&apos;s progress bar, and what you can point at if they
                  question it later.
                </p>
              </Panel>
            ) : null}

            {/* Assignment */}
            <Panel title={`Assigned (${assignedPros.length})`}>
              {active.assignments.length > 0 ? (
                <ul className="mb-3 space-y-1.5">
                  {active.assignments.map(({ assignment, professional }) => {
                    const quote = active.quotes.find((q) => q.professional.id === professional.id);
                    const chosen = active.leadDomain.selectedProfessionalId === professional.id;
                    return (
                      <li
                        key={assignment.id}
                        className={cn(
                          "flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2",
                          chosen ? "border-brand bg-brand-soft" : "border-line",
                        )}
                      >
                        <div className="min-w-0">
                          <Link
                            href={`/vendors/${professional.id}`}
                            className="text-[14px] font-medium text-ink hover:text-brand sm:text-[13px]"
                          >
                            {professional.companyName}
                          </Link>
                          <p className="text-[12.5px] text-ink-4 sm:text-[11.5px]">
                            assigned {formatDate(assignment.assignedAt)} ·{" "}
                            {quote ? `quoted ${formatRupees(quote.quote.total)}` : "no quote yet"}
                          </p>
                        </div>
                        {chosen ? (
                          <Badge tone="brand">Chosen by client</Badge>
                        ) : assignment.responseStatus === "rejected" ? (
                          <Badge tone="danger">Declined</Badge>
                        ) : quote ? (
                          <Badge tone="positive">Quoted</Badge>
                        ) : (
                          <Badge tone="warning">Awaiting quote</Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              <AssignPanel
                pool={pool}
                leadDomainId={active.leadDomain.id}
                leadId={lead.lead.id}
                domainName={active.domain.name}
                cityName={lead.city.name}
              />
            </Panel>

            {/* Visits, with outcomes */}
            <Panel title="Site visits">
              {active.meetings.length === 0 ? (
                <p className="mb-3 text-[13.5px] text-ink-3 sm:text-[12.5px]">
                  Nothing booked for this service yet.
                </p>
              ) : (
                <ul className="mb-4 space-y-2">
                  {active.meetings.map(({ meeting, professional }) => {
                    const ms = meetingStatus[meeting.status];
                    return (
                      <li key={meeting.id} className="rounded-md border border-line p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[14px] font-medium text-ink sm:text-[13px]">
                            {professional.companyName}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {meeting.outcomeChangedScope ? (
                              <Badge tone="clay">Scope changed</Badge>
                            ) : null}
                            <Badge tone={ms.tone}>{ms.label}</Badge>
                          </div>
                        </div>
                        <p className="mt-0.5 text-[12.5px] text-ink-4 sm:text-[11.5px]">
                          {formatDateTime(meeting.scheduledAt)} · {meeting.type.replace("_", " ")}
                        </p>
                        {meeting.rescheduleNote ? (
                          <p className="mt-1.5 text-[12.5px] text-warning sm:text-[11.5px]">
                            Client asked to move it: “{meeting.rescheduleNote}”
                          </p>
                        ) : null}

                        <VisitOutcomeForm
                          meetingId={meeting.id}
                          leadId={lead.lead.id}
                          outcome={meeting.outcome}
                          recordedAt={meeting.outcomeRecordedAt}
                          changedScope={meeting.outcomeChangedScope}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}

              <ScheduleVisitForm
                leadDomainId={active.leadDomain.id}
                leadId={lead.lead.id}
                professionals={assignedPros}
              />
            </Panel>

            {/* Quotes */}
            {active.quotes.length > 0 ? (
              <Panel title={`Quotes in (${active.quotes.length})`} bodyClassName="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-[13.5px] sm:text-[12.5px]">
                    <thead className="bg-surface-2 text-[12px] uppercase tracking-wider text-ink-3 sm:text-[11px]">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Vendor</th>
                        <th className="px-3 py-2 text-right font-semibold">Total</th>
                        <th className="px-3 py-2 text-left font-semibold">Timeline</th>
                        <th className="px-3 py-2 text-left font-semibold">Warranty</th>
                        <th className="px-3 py-2 text-left font-semibold">
                          {active.domain.labels.materials}
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {active.quotes.map(({ quote, professional }, i) => (
                        <tr key={quote.id} className="border-t border-line align-top">
                          <td className="px-3 py-2.5 text-ink">
                            {professional.companyName}
                            {i === 0 ? (
                              <span className="ml-1.5 text-[11.5px] text-positive">lowest</span>
                            ) : null}
                          </td>
                          <td className="tnum px-3 py-2.5 text-right font-medium text-ink">
                            {formatRupees(quote.total)}
                          </td>
                          <td className="px-3 py-2.5 text-ink-2">{quote.timelineDays}d</td>
                          <td className="px-3 py-2.5 text-ink-2">{quote.warrantyMonths} mo</td>
                          <td className="max-w-[220px] px-3 py-2.5 text-[12.5px] leading-snug text-ink-3 sm:text-[11.5px]">
                            {quote.materialsSummary}
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge tone={quote.status === "selected" ? "positive" : "neutral"}>
                              {quote.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            ) : null}

            {/* Relay */}
            <div>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[16px] font-semibold sm:text-[15px]">
                  Relay — {active.domain.name}
                </h2>
                <p className="text-[13px] text-ink-4 sm:text-[12px]">
                  Client and vendors never see each other. You carry the substance across.
                </p>
              </div>
              {relay ? <RelayConsole relay={relay} leadId={lead.lead.id} /> : null}
            </div>

            <Panel title="Log a call">
              <CallLogForm leadId={lead.lead.id} />
            </Panel>
          </div>

          {/* ---------- Information rail ---------- */}
          <aside className="min-w-0 space-y-4">
            <Panel title="Client">
              <p className="text-[15px] font-medium text-ink sm:text-[14px]">{lead.client.name}</p>
              <a
                href={`tel:${lead.client.mobile}`}
                className="mt-0.5 block text-[14px] text-brand sm:text-[13px]"
              >
                {lead.client.mobile}
              </a>
              {lead.client.email ? (
                <p className="text-[13.5px] text-ink-3 sm:text-[12.5px]">{lead.client.email}</p>
              ) : null}
              <p className="mt-2 text-[13px] leading-relaxed text-ink-3 sm:text-[12px]">
                {lead.client.address}
              </p>
              <p className="mt-3 border-t border-line pt-2.5 text-[12.5px] leading-relaxed text-ink-4 sm:text-[11.5px]">
                Staff only. Vendors get the locality up front and the full address once a visit is
                confirmed — never the phone number.
              </p>
            </Panel>

            <Panel title="The enquiry">
              <p className="text-[14px] leading-relaxed text-ink-2 sm:text-[13px]">
                {lead.lead.description}
              </p>
              <dl className="mt-3 space-y-1.5 border-t border-line pt-3">
                {[
                  ["Services", lead.domainNames.join(", ")],
                  ["Urgency", urgencyLabel[lead.lead.urgency]],
                  [
                    "Budget",
                    lead.lead.budgetMax ? `up to ${formatRupees(lead.lead.budgetMax)}` : "Not stated",
                  ],
                  [
                    "Site notes",
                    lead.lead.siteAccessibilityTags.length
                      ? lead.lead.siteAccessibilityTags.join(", ").replace(/_/g, " ")
                      : "None given",
                  ],
                  ["Source", lead.lead.source.replace("_", " ")],
                  ["Agent", row.agentName ?? "Unassigned"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-[13px] text-ink-4 sm:text-[12px]">{label}</dt>
                    <dd className="text-right text-[13px] font-medium text-ink sm:text-[12px]">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </Panel>

            <Panel title={`Call history (${callLog.length})`} bodyClassName="p-0">
              {callLog.length === 0 ? (
                <p className="px-4 py-6 text-center text-[13.5px] text-ink-3 sm:text-[12.5px]">
                  Nothing logged. The first call is where the real scope gets captured.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {callLog.map(({ activity, agentName }) => (
                    <li key={activity.id} className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge tone={activity.callStatus === "connected" ? "positive" : "neutral"}>
                          {activity.callStatus.replace("_", " ")}
                        </Badge>
                        <span className="text-[12.5px] text-ink-4 sm:text-[11.5px]">
                          {formatDate(activity.createdAt)} · {agentName}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2 sm:text-[12px]">
                        {activity.remarks}
                      </p>
                      {activity.followUpDate ? (
                        <p className="mt-1 text-[12.5px] text-clay sm:text-[11.5px]">
                          Follow up {formatDate(activity.followUpDate)}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title={`Everything that happened (${timeline.length})`} bodyClassName="p-0">
              <LeadTimeline events={timeline} />
            </Panel>
          </aside>
        </div>
      </PageBody>
    </>
  );
}
