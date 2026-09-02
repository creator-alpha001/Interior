import { listSupportTickets } from "@repo/data";
import { NewTicketForm } from "@/components/account/new-ticket-form";
import { TicketReplyForm } from "@/components/account/ticket-reply-form";
import { Badge, Card, EmptyState, cn, formatDateTime } from "@repo/ui";

const statusTone = {
  open: "warning",
  in_progress: "brand",
  resolved: "positive",
  closed: "neutral",
} as const;

const statusLabel = {
  open: "Open",
  in_progress: "Being looked at",
  resolved: "Resolved",
  closed: "Closed",
} as const;

const categoryLabel = {
  complaint: "Complaint",
  escalation: "Escalation",
  refund: "Refund",
  query: "Question",
  technical: "Technical",
} as const;

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ raised?: string }>;
}) {
  const sp = await searchParams;
  const tickets = await listSupportTickets();

  return (
    <div className="space-y-6">
      {sp.raised ? (
        <div className="rounded-xl border border-positive/25 bg-positive-soft p-5">
          <h2 className="font-display text-[20px] text-ink">Ticket raised</h2>
          <p className="mt-1.5 text-[14.5px] sm:text-[13.5px] leading-relaxed text-ink-2">
            A named person from our team will pick this up. You will get a notification when they
            reply.
          </p>
        </div>
      ) : null}

      <Card>
        <h2 className="text-[15px] font-semibold text-ink">Raise it here, not with the vendor</h2>
        <p className="mt-2 text-[14.5px] sm:text-[13.5px] leading-relaxed text-ink-3">
          A ticket puts a named person from our team on the problem and creates a record. Issues
          raised in a phone call to a professional leave no trace, and in our experience those are
          the ones that do not get resolved.
        </p>
      </Card>

      <NewTicketForm />

      <div>
        <h2 className="mb-4 text-[22px]">Your tickets</h2>
        {tickets.length === 0 ? (
          <EmptyState
            title="No tickets"
            description="Nothing raised yet. If something goes wrong with a quote, a visit or a project, this is the place."
          />
        ) : (
          <div className="space-y-4">
            {tickets.map((ticket) => (
              <Card key={ticket.id} padded={false}>
                <div className="flex flex-wrap items-start justify-between gap-3 p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[13px] sm:text-[12px] text-ink-4">{ticket.reference}</span>
                      <Badge tone="neutral">{categoryLabel[ticket.category]}</Badge>
                      <Badge tone={statusTone[ticket.status]}>{statusLabel[ticket.status]}</Badge>
                      {ticket.priority === "high" || ticket.priority === "urgent" ? (
                        <Badge tone="danger">Priority</Badge>
                      ) : null}
                    </div>
                    <h3 className="mt-2.5 text-[16px] font-semibold text-ink">{ticket.subject}</h3>
                    <p className="mt-1.5 text-[14.5px] sm:text-[13.5px] leading-relaxed text-ink-2">{ticket.body}</p>
                  </div>
                  <span className="text-[13px] sm:text-[12px] text-ink-4">
                    {formatDateTime(ticket.createdAt)}
                  </span>
                </div>

                {ticket.replies.length > 0 ? (
                  <div className="border-t border-line bg-paper px-5 py-4">
                    <div className="space-y-3">
                      {ticket.replies.map((reply) => {
                        const fromClient = reply.authorRole === "client";
                        return (
                          <div
                            key={reply.id}
                            className={cn("flex", fromClient ? "justify-end" : "justify-start")}
                          >
                            <div className="max-w-[80%]">
                              <div
                                className={cn(
                                  "mb-1 text-[12.5px] sm:text-[11.5px] font-medium",
                                  fromClient ? "text-right text-ink-4" : "text-brand",
                                )}
                              >
                                {reply.authorName}
                              </div>
                              <div
                                className={cn(
                                  "rounded-xl px-4 py-2.5 text-[14.5px] sm:text-[13.5px] leading-relaxed",
                                  fromClient
                                    ? "rounded-br-sm bg-brand text-white"
                                    : "rounded-bl-sm bg-surface-2 text-ink-2",
                                )}
                              >
                                {reply.body}
                              </div>
                              <div
                                className={cn(
                                  "mt-1 text-[12px] sm:text-[11px] text-ink-4",
                                  fromClient && "text-right",
                                )}
                              >
                                {formatDateTime(reply.createdAt)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {ticket.status !== "closed" ? (
                  <div className="border-t border-line px-5 py-4">
                    <TicketReplyForm ticketId={ticket.id} />
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
