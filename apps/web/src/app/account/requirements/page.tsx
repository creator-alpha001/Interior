import Link from "next/link";
import { listLeadsForClient } from "@repo/data";
import { Badge, ButtonLink, EmptyState, formatDate, leadDomainStatus, materialSourceLabel, urgencyLabel } from "@repo/ui";

export default async function RequirementsPage() {
  const leads = await listLeadsForClient();

  if (leads.length === 0) {
    return (
      <EmptyState
        title="No requirements yet"
        description="Tell us what you need — one service or several — and we will assign three verified professionals for each."
        action={<ButtonLink href="/submit-requirement">Get free quotes</ButtonLink>}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15px] sm:text-[14px] text-ink-3">
          {leads.length} requirements ·{" "}
          {leads.reduce((sum, l) => sum + l.domains.length, 0)} service tracks
        </p>
        <ButtonLink href="/submit-requirement" size="sm">
          New requirement
        </ButtonLink>
      </div>

      {leads.map((lead) => (
        <Link
          key={lead.lead.id}
          href={`/account/requirements/${lead.lead.id}`}
          className="block rounded-xl border border-line bg-surface p-6 transition-shadow hover:shadow-[var(--shadow-lift)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[13px] sm:text-[12px] text-ink-4">{lead.lead.reference}</span>
                {lead.isMultiDomain ? (
                  <Badge tone="clay">{lead.domains.length} services</Badge>
                ) : (
                  <Badge tone="neutral">{lead.domains[0]?.domain.name}</Badge>
                )}
                <Badge>{urgencyLabel[lead.lead.urgency]}</Badge>
                <Badge>{lead.city.name}</Badge>
              </div>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{lead.lead.description}</p>
            </div>
            <div className="text-right text-[13.5px] sm:text-[12.5px] text-ink-4">
              <div>Raised {formatDate(lead.lead.createdAt)}</div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-2">
            {lead.domains.map((d) => {
              const status = leadDomainStatus[d.leadDomain.status];
              return (
                <div key={d.leadDomain.id} className="rounded-lg border border-line bg-paper p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[15px] sm:text-[14px] font-semibold text-ink">{d.domain.name}</span>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  <p className="mt-2 text-[13.5px] sm:text-[12.5px] text-ink-3">
                    {materialSourceLabel[d.leadDomain.materialSource]}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3 text-[13.5px] sm:text-[12.5px] text-ink-4">
                    <span>{d.assignments.length} assigned</span>
                    <span>·</span>
                    <span>{d.quotes.length} quotes</span>
                    {d.meetings.length > 0 ? (
                      <>
                        <span>·</span>
                        <span>{d.meetings.length} visits</span>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Link>
      ))}
    </div>
  );
}
