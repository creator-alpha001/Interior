import Link from "next/link";
import { notFound } from "next/navigation";
import { formatRupees, getVendorLead, listVendorThread } from "@repo/data";
import { Badge, cn, formatDate, formatDateTime, materialSourceLabel, meetingStatus, urgencyLabel } from "@repo/ui";
import { QuoteBuilder } from "@/components/quote-builder";
import { VendorMessageForm } from "@/components/vendor-message-form";
import { PageBody, PageHeader, Panel } from "@/components/panel-ui";
import { CURRENT_PROFESSIONAL_ID } from "@/lib/session";

type Params = { id: string };

const unitForDomain: Record<string, string> = {
  "dom-painting": "sq.ft",
  "dom-fabrication": "running ft",
  "dom-furniture": "piece",
  "dom-interior": "sq.ft",
};

export default async function VendorLeadPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const [card, thread] = await Promise.all([
    getVendorLead(id, CURRENT_PROFESSIONAL_ID),
    listVendorThread(id, CURRENT_PROFESSIONAL_ID),
  ]);
  if (!card) notFound();

  const won = card.leadDomain.selectedProfessionalId === CURRENT_PROFESSIONAL_ID;
  const lost =
    card.leadDomain.selectedProfessionalId !== null &&
    card.leadDomain.selectedProfessionalId !== CURRENT_PROFESSIONAL_ID;

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Leads", href: "/leads" }, { label: card.leadReference }]}
        title={`${card.domain.name} — ${card.client.displayName}`}
        subtitle={`${card.client.locality}, ${card.client.city.name} · assigned ${formatDate(
          card.assignment.assignedAt,
        )}`}
        actions={
          <>
            {card.urgency === "immediate" ? <Badge tone="danger">Immediate</Badge> : null}
            {won ? <Badge tone="positive">You won this</Badge> : null}
            {lost ? <Badge tone="neutral">Went to another vendor</Badge> : null}
          </>
        }
      />

      <PageBody className="space-y-4">
        {lost ? (
          <div className="rounded-lg border border-line bg-surface-2 p-4 text-[13px] leading-relaxed text-ink-2">
            The customer chose a different professional for this one. Nothing is owed, and it does
            not affect your rating — only completed work is rated.
          </div>
        ) : null}

        {/* The brief */}
        <Panel title="The job">
          <p className="text-[14px] leading-relaxed text-ink-2">{card.description}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="neutral">{materialSourceLabel[card.materialSource]}</Badge>
            <Badge tone="neutral">{urgencyLabel[card.urgency as "exploring"]}</Badge>
            {card.budgetMax ? (
              <Badge tone="neutral">Budget up to {formatRupees(card.budgetMax)}</Badge>
            ) : null}
            {card.siteNotes.map((note) => (
              <Badge key={note} tone="clay">
                {note.replace(/_/g, " ")}
              </Badge>
            ))}
          </div>

          {card.brief ? (
            <div className="mt-4 rounded-md border-l-2 border-brand bg-brand-soft px-3.5 py-3">
              <p className="text-[11.5px] font-semibold uppercase tracking-wider text-brand">
                Scope captured by our team
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{card.brief}</p>
              <p className="mt-2 text-[11.5px] text-ink-4">
                Every vendor quoting this job has the same brief — quote against exactly this.
              </p>
            </div>
          ) : null}

          {card.items.length > 0 ? (
            <div className="mt-4 rounded-md bg-paper p-3">
              <p className="text-[11.5px] uppercase tracking-wider text-ink-4">
                What the customer picked from the catalogue
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {card.items.map((item) => (
                  <li key={item.id} className="text-[12.5px] text-ink-2">
                    <span className="font-medium text-ink">
                      {item.quantity > 1 ? `${item.quantity} × ` : ""}
                      {item.itemName}
                    </span>
                    {Object.keys(item.selectedOptions).length > 0 ? (
                      <span className="text-ink-3">
                        {" — "}
                        {Object.entries(item.selectedOptions)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(", ")}
                      </span>
                    ) : null}
                    {item.customerNotes ? (
                      <div className="mt-0.5 text-[12px] italic text-ink-4">
                        “{item.customerNotes}”
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>

        {/* Site and contact — the masking rule made visible */}
        <Panel title="Site">
          <p className="text-[13.5px] text-ink">
            {card.client.address ?? `${card.client.locality}, ${card.client.city.name}`}
          </p>
          {!card.client.address ? (
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-4">
              The full address is released once a site visit is confirmed. Our coordinator arranges
              the slot with you and the customer separately — customer phone numbers are never
              shared.
            </p>
          ) : (
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-4">
              Released for your confirmed visit. Please do not contact the customer directly —
              anything you need goes through our coordinator.
            </p>
          )}

          {card.visits.length > 0 ? (
            <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
              {card.visits.map((visit) => {
                const ms = meetingStatus[visit.status];
                return (
                  <li key={visit.id} className="flex items-center justify-between gap-3">
                    <span className="text-[12.5px] text-ink-2">
                      {formatDateTime(visit.scheduledAt)} · {visit.type.replace("_", " ")}
                    </span>
                    <Badge tone={ms.tone}>{ms.label}</Badge>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </Panel>

        {/* Quote */}
        {!lost ? (
          <div>
            {card.competingQuotes > 0 && !won ? (
              <p className="mb-2 text-[12.5px] text-ink-3">
                {card.competingQuotes} other {card.competingQuotes === 1 ? "quote is" : "quotes are"}{" "}
                already in for this job.
              </p>
            ) : null}
            <QuoteBuilder
              leadDomainId={card.leadDomain.id}
              suggestedUnit={unitForDomain[card.domain.id] ?? "unit"}
              materialsLabel={card.domain.labels.materials}
              existing={card.myQuote}
            />
          </div>
        ) : card.myQuote ? (
          <Panel title="Your quote">
            <p className="tnum font-display text-[24px] text-ink">
              {formatRupees(card.myQuote.total)}
            </p>
            <p className="mt-1 text-[12.5px] text-ink-3">
              {card.myQuote.timelineDays} days · {card.myQuote.warrantyMonths} month warranty
            </p>
          </Panel>
        ) : null}

        {/* Coordinator thread */}
        <section className="overflow-hidden rounded-lg border border-line bg-surface">
          <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-ink-3">
              Messages with our team
            </h3>
            {card.unreadMessages > 0 ? (
              <Badge tone="warning">{card.unreadMessages} new</Badge>
            ) : null}
          </header>

          <div className="max-h-[320px] space-y-3 overflow-y-auto p-4">
            {thread.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-ink-3">
                Nothing yet. Ask us anything about the scope — we will put it to the customer.
              </p>
            ) : (
              thread.map((message) => {
                const fromMe = message.senderRole === "professional";
                return (
                  <div key={message.id} className={cn("flex", fromMe ? "justify-end" : "justify-start")}>
                    <div className="max-w-[85%]">
                      <div
                        className={cn(
                          "rounded-lg px-3 py-2 text-[13px] leading-relaxed",
                          fromMe
                            ? "rounded-br-sm bg-brand text-white"
                            : "rounded-bl-sm bg-surface-2 text-ink-2",
                        )}
                      >
                        {message.body}
                      </div>
                      <div
                        className={cn(
                          "mt-1 text-[11px] text-ink-4",
                          fromMe ? "text-right" : "text-left",
                        )}
                      >
                        {fromMe ? "You" : "Aangan team"} · {formatDateTime(message.createdAt)}
                        {message.relayedFromMessageId ? " · from the customer" : ""}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <VendorMessageForm leadDomainId={card.leadDomain.id} />
        </section>

        <p className="text-center text-[12px] text-ink-4">
          <Link href="/leads" className="text-brand">
            ← All leads
          </Link>
        </p>
      </PageBody>
    </>
  );
}
