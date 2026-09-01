import Link from "next/link";
import { formatRupees, listAgreementsForClient } from "@repo/data";
import { SignAgreementButton } from "@/components/account/sign-agreement-button";
import { Badge, ButtonLink, Card, EmptyState, agreementStatus, formatDate, projectStatus } from "@repo/ui";

export default async function AgreementsPage({
  searchParams,
}: {
  searchParams: Promise<{ generated?: string; signed?: string }>;
}) {
  const sp = await searchParams;
  const agreements = await listAgreementsForClient();

  if (agreements.length === 0) {
    return (
      <EmptyState
        title="No agreements yet"
        description="An agreement is generated once you select a professional for each service in a requirement."
        action={<ButtonLink href="/account/requirements">View requirements</ButtonLink>}
      />
    );
  }

  const combined = agreements.filter((a) => a.isCombined).length;

  return (
    <div className="space-y-6">
      {sp.signed ? (
        <div className="rounded-xl border border-positive/25 bg-positive-soft p-5">
          <h2 className="font-display text-[20px] text-ink">Agreement signed</h2>
          <p className="mt-1.5 text-[14.5px] sm:text-[13.5px] leading-relaxed text-ink-2">
            Work is now scheduled. Each service under this agreement is tracked as its own project,
            with milestones you can follow through to handover.
          </p>
        </div>
      ) : null}

      {sp.generated ? (
        <div className="rounded-xl border border-positive/25 bg-positive-soft p-5">
          <h2 className="font-display text-[20px] text-ink">Agreements generated</h2>
          <p className="mt-1.5 text-[14.5px] sm:text-[13.5px] leading-relaxed text-ink-2">
            One per professional. Review the terms, then sign — work begins once signed.
          </p>
        </div>
      ) : null}

      <div className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-[15px] font-semibold text-ink">How your agreements are grouped</h2>
        <p className="mt-2 text-[14.5px] sm:text-[13.5px] leading-relaxed text-ink-3">
          Agreements are grouped by <strong className="text-ink">professional</strong>, not by
          service. Different professionals for different services means a separate contract with
          each. One professional handling several services for you means a single combined contract
          — one document, one set of terms, one invoice.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="brand">{combined} combined</Badge>
          <Badge tone="neutral">{agreements.length - combined} single-service</Badge>
        </div>
      </div>

      {agreements.map((a) => {
        const status = agreementStatus[a.agreement.status];
        return (
          <Card key={a.agreement.id} padded={false}>
            <div className="flex flex-wrap items-start justify-between gap-4 p-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[13.5px] sm:text-[12.5px] text-ink-4">
                    {a.agreement.reference}
                  </span>
                  <Badge tone={status.tone}>{status.label}</Badge>
                  {a.isCombined ? <Badge tone="brand">Combined agreement</Badge> : null}
                </div>
                <h3 className="mt-2.5 font-display text-[24px] text-ink">
                  {a.professional.companyName}
                </h3>
                <Link
                  href={`/professionals/${a.professional.id}`}
                  className="text-[14.5px] sm:text-[13.5px] text-ink-3 hover:text-brand"
                >
                  {a.professional.name} →
                </Link>
              </div>
              <div className="text-right">
                <div className="font-display text-[30px] leading-none text-ink">
                  {formatRupees(a.agreement.totalValue)}
                </div>
                <div className="mt-1.5 text-[13.5px] sm:text-[12.5px] text-ink-4">
                  {a.agreement.signedAt
                    ? `Signed ${formatDate(a.agreement.signedAt)}`
                    : "Awaiting your signature"}
                </div>
                {a.agreement.status === "draft" || a.agreement.status === "sent" ? (
                  <div className="mt-3 flex justify-end">
                    <SignAgreementButton
                      agreementId={a.agreement.id}
                      reference={a.agreement.reference}
                      professionalName={a.professional.companyName}
                      value={formatRupees(a.agreement.totalValue)}
                      services={a.lines.map((l) => l.domain.name)}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="border-t border-line bg-paper px-6 py-5">
              <h4 className="text-[13px] sm:text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-4">
                Covers {a.lines.length} {a.lines.length === 1 ? "service" : "services"}
              </h4>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {a.lines.map((line) => (
                  <div key={line.link.id} className="rounded-lg border border-line bg-surface p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[15px] sm:text-[14px] font-medium text-ink">{line.domain.name}</span>
                      <span className="text-[15px] sm:text-[14px] font-semibold text-ink">
                        {formatRupees(line.link.value)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[13.5px] sm:text-[12.5px] text-ink-3">
                      {line.quote.timelineDays} days · {line.quote.warrantyMonths} month warranty
                    </p>
                  </div>
                ))}
              </div>

              {a.projects.length > 0 ? (
                <div className="mt-5 border-t border-line pt-4">
                  <h4 className="text-[13px] sm:text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-4">
                    Execution
                  </h4>
                  <p className="mt-1.5 text-[13.5px] sm:text-[12.5px] text-ink-3">
                    Tracked per service even under one agreement — a painting job finishing does not
                    mean the furniture job has.
                  </p>
                  <div className="mt-3 space-y-3">
                    {a.projects.map(({ project, domain }) => {
                      const ps = projectStatus[project.status];
                      return (
                        <div key={project.id}>
                          <div className="flex items-baseline justify-between text-[14px] sm:text-[13px]">
                            <span className="font-medium text-ink">{domain.name}</span>
                            <span className="text-ink-3">
                              {project.completionPercent}% · {ps.label}
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                            <div
                              className="h-full rounded-full bg-brand"
                              style={{ width: `${project.completionPercent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 border-t border-line pt-4">
                <h4 className="text-[13px] sm:text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-4">
                  Payment terms
                </h4>
                <p className="mt-1.5 text-[14px] sm:text-[13px] leading-relaxed text-ink-2">
                  {a.agreement.paymentTerms}
                </p>
                <p className="mt-2 text-[13px] sm:text-[12px] leading-relaxed text-ink-4">
                  Payments are made directly to the professional. Aangan records the terms and
                  tracks the work, but does not hold your money.
                </p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
