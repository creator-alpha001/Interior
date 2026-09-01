import Link from "next/link";
import { formatRupees, formatRupeesShort, getMyDay } from "@repo/data";
import type { OpsLeadRow } from "@repo/data";
import { Badge, formatDate, urgencyLabel } from "@repo/ui";
import { Metric, PageBody, PageHeader, Panel } from "@/components/ops-ui";
import { CURRENT_AGENT_ID } from "@/lib/session";

export const metadata = { title: "My day" };

/**
 * A worklist, not a report. Everything here is unfinished — closed leads are
 * excluded entirely — and the two things that actually cost the business money
 * if ignored, unanswered clients and unpaid commission, lead the page.
 */
export default async function MyDayPage() {
  const day = await getMyDay(CURRENT_AGENT_ID);
  const { commission } = day;

  // One lead can need several things; the queue is deduplicated by urgency of
  // action so nobody works the same lead twice in a morning.
  const seen = new Set<string>();
  const queue: Array<{ row: OpsLeadRow; reason: string; tone: "danger" | "warning" | "neutral" }> =
    [];
  const push = (rows: OpsLeadRow[], reason: string, tone: "danger" | "warning" | "neutral") => {
    for (const row of rows) {
      if (seen.has(row.lead.lead.id)) continue;
      seen.add(row.lead.lead.id);
      queue.push({ row, reason, tone });
    }
  };
  push(day.awaitingReply, "Client is waiting on a reply", "danger");
  push(day.neverCalled, "Never called — scope not captured", "danger");
  push(day.needsAssignment, "Needs professionals assigned", "warning");
  push(day.followUpsDue, "Follow-up due", "warning");
  push(day.stalled, "Nothing has moved in two weeks", "neutral");

  const untouched = day.live.filter((r) => !seen.has(r.lead.lead.id));

  return (
    <>
      <PageHeader
        title={`Good morning, ${day.agentName.split(" ")[0]}`}
        subtitle={`${queue.length} ${queue.length === 1 ? "lead needs" : "leads need"} action today · ${day.live.length} live in total`}
        actions={
          <Link
            href="/leads"
            className="rounded-md bg-surface-2 px-3 py-1.5 text-[13.5px] text-ink-2 hover:text-ink sm:text-[12.5px]"
          >
            Full lead queue
          </Link>
        }
      />

      <PageBody className="space-y-5">
        {/* Money first: it is the only thing here with a deadline attached. */}
        <section className="overflow-hidden rounded-lg border border-line bg-surface">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-3 sm:text-[12px]">
              Commission
            </h2>
            <Link href="/commission" className="text-[13px] font-medium text-brand sm:text-[12px]">
              Manage →
            </Link>
          </header>

          <div className="grid gap-px bg-line sm:grid-cols-3">
            <div className="bg-surface p-4">
              <p className="text-[12.5px] uppercase tracking-wider text-ink-4 sm:text-[11.5px]">
                Overdue
              </p>
              <p
                className={
                  commission.overdue > 0
                    ? "tnum mt-1 font-display text-[30px] leading-none text-danger"
                    : "tnum mt-1 font-display text-[30px] leading-none text-ink-4"
                }
              >
                {formatRupeesShort(commission.overdue)}
              </p>
              <p className="mt-1.5 text-[13px] text-ink-3 sm:text-[12px]">
                {commission.overdueCount}{" "}
                {commission.overdueCount === 1 ? "invoice" : "invoices"} past due
              </p>
            </div>
            <div className="bg-surface p-4">
              <p className="text-[12.5px] uppercase tracking-wider text-ink-4 sm:text-[11.5px]">
                Pending
              </p>
              <p className="tnum mt-1 font-display text-[30px] leading-none text-ink">
                {formatRupeesShort(commission.pending)}
              </p>
              <p className="mt-1.5 text-[13px] text-ink-3 sm:text-[12px]">
                {commission.dueSoonCount} due within a week
              </p>
            </div>
            <div className="bg-surface p-4">
              <p className="text-[12.5px] uppercase tracking-wider text-ink-4 sm:text-[11.5px]">
                Total outstanding
              </p>
              <p className="tnum mt-1 font-display text-[30px] leading-none text-brand">
                {formatRupeesShort(commission.pending + commission.overdue)}
              </p>
              <p className="mt-1.5 text-[13px] text-ink-3 sm:text-[12px]">
                Billed per agreement, not per job
              </p>
            </div>
          </div>

          {commission.rows.length > 0 ? (
            <ul className="divide-y divide-line border-t border-line">
              {commission.rows.slice(0, 5).map((row) => (
                <li
                  key={row.invoiceId}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/vendors/${row.professionalId}`}
                        className="text-[14px] font-medium text-ink hover:text-brand sm:text-[13px]"
                      >
                        {row.professionalName}
                      </Link>
                      {row.daysOverdue > 0 ? (
                        <Badge tone="danger">{row.daysOverdue}d late</Badge>
                      ) : (
                        <span className="text-[12.5px] text-ink-4 sm:text-[11.5px]">
                          due {formatDate(row.dueDate)}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-ink-4 sm:text-[11.5px]">
                      {row.reference} · {row.domains.filter(Boolean).join(" + ") || "—"}
                    </p>
                  </div>
                  <span className="tnum text-[14px] font-semibold text-ink sm:text-[13.5px]">
                    {formatRupees(row.amount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="border-t border-line px-4 py-6 text-center text-[14px] text-ink-3 sm:text-[13px]">
              Nothing outstanding.
            </p>
          )}
        </section>

        {/* Operational counters, all of them actionable. */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Awaiting our reply"
            value={day.awaitingReply.length}
            hint="Clients who wrote and heard nothing"
            tone={day.awaitingReply.length > 0 ? "urgent" : "default"}
            href="/leads?view=awaiting"
          />
          <Metric
            label="To assign"
            value={day.needsAssignment.length}
            hint="Services with no professionals yet"
            tone={day.needsAssignment.length > 0 ? "urgent" : "default"}
            href="/leads?view=unassigned"
          />
          <Metric label="Visits today" value={day.visitsToday} hint="Across all services" href="/visits" />
          <Metric
            label="Visits without an outcome"
            value={day.visitsNeedingOutcome}
            hint="Been and gone, nothing written up"
            tone={day.visitsNeedingOutcome > 0 ? "urgent" : "default"}
            href="/visits"
          />
        </div>

        {/* The worklist itself. */}
        <Panel
          title={`Work queue (${queue.length})`}
          action={
            <span className="text-[12.5px] text-ink-4 sm:text-[11.5px]">
              Most urgent action first
            </span>
          }
          bodyClassName="p-0"
        >
          {queue.length === 0 ? (
            <p className="px-4 py-10 text-center text-[14px] text-ink-3 sm:text-[13px]">
              Nothing needs you right now. Genuinely rare.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {queue.map(({ row, reason, tone }) => (
                <li key={row.lead.lead.id}>
                  <Link
                    href={`/leads/${row.lead.lead.id}`}
                    className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={tone}>{reason}</Badge>
                        <span className="text-[14.5px] font-medium text-ink sm:text-[13.5px]">
                          {row.lead.client.name}
                        </span>
                        <span className="font-mono text-[12px] text-ink-4 sm:text-[11.5px]">
                          {row.lead.lead.reference}
                        </span>
                        {row.lead.lead.urgency === "immediate" ? (
                          <Badge tone="danger">Immediate</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 line-clamp-1 text-[13.5px] text-ink-3 sm:text-[12.5px]">
                        {row.lead.lead.description}
                      </p>
                      <p className="mt-1 text-[12.5px] text-ink-4 sm:text-[11.5px]">
                        {row.lead.domainNames.join(" · ")} · {row.lead.city.name}
                        {row.followUpDate ? ` · follow up ${formatDate(row.followUpDate)}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[13px] text-ink-2 sm:text-[12.5px]">{row.ageDays}d old</div>
                      <div className="mt-0.5 text-[12.5px] text-ink-4 sm:text-[11.5px]">
                        {row.agentName ?? "Unassigned"}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {untouched.length > 0 ? (
          <Panel
            title={`Live, nothing outstanding (${untouched.length})`}
            action={
              <span className="text-[12.5px] text-ink-4 sm:text-[11.5px]">
                Waiting on the client or a vendor
              </span>
            }
            bodyClassName="p-0"
          >
            <ul className="divide-y divide-line">
              {untouched.map((row) => (
                <li key={row.lead.lead.id}>
                  <Link
                    href={`/leads/${row.lead.lead.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] text-ink sm:text-[13px]">
                          {row.lead.client.name}
                        </span>
                        <span className="font-mono text-[12px] text-ink-4 sm:text-[11.5px]">
                          {row.lead.lead.reference}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[12.5px] text-ink-4 sm:text-[11.5px]">
                        {row.lead.domainNames.join(" · ")}
                      </p>
                    </div>
                    <Badge tone="neutral">{urgencyLabel[row.lead.lead.urgency]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </PageBody>
    </>
  );
}
