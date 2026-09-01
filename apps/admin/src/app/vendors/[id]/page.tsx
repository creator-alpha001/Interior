import { notFound } from "next/navigation";
import {
  formatRupees,
  getProfessional,
  getVendor,
  getVendorOnboarding,
  listCommissionInvoices,
  listDomains,
} from "@repo/data";
import { Badge, formatDate, invoiceStatus } from "@repo/ui";
import { PageBody, PageHeader, Panel } from "@/components/ops-ui";
import { VendorDomainRow, VendorStatusControl } from "@/components/vendor-controls";

type Params = { id: string };

export default async function VendorDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const [row, profile, domains, invoices, onboarding] = await Promise.all([
    getVendor(id),
    getProfessional(id),
    listDomains(),
    listCommissionInvoices(),
    getVendorOnboarding(id),
  ]);
  if (!row || !profile) notFound();

  const theirInvoices = invoices.filter((i) => i.invoice.professionalId === id);
  const unlinkedDomains = domains.filter(
    (d) => !row.domainLinks.some((l) => l.domain.id === d.id),
  );

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Vendors", href: "/vendors" }, { label: row.professional.companyName }]}
        title={row.professional.companyName}
        subtitle={`${row.summary.name} · ${row.serviceCities.join(", ")} · on platform since ${new Date(
          row.professional.createdAt,
        ).getFullYear()}`}
        actions={
          <VendorStatusControl
            professionalId={row.professional.id}
            status={row.professional.verificationStatus}
          />
        }
      />

      <PageBody className="space-y-5">
        {onboarding ? (
          <div
            className={
              onboarding.canReceiveLeads
                ? "rounded-lg border border-positive/25 bg-positive-soft p-4"
                : "rounded-lg border border-warning/30 bg-warning-soft p-4"
            }
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p
                  className={
                    onboarding.canReceiveLeads
                      ? "text-[12px] font-semibold uppercase tracking-wider text-positive"
                      : "text-[12px] font-semibold uppercase tracking-wider text-warning"
                  }
                >
                  {onboarding.canReceiveLeads ? "In the lead pool" : "Not receiving leads"}
                </p>
                {onboarding.agreement?.status === "signed" ? (
                  <>
                    <p className="mt-1.5 text-[14px] text-ink">
                      Partner agreement v{onboarding.agreement.termsVersion} signed by{" "}
                      {onboarding.agreement.signatoryName}
                      {onboarding.agreement.signatoryRole
                        ? `, ${onboarding.agreement.signatoryRole}`
                        : ""}
                    </p>
                    <p className="mt-0.5 text-[12px] text-ink-3">
                      {formatDate(onboarding.agreement.signedAt)} ·{" "}
                      {onboarding.agreement.acknowledgedClauses.length} clauses acknowledged · IP{" "}
                      {onboarding.agreement.signedFromIp ?? "—"}
                    </p>
                    <p className="mt-1.5 font-display text-[19px] italic leading-none text-ink">
                      {onboarding.agreement.signatureText}
                    </p>
                  </>
                ) : (
                  <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
                    {onboarding.blockedReason} They are excluded from every vendor pool until this
                    is resolved.
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="tnum text-[13px] text-ink-3">
                  {onboarding.completedCount}/{onboarding.totalCount} onboarding steps
                </p>
                {onboarding.agreement?.documentUrl ? (
                  <a
                    href={onboarding.agreement.documentUrl}
                    className="mt-1 inline-block text-[12.5px] font-medium text-brand"
                  >
                    Signed copy →
                  </a>
                ) : null}
              </div>
            </div>

            <ul className="mt-3 flex flex-wrap gap-1.5 border-t border-line/60 pt-2.5">
              {onboarding.steps.map((step) => (
                <li key={step.key}>
                  <Badge tone={step.done ? "positive" : step.blocking ? "warning" : "neutral"}>
                    {step.done ? "✓ " : ""}
                    {step.label}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Panel title="Trades and commission">
            <div className="space-y-2">
              {row.domainLinks.map(({ link, domain }) => (
                <VendorDomainRow
                  key={link.id}
                  professionalId={row.professional.id}
                  link={link}
                  domain={domain}
                />
              ))}
            </div>

            {unlinkedDomains.length > 0 ? (
              <div className="mt-4 border-t border-line pt-3">
                <p className="mb-2 text-[11.5px] uppercase tracking-wider text-ink-4">
                  Not registered for
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {unlinkedDomains.map((domain) => (
                    <Badge key={domain.id} tone="neutral">
                      {domain.name}
                    </Badge>
                  ))}
                </div>
                <p className="mt-2 text-[11.5px] leading-relaxed text-ink-4">
                  A vendor can be added to another trade from their own panel as a request, which
                  lands here for approval — never self-service.
                </p>
              </div>
            ) : null}
          </Panel>

          <div className="space-y-4">
            <Panel title="Business details">
              <dl className="space-y-2">
                {[
                  ["Contact", row.summary.name],
                  ["Mobile", profile.user.mobile],
                  ["GST", row.professional.gstNumber ?? "Not registered"],
                  ["Experience", `${row.professional.experienceYears} years`],
                  ["Languages", row.professional.languages.join(", ")],
                  ["Response time", `~${row.professional.avgResponseHours}h`],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 border-b border-line pb-2">
                    <dt className="text-[12.5px] text-ink-4">{label}</dt>
                    <dd className="text-right text-[12.5px] font-medium text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>

            <Panel title="Performance">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Live jobs", String(row.liveJobs)],
                  ["Completed", String(row.professional.completedProjects)],
                  ["Revenue", formatRupees(row.totalRevenue)],
                  ["Commission due", formatRupees(row.outstandingCommission)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md bg-paper p-3">
                    <div className="text-[11px] uppercase tracking-wider text-ink-4">{label}</div>
                    <div className="tnum mt-1 text-[15px] font-semibold text-ink">{value}</div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>

        <Panel title={`Commission invoices (${theirInvoices.length})`} bodyClassName="p-0">
          {theirInvoices.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-ink-3">
              No invoices yet. One is raised per agreement once it is signed.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {theirInvoices.map(({ invoice, agreementReference, domains: covered, isCombined }) => {
                const status = invoiceStatus[invoice.status];
                return (
                  <li
                    key={invoice.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[12px] text-ink-4">
                          {invoice.reference}
                        </span>
                        <span className="text-[12.5px] text-ink-2">{agreementReference}</span>
                        {isCombined ? <Badge tone="brand">Combined</Badge> : null}
                      </div>
                      <p className="mt-0.5 text-[11.5px] text-ink-4">
                        {covered.join(" + ")} · due {formatDate(invoice.dueDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tnum text-[13.5px] font-medium text-ink">
                        {formatRupees(invoice.amount)}
                      </span>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title={`Reviews (${profile.reviews.length})`} bodyClassName="p-0">
          {profile.reviews.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-ink-3">No reviews yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {profile.reviews.map(({ review, clientName, domain }) => (
                <li key={review.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-ink">{review.rating}★</span>
                      <span className="text-[12.5px] text-ink-2">{clientName}</span>
                      <Badge tone="neutral">{domain.name}</Badge>
                    </div>
                    <span className="text-[11.5px] text-ink-4">{formatDate(review.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">{review.comment}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </PageBody>
    </>
  );
}
