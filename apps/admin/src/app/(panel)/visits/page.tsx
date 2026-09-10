import Link from "next/link";
import { listVisitsForAgent } from "@repo/data";
import { Badge, formatDate, meetingStatus } from "@repo/ui";
import { VisitOutcomeForm } from "@/components/visit-outcome-form";
import { Metric, PageBody, PageHeader, Panel } from "@/components/ops-ui";

export const metadata = { title: "Site visits" };

/**
 * Grouped by day rather than shown as a month grid: the coordinator's question
 * is always "what is happening today and tomorrow", not "what does April look
 * like". Reschedule requests surface at the top because they need action.
 */
export default async function VisitsPage() {
  const visits = await listVisitsForAgent();
  const today = new Date().toISOString().slice(0, 10);

  const needsAction = visits.filter((v) => v.meeting.rescheduleRequestedAt !== null);
  const upcoming = visits.filter(
    (v) => v.meeting.scheduledAt.slice(0, 10) >= today && v.meeting.status !== "completed",
  );
  const past = visits
    .filter((v) => v.meeting.scheduledAt.slice(0, 10) < today || v.meeting.status === "completed")
    .reverse();

  // A visit that has happened but was never written up is the most common way
  // scope quietly diverges between three vendors, so it leads the page.
  const needsOutcome = visits.filter(
    (v) =>
      v.meeting.scheduledAt.slice(0, 10) <= today &&
      !v.meeting.outcome &&
      v.meeting.status !== "no_show",
  );

  const byDay = upcoming.reduce<Record<string, typeof upcoming>>((acc, visit) => {
    const day = visit.meeting.scheduledAt.slice(0, 10);
    (acc[day] ??= []).push(visit);
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Site visits"
        subtitle={`${upcoming.length} upcoming · ${needsOutcome.length} awaiting a write-up`}
      />

      <PageBody className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Upcoming" value={upcoming.length} hint="Booked and confirmed" />
          <Metric
            label="Needs an outcome"
            value={needsOutcome.length}
            hint="Visited, nothing written up"
            tone={needsOutcome.length > 0 ? "urgent" : "default"}
          />
          <Metric
            label="Reschedule requested"
            value={needsAction.length}
            hint="Client asked for a new slot"
            tone={needsAction.length > 0 ? "urgent" : "default"}
          />
        </div>

        {needsOutcome.length > 0 ? (
          <Panel
            title={`Write up what these visits established (${needsOutcome.length})`}
            action={
              <span className="text-[12.5px] text-ink-4 sm:text-[11.5px]">
                Optional, but it is what keeps three quotes comparable
              </span>
            }
            bodyClassName="p-0"
          >
            <ul className="divide-y divide-line">
              {needsOutcome.map(({ meeting, professional, leadId, leadReference, domain, city }) => (
                <li key={meeting.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14.5px] font-medium text-ink sm:text-[13.5px]">
                        {professional.companyName}
                      </span>
                      <Badge tone="neutral">{domain.name}</Badge>
                      <Link
                        href={`/leads/${leadId}`}
                        className="font-mono text-[12px] text-ink-4 hover:text-brand sm:text-[11.5px]"
                      >
                        {leadReference}
                      </Link>
                    </div>
                    <span className="text-[12.5px] text-ink-4 sm:text-[11.5px]">
                      {formatDate(meeting.scheduledAt)} · {city.name}
                    </span>
                  </div>
                  <VisitOutcomeForm
                    meetingId={meeting.id}
                    leadId={leadId}
                    outcome={meeting.outcome}
                    recordedAt={meeting.outcomeRecordedAt}
                    changedScope={meeting.outcomeChangedScope}
                  />
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
        {needsAction.length > 0 ? (
          <Panel title="Reschedule requested" bodyClassName="p-0">
            <ul className="divide-y divide-line">
              {needsAction.map(({ meeting, professional, leadReference, domain }) => (
                <li key={meeting.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13.5px] font-medium text-ink">
                        {professional.companyName}
                      </span>
                      <Badge tone="neutral">{domain.name}</Badge>
                      <span className="font-mono text-[11.5px] text-ink-4">{leadReference}</span>
                    </div>
                    <Badge tone="warning">Needs a new slot</Badge>
                  </div>
                  <p className="mt-1.5 text-[12.5px] text-ink-2">
                    Client asked: “{meeting.rescheduleNote}”
                  </p>
                  <p className="mt-1 text-[11.5px] text-ink-4">
                    Confirm a new time with the vendor, then book it on the lead.
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        {Object.keys(byDay).length === 0 ? (
          <Panel>
            <p className="py-8 text-center text-[13px] text-ink-3">
              No upcoming visits. Book them from a lead once vendors are assigned.
            </p>
          </Panel>
        ) : (
          Object.entries(byDay).map(([day, dayVisits]) => (
            <Panel
              key={day}
              title={`${formatDate(day)}${day === today ? " · today" : ""}`}
              bodyClassName="p-0"
            >
              <ul className="divide-y divide-line">
                {dayVisits.map(({ meeting, professional, leadId, leadReference, domain, city }) => {
                  const ms = meetingStatus[meeting.status];
                  return (
                    <li key={meeting.id} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="flex gap-4">
                        <span className="tnum w-16 shrink-0 text-[13px] font-medium text-ink">
                          {new Date(meeting.scheduledAt).toLocaleTimeString("en-IN", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[13.5px] font-medium text-ink">
                              {professional.companyName}
                            </span>
                            <Badge tone="neutral">{domain.name}</Badge>
                          </div>
                          <p className="mt-0.5 text-[12px] text-ink-4">
                            {meeting.type.replace("_", " ")} · {city.name} ·{" "}
                            <Link href={`/leads/${leadId}`} className="text-brand">
                              {leadReference}
                            </Link>
                          </p>
                          <p className="mt-0.5 truncate text-[11.5px] text-ink-4">
                            {meeting.location}
                          </p>
                        </div>
                      </div>
                      <Badge tone={ms.tone}>{ms.label}</Badge>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ))
        )}

        {past.length > 0 ? (
          <Panel title={`Past visits (${past.length})`} bodyClassName="p-0">
            <ul className="divide-y divide-line">
              {past.slice(0, 10).map(({ meeting, professional, leadId, leadReference, domain }) => {
                const ms = meetingStatus[meeting.status];
                return (
                  <li key={meeting.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] text-ink-2">{professional.companyName}</span>
                        <Badge tone="neutral">{domain.name}</Badge>
                        <span className="font-mono text-[11px] text-ink-4">{leadReference}</span>
                      </div>
                      {/* The outcome is the useful record; the note is what the
                          coordinator jotted at the time. Prefer the former. */}
                      {meeting.outcome ? (
                        <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-ink-3">
                          {meeting.outcome}
                        </p>
                      ) : meeting.notes ? (
                        <p className="mt-0.5 line-clamp-1 text-[11.5px] italic text-ink-4">
                          {meeting.notes}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-[11.5px] text-ink-4">No outcome recorded</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      {meeting.outcomeChangedScope ? (
                        <Badge tone="clay">Scope changed</Badge>
                      ) : null}
                      <Badge tone={ms.tone}>{ms.label}</Badge>
                      <p className="mt-0.5 text-[11px] text-ink-4">
                        {formatDate(meeting.scheduledAt)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>
        ) : null}
      </PageBody>
    </>
  );
}
