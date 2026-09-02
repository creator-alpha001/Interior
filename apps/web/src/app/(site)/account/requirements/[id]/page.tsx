import Link from "next/link";
import { notFound } from "next/navigation";
import { formatRupees, getLead, listClientMessages } from "@repo/data";
import type { LeadDomainView, LeadView } from "@repo/types";
import { DomainTabs } from "@/components/account/domain-tabs";
import { SelectQuoteButton } from "@/components/account/select-quote-button";
import { GenerateAgreementsButton } from "@/components/account/generate-agreements-button";
import { MessageComposer } from "@/components/account/message-composer";
import { RescheduleButton } from "@/components/account/reschedule-button";
import {
  Badge,
  ButtonLink,
  Card,
  RatingLine,
  VerifiedBadge,
} from "@repo/ui";
import {
  formatDate,
  formatDateTime,
  leadDomainStatus,
  materialSourceLabel,
  meetingStatus,
  urgencyLabel,
} from "@repo/ui";
import { cn } from "@repo/ui";

type Params = { id: string };

export default async function RequirementDetailPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ new?: string; selected?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const lead = await getLead(id);
  if (!lead) notFound();

  const messagesByDomain = Object.fromEntries(
    await Promise.all(
      lead.domains.map(
        async (d) => [d.leadDomain.id, await listClientMessages(d.leadDomain.id)] as const,
      ),
    ),
  );

  const allSelected =
    lead.domains.length > 0 &&
    lead.domains.every((d) => d.leadDomain.selectedProfessionalId !== null);
  const anySelected = lead.domains.some((d) => d.leadDomain.selectedProfessionalId !== null);

  return (
    <div className="space-y-8">
      <Link href="/account/requirements" className="text-[14.5px] sm:text-[13.5px] text-ink-3 hover:text-ink">
        ← All requirements
      </Link>

      {sp.new ? (
        <div className="rounded-xl border border-positive/25 bg-positive-soft p-5">
          <h2 className="font-display text-[20px] text-ink">Requirement received</h2>
          <p className="mt-1.5 text-[14.5px] sm:text-[13.5px] leading-relaxed text-ink-2">
            Our team will call you shortly to confirm the details, then assign three verified
            professionals for each service you selected. You will get a notification as soon as they
            are assigned.
          </p>
        </div>
      ) : null}

      {sp.selected ? (
        <div className="rounded-xl border border-brand-line bg-brand-soft p-5">
          <h2 className="font-display text-[20px] text-ink">Professional selected</h2>
          <p className="mt-1.5 text-[14.5px] sm:text-[13.5px] leading-relaxed text-ink-2">
            {allSelected
              ? "Every service now has a professional. Generate your agreements to move ahead."
              : "Choose a professional for the remaining service to generate your agreements."}
          </p>
        </div>
      ) : null}

      {/* Header */}
      <div className="rounded-xl border border-line bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[13.5px] sm:text-[12.5px] text-ink-4">{lead.lead.reference}</span>
              <Badge>{urgencyLabel[lead.lead.urgency]}</Badge>
              <Badge>{lead.city.name}</Badge>
              {lead.isMultiDomain ? (
                <Badge tone="clay">{lead.domains.length} services</Badge>
              ) : null}
            </div>
            <p className="mt-3 text-[16px] leading-relaxed text-ink-2">{lead.lead.description}</p>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[14px] sm:text-[13px] text-ink-3">
              <span>Raised {formatDate(lead.lead.createdAt)}</span>
              {lead.lead.budgetMax ? (
                <span>
                  Budget up to {formatRupees(lead.lead.budgetMax)}
                </span>
              ) : null}
              {lead.lead.siteAccessibilityTags.length > 0 ? (
                <span>
                  Site notes: {lead.lead.siteAccessibilityTags.join(", ").replace(/_/g, " ")}
                </span>
              ) : null}
            </div>
          </div>

          {allSelected ? (
            <GenerateAgreementsButton leadId={lead.lead.id} />
          ) : null}
        </div>

        {lead.isMultiDomain ? (
          <p className="mt-5 rounded-lg bg-paper p-4 text-[14px] sm:text-[13px] leading-relaxed text-ink-3">
            This requirement covers {lead.domains.length} services. Each runs independently — its own
            professionals, its own quotes, its own timeline. If you end up choosing the same
            professional for more than one of them, those collapse into a single combined agreement
            rather than two separate contracts.
          </p>
        ) : null}
      </div>

      {/* Per-domain panels */}
      <DomainTabs
        tabs={lead.domains.map((d) => ({
          label: d.domain.name,
          hint: leadDomainStatus[d.leadDomain.status].label,
          badge: d.leadDomain.status === "quoted" ? `${d.quotes.length} quotes` : undefined,
        }))}
        panels={lead.domains.map((d) => (
          <DomainPanel
            key={d.leadDomain.id}
            lead={lead}
            view={d}
            messages={messagesByDomain[d.leadDomain.id] ?? []}
          />
        ))}
      />

      {anySelected && !allSelected ? (
        <div className="rounded-xl border border-warning/25 bg-warning-soft p-5 text-[14.5px] sm:text-[13.5px] leading-relaxed text-ink-2">
          Agreements are generated once every service has a professional selected — that way we can
          tell whether two services should share one contract or need two.
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function DomainPanel({
  lead,
  view,
  messages,
}: {
  lead: LeadView;
  view: LeadDomainView;
  messages: Awaited<ReturnType<typeof listClientMessages>>;
}) {
  const status = leadDomainStatus[view.leadDomain.status];
  const cheapest = view.quotes[0]?.quote.total;
  const fastest = Math.min(...view.quotes.map((q) => q.quote.timelineDays));

  return (
    <div className="space-y-6">
      {/* Status strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-[22px] text-ink">{view.domain.name}</h2>
          <Badge tone={status.tone}>{status.label}</Badge>
          <Badge tone="neutral">{materialSourceLabel[view.leadDomain.materialSource]}</Badge>
        </div>
        <span className="text-[13.5px] sm:text-[12.5px] text-ink-4">{view.domain.labels.pricingBasis}</span>
      </div>

      {/* Catalogue selections */}
      {view.items.length > 0 ? (
        <Card>
          <h3 className="text-[14px] sm:text-[13px] font-semibold uppercase tracking-[0.1em] text-ink-4">
            What you selected
          </h3>
          <div className="mt-3 space-y-3">
            {view.items.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-paper p-3.5"
              >
                <div>
                  <p className="text-[15px] sm:text-[14px] font-medium text-ink">
                    {item.quantity > 1 ? `${item.quantity} × ` : ""}
                    {item.itemName}
                  </p>
                  {Object.keys(item.selectedOptions).length > 0 ? (
                    <p className="mt-1 text-[13.5px] sm:text-[12.5px] text-ink-3">
                      {Object.entries(item.selectedOptions)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" · ")}
                    </p>
                  ) : null}
                  {item.customerNotes ? (
                    <p className="mt-1 text-[13.5px] sm:text-[12.5px] italic text-ink-3">{item.customerNotes}</p>
                  ) : null}
                </div>
                {item.indicativePrice ? (
                  <span className="text-[14px] sm:text-[13px] text-ink-4">
                    ~{formatRupees(item.indicativePrice)} indicative
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Did we get the professional you asked for? */}
      {view.leadDomain.preferredProfessionalId ? (
        view.leadDomain.preferenceUnmetReason ? (
          <div className="rounded-xl border border-warning/25 bg-warning-soft p-5">
            <p className="text-[14px] sm:text-[13px] font-semibold uppercase tracking-[0.1em] text-warning">
              The professional you asked for is not available
            </p>
            <p className="mt-2 text-[15px] sm:text-[14px] leading-relaxed text-ink-2">
              {view.leadDomain.preferenceUnmetReason} We have assigned three others for this
              service so you are not held up waiting on one person.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-brand-line bg-brand-soft p-5">
            <p className="text-[14px] sm:text-[13px] font-semibold uppercase tracking-[0.1em] text-brand">
              The professional you asked for is included
            </p>
            <p className="mt-2 text-[15px] sm:text-[14px] leading-relaxed text-ink-2">
              They are one of the three quoting for this service. Compare all three before you
              decide — asking for them does not commit you to them.
            </p>
          </div>
        )
      ) : null}

      {/* Assigned professionals */}
      {view.assignments.length > 0 ? (
        <div>
          <h3 className="mb-3 text-[15px] font-semibold text-ink">
            Assigned professionals ({view.assignments.length})
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {view.assignments.map(({ assignment, professional }) => {
              const isSelected = view.leadDomain.selectedProfessionalId === professional.id;
              return (
                <div
                  key={assignment.id}
                  className={cn(
                    "rounded-xl border bg-surface p-4",
                    isSelected ? "border-brand ring-1 ring-brand/20" : "border-line",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft font-display text-[17px] text-brand">
                      {professional.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/professionals/${professional.id}`}
                        className="block truncate text-[15px] sm:text-[14px] font-semibold text-ink hover:text-brand"
                      >
                        {professional.name}
                      </Link>
                      <p className="truncate text-[13.5px] sm:text-[12.5px] text-ink-3">
                        {professional.companyName}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <RatingLine
                      value={professional.domainRating?.avgRating ?? professional.avgRating}
                      count={professional.domainRating?.ratingCount}
                    />
                    {professional.isVerified ? <VerifiedBadge /> : null}
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[13px] sm:text-[12px]">
                    <span className="text-ink-4">
                      {professional.experienceYears} yrs · {professional.completedProjects} projects
                    </span>
                    {isSelected ? (
                      <Badge tone="brand">Selected</Badge>
                    ) : view.leadDomain.preferredProfessionalId === professional.id ? (
                      <Badge tone="clay">You asked for this one</Badge>
                    ) : assignment.responseStatus === "accepted" ? (
                      <Badge tone="positive">Accepted</Badge>
                    ) : assignment.responseStatus === "rejected" ? (
                      <Badge tone="danger">Unavailable</Badge>
                    ) : (
                      <Badge tone="warning">Awaiting reply</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <Card>
          <h3 className="font-display text-[19px]">Finding professionals for you</h3>
          <p className="mt-2 text-[15px] sm:text-[14px] leading-relaxed text-ink-3">
            Our team is calling {view.domain.name.toLowerCase()} vendors in {lead.city.name} to
            confirm availability before assigning them. You will be notified as soon as three are
            assigned — usually within a working day.
          </p>
        </Card>
      )}

      {/* Site visits */}
      {view.meetings.length > 0 ? (
        <Card>
          <h3 className="text-[14px] sm:text-[13px] font-semibold uppercase tracking-[0.1em] text-ink-4">
            Site visits
          </h3>
          <p className="mt-2 text-[13.5px] sm:text-[12.5px] leading-relaxed text-ink-3">
            Arranged by our team, who confirm the slot with you and the professional separately. The
            professional is given your address only for a confirmed visit, and never your phone
            number.
          </p>
          <div className="mt-3 divide-y divide-line">
            {view.meetings.map(({ meeting, professional }) => {
              const ms = meetingStatus[meeting.status];
              return (
                <div
                  key={meeting.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-[15px] sm:text-[14px] font-medium text-ink">{professional.companyName}</p>
                    <p className="mt-0.5 text-[13.5px] sm:text-[12.5px] text-ink-3">
                      {formatDateTime(meeting.scheduledAt)} · {meeting.type.replace("_", " ")}
                    </p>
                    {meeting.notes ? (
                      <p className="mt-1 text-[13.5px] sm:text-[12.5px] italic text-ink-3">{meeting.notes}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge tone={ms.tone}>{ms.label}</Badge>
                    {meeting.status === "scheduled" || meeting.status === "confirmed" ? (
                      <RescheduleButton meetingId={meeting.id} leadId={lead.lead.id} />
                    ) : null}
                  </div>
                  {meeting.rescheduleNote ? (
                    <p className="w-full text-[13.5px] sm:text-[12.5px] text-ink-3">
                      You asked to reschedule: “{meeting.rescheduleNote}” — we are confirming a new
                      slot with the professional.
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {/* Compare quotes */}
      {view.quotes.length > 0 ? (
        <div>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-[15px] font-semibold text-ink">
              Compare quotes ({view.quotes.length})
            </h3>
            <p className="text-[13.5px] sm:text-[12.5px] text-ink-4">
              All figures include GST. Sorted by price.
            </p>
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-line bg-surface lg:block">
            <table className="w-full text-[14.5px] sm:text-[13.5px]">
              <thead className="bg-surface-2 text-[12.5px] sm:text-[11.5px] uppercase tracking-wider text-ink-3">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Professional</th>
                  <th className="px-4 py-3 text-right font-semibold">Price</th>
                  <th className="px-4 py-3 text-left font-semibold">Timeline</th>
                  <th className="px-4 py-3 text-left font-semibold">{view.domain.labels.warranty}</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    {view.domain.labels.materials}
                  </th>
                  <th className="px-4 py-3 text-right font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {view.quotes.map(({ quote, professional }) => {
                  const isSelected = view.leadDomain.selectedQuoteId === quote.id;
                  return (
                    <tr
                      key={quote.id}
                      className={cn(
                        "border-t border-line align-top",
                        isSelected && "bg-brand-soft/50",
                      )}
                    >
                      <td className="px-4 py-4">
                        <Link
                          href={`/professionals/${professional.id}`}
                          className="font-medium text-ink hover:text-brand"
                        >
                          {professional.name}
                        </Link>
                        <div className="mt-0.5 text-[13.5px] sm:text-[12.5px] text-ink-3">
                          {professional.companyName}
                        </div>
                        <div className="mt-1.5">
                          <RatingLine
                            value={professional.domainRating?.avgRating ?? professional.avgRating}
                            count={professional.domainRating?.ratingCount}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="font-display text-[19px] text-ink">
                          {formatRupees(quote.total)}
                        </div>
                        {quote.total === cheapest ? (
                          <span className="mt-1 inline-block text-[12.5px] sm:text-[11.5px] font-medium text-positive">
                            Lowest
                          </span>
                        ) : (
                          <span className="mt-1 inline-block text-[12.5px] sm:text-[11.5px] text-ink-4">
                            +{formatRupees(quote.total - (cheapest ?? 0))}
                          </span>
                        )}
                        <div className="mt-1 text-[12.5px] sm:text-[11.5px] text-ink-4">
                          incl. {quote.taxPercent}% GST
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-ink">{quote.timelineDays} days</div>
                        {quote.timelineDays === fastest ? (
                          <span className="mt-1 inline-block text-[12.5px] sm:text-[11.5px] font-medium text-positive">
                            Fastest
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-ink">{quote.warrantyMonths} months</div>
                        <div className="mt-1 max-w-[220px] text-[13px] sm:text-[12px] leading-snug text-ink-3">
                          {quote.warrantyDetails}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="max-w-[260px] text-[13.5px] sm:text-[12.5px] leading-snug text-ink-2">
                          {quote.materialsSummary}
                        </div>
                        {quote.notes ? (
                          <div className="mt-1.5 max-w-[260px] text-[13px] sm:text-[12px] italic leading-snug text-ink-3">
                            {quote.notes}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {isSelected ? (
                          <Badge tone="brand">Selected</Badge>
                        ) : view.leadDomain.selectedQuoteId ? (
                          <span className="text-[13px] sm:text-[12px] text-ink-4">Not selected</span>
                        ) : (
                          <SelectQuoteButton
                            leadDomainId={view.leadDomain.id}
                            quoteId={quote.id}
                            leadId={lead.lead.id}
                            label="Choose"
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-4 lg:hidden">
            {view.quotes.map(({ quote, professional }) => {
              const isSelected = view.leadDomain.selectedQuoteId === quote.id;
              return (
                <div
                  key={quote.id}
                  className={cn(
                    "rounded-xl border bg-surface p-5",
                    isSelected ? "border-brand ring-1 ring-brand/20" : "border-line",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-semibold text-ink">{professional.name}</p>
                      <p className="text-[13.5px] sm:text-[12.5px] text-ink-3">{professional.companyName}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-[21px] text-ink">
                        {formatRupees(quote.total)}
                      </div>
                      {quote.total === cheapest ? (
                        <span className="text-[12.5px] sm:text-[11.5px] font-medium text-positive">Lowest</span>
                      ) : null}
                    </div>
                  </div>

                  <dl className="mt-4 space-y-2 border-t border-line pt-3 text-[14px] sm:text-[13px]">
                    <div className="flex justify-between gap-4">
                      <dt className="text-ink-3">Timeline</dt>
                      <dd className="font-medium text-ink">{quote.timelineDays} days</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-ink-3">{view.domain.labels.warranty}</dt>
                      <dd className="font-medium text-ink">{quote.warrantyMonths} months</dd>
                    </div>
                    <div>
                      <dt className="text-ink-3">{view.domain.labels.materials}</dt>
                      <dd className="mt-1 text-[13.5px] sm:text-[12.5px] leading-snug text-ink-2">
                        {quote.materialsSummary}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4">
                    {isSelected ? (
                      <Badge tone="brand">Selected</Badge>
                    ) : view.leadDomain.selectedQuoteId ? null : (
                      <SelectQuoteButton
                        leadDomainId={view.leadDomain.id}
                        quoteId={quote.id}
                        leadId={lead.lead.id}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Line-item breakdown of the cheapest quote */}
          <details className="mt-4 rounded-xl border border-line bg-surface p-5">
            <summary className="cursor-pointer text-[14.5px] sm:text-[13.5px] font-medium text-ink">
              See the line items behind these quotes
            </summary>
            <div className="mt-4 space-y-6">
              {view.quotes.map(({ quote, professional }) => (
                <div key={quote.id}>
                  <p className="text-[14px] sm:text-[13px] font-semibold text-ink">{professional.companyName}</p>
                  <table className="mt-2 w-full text-[14px] sm:text-[13px]">
                    <tbody>
                      {quote.lineItems.map((item) => (
                        <tr key={item.id} className="border-b border-line">
                          <td className="py-2 pr-4 text-ink-2">{item.description}</td>
                          <td className="py-2 pr-4 text-right text-ink-3">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="py-2 pr-4 text-right text-ink-3">
                            {formatRupees(item.rate)}
                          </td>
                          <td className="py-2 text-right font-medium text-ink">
                            {formatRupees(item.amount)}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={3} className="py-2 text-right text-ink-3">
                          Subtotal
                        </td>
                        <td className="py-2 text-right text-ink">{formatRupees(quote.subtotal)}</td>
                      </tr>
                      <tr>
                        <td colSpan={3} className="py-1 text-right text-ink-3">
                          GST {quote.taxPercent}%
                        </td>
                        <td className="py-1 text-right text-ink">
                          {formatRupees(quote.taxAmount)}
                        </td>
                      </tr>
                      <tr className="border-t border-line-strong">
                        <td colSpan={3} className="py-2 text-right font-medium text-ink">
                          Total
                        </td>
                        <td className="py-2 text-right font-semibold text-ink">
                          {formatRupees(quote.total)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </details>
        </div>
      ) : null}

      {/* Messages — always with our team, never with a vendor directly */}
      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[14px] sm:text-[13px] font-semibold uppercase tracking-[0.1em] text-ink-4">
            Messages about {view.domain.name}
          </h3>
          <span className="text-[13px] sm:text-[12px] text-ink-4">
            Separate thread per service, so context never mixes
          </span>
        </div>

        <p className="mt-3 rounded-lg bg-paper p-3.5 text-[13.5px] sm:text-[12.5px] leading-relaxed text-ink-3">
          You talk to us, not to the vendors. Anything you ask here goes to all
          {" "}
          {view.assignments.length || "the assigned"} professionals at once, so their quotes stay
          comparable — and you are not left fielding calls from three different people.
        </p>

        {messages.length > 0 ? (
          <div className="mt-4 space-y-3">
            {messages.map((message) => {
              const fromClient = message.senderRole === "client";
              return (
                <div
                  key={message.id}
                  className={cn("flex", fromClient ? "justify-end" : "justify-start")}
                >
                  <div className={cn("max-w-[80%]", fromClient && "text-right")}>
                    {!fromClient ? (
                      <div className="mb-1 flex items-center gap-1.5 text-[12.5px] sm:text-[11.5px] font-medium text-brand">
                        <span className="grid h-4 w-4 place-items-center rounded-full bg-brand text-[9px] text-white">
                          A
                        </span>
                        Aangan team
                      </div>
                    ) : null}
                    <div
                      className={cn(
                        "rounded-xl px-4 py-3 text-left text-[14.5px] sm:text-[13.5px] leading-relaxed",
                        fromClient
                          ? "rounded-br-sm bg-brand text-white"
                          : "rounded-bl-sm bg-surface-2 text-ink-2",
                      )}
                    >
                      {message.body}
                      {message.attachmentUrl ? (
                        <div
                          className={cn(
                            "mt-2 text-[13px] sm:text-[12px]",
                            fromClient ? "text-white/70" : "text-ink-4",
                          )}
                        >
                          Attachment
                        </div>
                      ) : null}
                      <div
                        className={cn(
                          "mt-1.5 text-[12px] sm:text-[11px]",
                          fromClient ? "text-white/60" : "text-ink-4",
                        )}
                      >
                        {formatDateTime(message.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-[14.5px] sm:text-[13.5px] text-ink-3">
            No messages yet. Ask us anything about this service — scope, materials, timelines, or a
            question you want put to all three professionals.
          </p>
        )}

        <MessageComposer leadDomainId={view.leadDomain.id} leadId={lead.lead.id} />
      </Card>

      {view.selectedProfessional ? (
        <div className="rounded-xl border border-brand-line bg-brand-soft p-5">
          <p className="text-[14px] sm:text-[13px] font-semibold uppercase tracking-[0.1em] text-brand">
            Selected for {view.domain.name}
          </p>
          <p className="mt-2 text-[15px] text-ink">
            {view.selectedProfessional.companyName} — {view.selectedProfessional.name}
          </p>
          <ButtonLink href="/account/agreements" variant="secondary" size="sm" className="mt-4">
            View agreements
          </ButtonLink>
        </div>
      ) : null}
    </div>
  );
}
