import Link from "next/link";
import {
  formatRupees,
  listAgreementsForClient,
  listLeadsForClient,
  listProjectsForClient,
} from "@repo/data";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  RatingLine,
} from "@repo/ui";
import {
  agreementStatus,
  formatDate,
  leadDomainStatus,
  projectStatus,
  urgencyLabel,
} from "@repo/ui";

export default async function AccountOverviewPage() {
  const [leads, agreements, projects] = await Promise.all([
    listLeadsForClient(),
    listAgreementsForClient(),
    listProjectsForClient(),
  ]);

  const activeLeads = leads.filter(
    (l) => l.lead.overallStatus !== "closed" && l.lead.overallStatus !== "archived",
  );
  const quotesWaiting = leads.flatMap((l) =>
    l.domains.filter((d) => d.leadDomain.status === "quoted"),
  );
  const ongoing = projects.filter((p) => p.project.status === "ongoing");

  return (
    <div className="space-y-8">
      {/* Attention band */}
      {quotesWaiting.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-clay-line bg-clay-soft">
          <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[12px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-clay">
                Needs your decision
              </p>
              <h2 className="mt-1.5 font-display text-[24px] text-ink">
                {quotesWaiting.length} {quotesWaiting.length === 1 ? "service has" : "services have"}{" "}
                quotes ready to compare
              </h2>
              <p className="mt-1.5 text-[14.5px] sm:text-[13.5px] text-ink-2">
                {quotesWaiting.map((d) => d.domain.name).join(" · ")} — three quotes each, side by
                side.
              </p>
            </div>
            <ButtonLink href={`/account/requirements/${leads[0]?.lead.id}`} variant="clay">
              Compare quotes
            </ButtonLink>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <p className="text-[13px] sm:text-[12px] uppercase tracking-wider text-ink-4">Active requirements</p>
          <p className="mt-2 font-display text-[34px] leading-none text-ink">
            {activeLeads.length}
          </p>
          <p className="mt-2 text-[14px] sm:text-[13px] text-ink-3">
            {leads.reduce((sum, l) => sum + l.domains.length, 0)} service tracks in total
          </p>
        </Card>
        <Card>
          <p className="text-[13px] sm:text-[12px] uppercase tracking-wider text-ink-4">Agreements</p>
          <p className="mt-2 font-display text-[34px] leading-none text-ink">{agreements.length}</p>
          <p className="mt-2 text-[14px] sm:text-[13px] text-ink-3">
            {agreements.filter((a) => a.isCombined).length} combined ·{" "}
            {agreements.filter((a) => !a.isCombined).length} single-service
          </p>
        </Card>
        <Card>
          <p className="text-[13px] sm:text-[12px] uppercase tracking-wider text-ink-4">Projects running</p>
          <p className="mt-2 font-display text-[34px] leading-none text-ink">{ongoing.length}</p>
          <p className="mt-2 text-[14px] sm:text-[13px] text-ink-3">
            {projects.filter((p) => p.project.status === "completed").length} completed to date
          </p>
        </Card>
      </div>

      {/* Requirements */}
      <div>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-[22px]">Your requirements</h2>
          <Link href="/account/requirements" className="text-[14.5px] sm:text-[13.5px] font-medium text-brand">
            View all →
          </Link>
        </div>

        {leads.length === 0 ? (
          <EmptyState
            title="No requirements yet"
            description="Tell us what you need and we will put three verified professionals in front of you."
            action={<ButtonLink href="/submit-requirement">Get free quotes</ButtonLink>}
          />
        ) : (
          <div className="space-y-4">
            {leads.slice(0, 3).map((lead) => (
              <Link
                key={lead.lead.id}
                href={`/account/requirements/${lead.lead.id}`}
                className="block rounded-xl border border-line bg-surface p-5 transition-shadow hover:shadow-[var(--shadow-lift)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[13px] sm:text-[12px] text-ink-4">
                        {lead.lead.reference}
                      </span>
                      {lead.isMultiDomain ? (
                        <Badge tone="clay">{lead.domains.length} services</Badge>
                      ) : null}
                      <Badge>{urgencyLabel[lead.lead.urgency]}</Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 text-[15.5px] sm:text-[14.5px] leading-relaxed text-ink-2">
                      {lead.lead.description}
                    </p>
                  </div>
                  <span className="text-[13.5px] sm:text-[12.5px] text-ink-4">
                    {formatDate(lead.lead.createdAt)}
                  </span>
                </div>

                <div className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-2">
                  {lead.domains.map((d) => {
                    const status = leadDomainStatus[d.leadDomain.status];
                    return (
                      <div
                        key={d.leadDomain.id}
                        className="flex items-center justify-between gap-3 rounded-lg bg-paper px-3 py-2.5"
                      >
                        <span className="text-[14.5px] sm:text-[13.5px] font-medium text-ink">{d.domain.name}</span>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </div>
                    );
                  })}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Projects */}
      {projects.length > 0 ? (
        <div>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-[22px]">Work in progress</h2>
            <Link href="/account/projects" className="text-[14.5px] sm:text-[13.5px] font-medium text-brand">
              View all →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {projects.slice(0, 4).map(({ project, domain, professional, review }) => {
              const status = projectStatus[project.status];
              return (
                <Card key={project.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Badge tone="neutral">{domain.name}</Badge>
                      <h3 className="mt-2 font-sans text-[15px] font-semibold text-ink">
                        {professional.companyName}
                      </h3>
                    </div>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-baseline justify-between text-[13.5px] sm:text-[12.5px]">
                      <span className="text-ink-3">{project.completionPercent}% complete</span>
                      <span className="text-ink-4">
                        {formatRupees(project.value)}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-brand transition-all"
                        style={{ width: `${project.completionPercent}%` }}
                      />
                    </div>
                  </div>

                  {review ? (
                    <div className="mt-4 border-t border-line pt-3">
                      <RatingLine value={review.rating} />
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Agreements */}
      {agreements.length > 0 ? (
        <div>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-[22px]">Agreements</h2>
            <Link href="/account/agreements" className="text-[14.5px] sm:text-[13.5px] font-medium text-brand">
              View all →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {agreements.slice(0, 2).map((a) => {
              const status = agreementStatus[a.agreement.status];
              return (
                <Link
                  key={a.agreement.id}
                  href="/account/agreements"
                  className="rounded-xl border border-line bg-surface p-5 transition-shadow hover:shadow-[var(--shadow-lift)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="font-mono text-[13px] sm:text-[12px] text-ink-4">
                        {a.agreement.reference}
                      </span>
                      <h3 className="mt-1.5 font-sans text-[15px] font-semibold text-ink">
                        {a.professional.companyName}
                      </h3>
                    </div>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {a.lines.map((l) => (
                      <Badge key={l.link.id} tone="neutral">
                        {l.domain.name}
                      </Badge>
                    ))}
                    {a.isCombined ? <Badge tone="brand">Combined</Badge> : null}
                  </div>
                  <p className="mt-3 font-display text-[22px] text-ink">
                    {formatRupees(a.agreement.totalValue)}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
