import { listAllTickets } from "@repo/data";
import type { SupportTicket } from "@repo/types";
import { Badge, cn, formatDateTime } from "@repo/ui";
import { TicketActions } from "@/components/ticket-actions";
import { FilterBar, FilterGroup, Metric, PageBody, PageHeader, Panel } from "@/components/ops-ui";

export const metadata = { title: "Support" };

const statusTone = {
  open: "warning",
  in_progress: "brand",
  resolved: "positive",
  closed: "neutral",
} as const;

const priorityTone = {
  urgent: "danger",
  high: "danger",
  medium: "neutral",
  low: "neutral",
} as const;

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const [all, rows] = await Promise.all([
    listAllTickets(),
    listAllTickets((sp.status as SupportTicket["status"]) ?? "all"),
  ]);

  return (
    <>
      <PageHeader
        title="Support"
        subtitle="Complaints, escalations and questions from clients and vendors. Priority first."
      />

      <PageBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Open"
            value={all.filter((r) => r.ticket.status === "open").length}
            tone={all.some((r) => r.ticket.status === "open") ? "urgent" : "default"}
          />
          <Metric label="In progress" value={all.filter((r) => r.ticket.status === "in_progress").length} />
          <Metric
            label="High priority"
            value={all.filter((r) => ["high", "urgent"].includes(r.ticket.priority)).length}
            hint="Complaints and escalations"
          />
          <Metric
            label="Resolved"
            value={all.filter((r) => r.ticket.status === "resolved").length}
            tone="positive"
          />
        </div>

        <FilterBar>
          <FilterGroup
            label="Status"
            current={sp.status ?? "all"}
            hrefFor={(value) => (value === "all" ? "/support" : `/support?status=${value}`)}
            options={[
              { value: "all", label: "All", count: all.length },
              { value: "open", label: "Open", count: all.filter((r) => r.ticket.status === "open").length },
              { value: "in_progress", label: "In progress", count: all.filter((r) => r.ticket.status === "in_progress").length },
              { value: "resolved", label: "Resolved", count: all.filter((r) => r.ticket.status === "resolved").length },
            ]}
          />
        </FilterBar>

        {rows.length === 0 ? (
          <Panel>
            <p className="py-8 text-center text-[13px] text-ink-3">No tickets match this filter.</p>
          </Panel>
        ) : (
          <div className="space-y-3">
            {rows.map(({ ticket, raisedByName, raisedByRole }) => (
              <div key={ticket.id} className="overflow-hidden rounded-lg border border-line bg-surface">
                <div className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11.5px] text-ink-4">
                          {ticket.reference}
                        </span>
                        <Badge tone={statusTone[ticket.status]}>
                          {ticket.status.replace("_", " ")}
                        </Badge>
                        <Badge tone={priorityTone[ticket.priority]}>{ticket.priority}</Badge>
                        <Badge tone="neutral">{ticket.category}</Badge>
                      </div>
                      <h3 className="mt-2 text-[14.5px] font-semibold text-ink">
                        {ticket.subject}
                      </h3>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">{ticket.body}</p>
                      <p className="mt-1.5 text-[11.5px] text-ink-4">
                        {raisedByName} · {raisedByRole.replace("_", " ")} ·{" "}
                        {formatDateTime(ticket.createdAt)}
                      </p>
                    </div>
                  </div>

                  {ticket.replies.length > 0 ? (
                    <div className="mt-3 space-y-2 border-t border-line pt-3">
                      {ticket.replies.map((reply) => (
                        <div
                          key={reply.id}
                          className={cn(
                            "rounded-md px-3 py-2 text-[12.5px] leading-relaxed",
                            reply.authorRole === "platform"
                              ? "bg-brand-soft text-ink-2"
                              : "bg-surface-2 text-ink-2",
                          )}
                        >
                          <span className="mr-1.5 font-medium text-ink">{reply.authorName}:</span>
                          {reply.body}
                          <span className="ml-2 text-[11px] text-ink-4">
                            {formatDateTime(reply.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <TicketActions ticketId={ticket.id} status={ticket.status} />
              </div>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}
