import Link from "next/link";
import {
  formatRupees,
  formatRupeesShort,
  getVendorDashboard,
  getVendorOnboarding,
  listVendorLeads,
  listVendorVisits,
} from "@repo/data";
import { Badge, formatDateTime, urgencyLabel } from "@repo/ui";
import { Metric, PageBody, PageHeader, Panel } from "@/components/panel-ui";
import { CURRENT_PROFESSIONAL_ID } from "@/lib/session";

export const metadata = { title: "Home" };

export default async function VendorHomePage() {
  const [dashboard, leads, visits, onboarding] = await Promise.all([
    getVendorDashboard(CURRENT_PROFESSIONAL_ID),
    listVendorLeads(CURRENT_PROFESSIONAL_ID),
    listVendorVisits(CURRENT_PROFESSIONAL_ID),
    getVendorOnboarding(CURRENT_PROFESSIONAL_ID),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const needsQuote = leads.filter((c) => c.assignment.responseStatus === "accepted" && !c.myQuote);
  const upcomingVisits = visits.filter(
    (v) => v.meeting.scheduledAt.slice(0, 10) >= today && v.meeting.status !== "completed",
  );

  return (
    <>
      <PageHeader
        title={dashboard.professional.companyName}
        subtitle={`${dashboard.displayName} · approved for ${dashboard.domains
          .filter((d) => d.link.verificationStatus === "approved")
          .map((d) => d.domain.name)
          .join(" and ")}`}
      />

      <PageBody className="space-y-5">
        {onboarding && !onboarding.canReceiveLeads ? (
          <Link
            href="/onboarding"
            className="block rounded-lg border border-warning/30 bg-warning-soft p-4 transition-colors hover:border-warning"
          >
            <p className="text-[13px] font-semibold uppercase tracking-wider text-warning">
              You are not receiving leads
            </p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
              {onboarding.blockedReason} Finish setting up →
            </p>
          </Link>
        ) : null}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric
            label="Waiting on a quote"
            value={needsQuote.length}
            hint="Site visited, price not sent"
            tone={needsQuote.length > 0 ? "urgent" : "default"}
            href="/leads?filter=new"
          />
          <Metric label="Quotes out" value={dashboard.quotesOut} hint="Client deciding" href="/leads?filter=quoting" />
          <Metric label="Live jobs" value={dashboard.liveProjects} hint="In progress" href="/projects" />
          <Metric
            label="Commission due"
            value={formatRupeesShort(dashboard.commissionDue + dashboard.commissionOverdue)}
            hint={dashboard.commissionOverdue > 0 ? `${formatRupeesShort(dashboard.commissionOverdue)} overdue` : "Nothing overdue"}
            tone={dashboard.commissionOverdue > 0 ? "urgent" : "default"}
            href="/payments"
          />
        </div>

        {/* Ratings are per trade, so strength in one is not diluted by the other. */}
        <Panel title="Your rating by trade">
          <div className="grid gap-3 sm:grid-cols-2">
            {dashboard.domains.map(({ link, domain }) => (
              <div key={link.id} className="rounded-md border border-line p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13.5px] font-medium text-ink">{domain.name}</span>
                  <Badge
                    tone={
                      link.verificationStatus === "approved"
                        ? "positive"
                        : link.verificationStatus === "pending"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {link.verificationStatus}
                  </Badge>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="tnum font-display text-[22px] leading-none text-ink">
                    {link.avgRating.toFixed(1)}
                  </span>
                  <span className="text-[12px] text-ink-4">
                    from {link.ratingCount} reviews · {link.completedProjects} projects
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${(link.avgRating / 5) * 100}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-ink-4">
                  Commission {link.commissionPercentOverride ?? domain.defaultCommissionPercent}%
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel
            title="Needs a quote"
            action={
              <Link href="/leads?filter=new" className="text-[12px] font-medium text-brand">
                All →
              </Link>
            }
            bodyClassName="p-0"
          >
            {needsQuote.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-ink-3">
                Nothing waiting. Quotes sent quickly win more often.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {needsQuote.slice(0, 5).map((card) => (
                  <li key={card.assignment.id}>
                    <Link
                      href={`/leads/${card.leadDomain.id}`}
                      className="flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13.5px] font-medium text-ink">
                            {card.client.displayName}
                          </span>
                          <Badge tone="neutral">{card.domain.name}</Badge>
                          {card.urgency === "immediate" ? (
                            <Badge tone="danger">Immediate</Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 line-clamp-1 text-[12.5px] text-ink-3">
                          {card.description}
                        </p>
                        <p className="mt-0.5 text-[11.5px] text-ink-4">
                          {card.client.locality}, {card.client.city.name}
                          {card.competingQuotes > 0
                            ? ` · ${card.competingQuotes} other ${
                                card.competingQuotes === 1 ? "quote" : "quotes"
                              } in`
                            : ""}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-brand px-3 py-1 text-[11.5px] font-medium text-white">
                        Quote
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Your next visits" bodyClassName="p-0">
            {upcomingVisits.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-ink-3">
                No visits booked. Our team arranges these and confirms with you first.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {upcomingVisits.slice(0, 5).map(({ meeting, domain, client, leadReference }) => (
                  <li key={meeting.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-medium text-ink">
                          {client.displayName}
                        </span>
                        <Badge tone="neutral">{domain.name}</Badge>
                      </div>
                      <span className="text-[11.5px] text-ink-4">
                        {formatDateTime(meeting.scheduledAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-ink-3">
                      {meeting.type.replace("_", " ")} · {leadReference}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-ink-4">
                      {client.address ?? `${client.locality}, ${client.city.name}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel title="How this works">
          <ul className="space-y-2 text-[12.5px] leading-relaxed text-ink-2">
            {[
              "Leads are qualified before they reach you — our team has spoken to the customer and captured the scope.",
              "You are one of three quoting. Price it properly rather than low; customers see warranty, timeline and materials alongside the number.",
              "All contact runs through our coordinator. You get the locality up front and the full address once a visit is confirmed — never the customer's phone number.",
              "Commission is charged only on work you win, at your rate for that trade, invoiced once per agreement.",
            ].map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand" />
                {line}
              </li>
            ))}
          </ul>
        </Panel>

        {dashboard.commissionDue + dashboard.commissionOverdue > 0 ? (
          <div className="rounded-lg border border-clay-line bg-clay-soft p-4">
            <p className="text-[13px] font-semibold text-clay">
              {formatRupees(dashboard.commissionDue + dashboard.commissionOverdue)} commission
              outstanding
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
              Invoices are raised per agreement, not per job — a customer who hired you for two
              services under one contract is a single invoice.{" "}
              <Link href="/payments" className="font-medium text-brand">
                See payments
              </Link>
            </p>
          </div>
        ) : null}
      </PageBody>
    </>
  );
}
