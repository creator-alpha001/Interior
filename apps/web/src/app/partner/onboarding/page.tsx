import Link from "next/link";
import { notFound } from "next/navigation";
import { getVendorDashboard, getVendorOnboarding } from "@repo/data";
import { Badge, cn } from "@repo/ui";
import { PartnerAgreementSigner } from "@/components/partner/partner-agreement-signer";
import { PageBody, PageHeader, Panel } from "@/components/partner/panel-ui";
import { CURRENT_PROFESSIONAL_ID } from "@/lib/partner-session";

export const metadata = { title: "Getting set up" };

export default async function OnboardingPage() {
  const [onboarding, dashboard] = await Promise.all([
    getVendorOnboarding(CURRENT_PROFESSIONAL_ID),
    getVendorDashboard(CURRENT_PROFESSIONAL_ID),
  ]);
  if (!onboarding) notFound();

  const percent = Math.round((onboarding.completedCount / onboarding.totalCount) * 100);

  return (
    <>
      <PageHeader
        title="Getting set up"
        subtitle={`${onboarding.completedCount} of ${onboarding.totalCount} steps done`}
        actions={
          onboarding.canReceiveLeads ? (
            <Badge tone="positive">Receiving leads</Badge>
          ) : (
            <Badge tone="warning">Not yet receiving leads</Badge>
          )
        }
      />

      <PageBody className="space-y-5">
        <div className="rounded-lg border border-line bg-surface p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[14px] font-medium text-ink">Setup progress</span>
            <span className="tnum text-[13px] text-ink-3">{percent}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                onboarding.canReceiveLeads ? "bg-positive" : "bg-brand",
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
          {onboarding.blockedReason ? (
            <p className="mt-2.5 text-[13px] leading-relaxed text-warning">
              {onboarding.blockedReason}
            </p>
          ) : (
            <p className="mt-2.5 text-[13px] text-ink-3">
              Everything required is complete — you are in the pool for{" "}
              {dashboard.domains
                .filter((d) => d.link.verificationStatus === "approved")
                .map((d) => d.domain.name)
                .join(" and ")}
              .
            </p>
          )}
        </div>

        {/* The agreement is the step that gates everything, so it leads. */}
        <PartnerAgreementSigner
          terms={onboarding.terms}
          agreement={onboarding.agreement}
          defaultName={dashboard.displayName}
        />

        <Panel title="Your steps" bodyClassName="p-0">
          <ul className="divide-y divide-line">
            {onboarding.steps.map((step) => (
              <li key={step.key} className="flex items-start gap-3 px-4 py-3">
                <span
                  className={cn(
                    "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px]",
                    step.done
                      ? "bg-positive text-white"
                      : step.blocking
                        ? "border border-warning bg-warning-soft text-warning"
                        : "border border-line-strong bg-surface text-ink-4",
                  )}
                >
                  {step.done ? "✓" : ""}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "text-[14px] font-medium",
                        step.done ? "text-ink" : "text-ink-2",
                      )}
                    >
                      {step.label}
                    </span>
                    {step.blocking && !step.done ? (
                      <Badge tone="warning">Required</Badge>
                    ) : !step.blocking && !step.done ? (
                      <Badge tone="neutral">Optional</Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-ink-3">
                    {step.description}
                  </p>
                  {step.hint ? (
                    <p className="mt-1 text-[12.5px] text-clay">{step.hint}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <p className="text-center text-[13px] text-ink-4">
          <Link href="/partner" className="text-brand">
            ← Back to home
          </Link>
        </p>
      </PageBody>
    </>
  );
}
