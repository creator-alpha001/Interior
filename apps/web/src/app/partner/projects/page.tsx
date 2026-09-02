import { formatRupees, listVendorAgreements, listVendorProjects } from "@repo/data";
import { Badge, agreementStatus, formatDate, projectStatus } from "@repo/ui";
import Link from "next/link";
import { PageBody, PageHeader, Panel } from "@/components/partner/panel-ui";
import { CURRENT_PROFESSIONAL_ID } from "@/lib/partner-session";

export const metadata = { title: "Work" };

export default async function VendorProjectsPage() {
  const [projects, agreements] = await Promise.all([
    listVendorProjects(CURRENT_PROFESSIONAL_ID),
    listVendorAgreements(CURRENT_PROFESSIONAL_ID),
  ]);

  const ongoing = projects.filter((p) => p.project.status === "ongoing");
  const done = projects.filter((p) => p.project.status === "completed");

  return (
    <>
      <PageHeader
        title="Your work"
        subtitle={`${ongoing.length} in progress · ${done.length} completed`}
      />

      <PageBody className="space-y-5">
        {/* Agreements first: they explain why some jobs share a contract. */}
        <Panel title={`Agreements (${agreements.length})`} bodyClassName="p-0">
          {agreements.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-ink-3">
              No agreements yet. One is created when a customer picks you.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {agreements.map((row) => {
                const status = agreementStatus[row.agreement.status];
                return (
                  <li key={row.agreement.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11.5px] text-ink-4">
                            {row.agreement.reference}
                          </span>
                          <span className="text-[13.5px] font-medium text-ink">
                            {row.client.displayName}
                          </span>
                          <Badge tone={status.tone}>{status.label}</Badge>
                          {row.isCombined ? <Badge tone="brand">Combined</Badge> : null}
                        </div>
                        <p className="mt-1 text-[12px] text-ink-3">
                          {row.lines.map((l) => l.domain.name).join(" + ")} ·{" "}
                          {row.client.locality}, {row.client.city.name}
                        </p>
                        {row.isCombined ? (
                          <p className="mt-1 text-[11.5px] text-ink-4">
                            One contract covering {row.lines.length} services for this customer —
                            billed as a single commission invoice, not one per service.
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <div className="tnum text-[14px] font-semibold text-ink">
                          {formatRupees(row.agreement.totalValue)}
                        </div>
                        {row.invoice ? (
                          <div className="text-[11.5px] text-ink-4">
                            commission {formatRupees(row.invoice.amount)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {projects.length === 0 ? (
          <Panel>
            <p className="py-8 text-center text-[13px] text-ink-3">
              No projects yet. Work starts once a customer signs an agreement.
            </p>
          </Panel>
        ) : (
          <div className="space-y-3">
            {projects.map(({ project, domain, client, cityName, review }) => {
              const status = projectStatus[project.status];
              return (
                <div key={project.id} className="rounded-lg border border-line bg-surface">
                  <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11.5px] text-ink-4">
                          {project.reference}
                        </span>
                        <Badge tone="neutral">{domain.name}</Badge>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </div>
                      <h3 className="mt-1.5 text-[14.5px] font-semibold text-ink">
                        {client.displayName}
                      </h3>
                      <p className="text-[12px] text-ink-3">
                        {client.address ?? `${client.locality}, ${cityName}`}
                      </p>
                      <p className="mt-1 text-[11.5px] text-ink-4">
                        {formatDate(project.startDate)} →{" "}
                        {formatDate(project.actualEndDate ?? project.estimatedEndDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="tnum text-[15px] font-semibold text-ink">
                        {formatRupees(project.value)}
                      </div>
                      <div className="text-[11.5px] text-ink-4">
                        commission {formatRupees(project.commissionAmount)} (
                        {project.commissionPercent}%)
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-line bg-paper px-4 py-3">
                    <div className="flex items-baseline justify-between text-[12.5px]">
                      <span className="font-medium text-ink">
                        {project.completionPercent}% complete
                      </span>
                      <span className="text-ink-3">
                        {project.milestones.filter((m) => m.verification === "approved").length} of{" "}
                        {project.milestones.length} stages approved
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-brand transition-all"
                        style={{ width: `${project.completionPercent}%` }}
                      />
                    </div>

                    {(() => {
                      const next = project.milestones.find(
                        (m) => m.verification === "not_started" || m.verification === "rejected",
                      );
                      const awaiting = project.milestones.filter(
                        (m) => m.verification === "submitted",
                      ).length;
                      return (
                        <p className="mt-2 text-[12.5px] text-ink-3">
                          {awaiting > 0
                            ? `${awaiting} stage${awaiting === 1 ? "" : "s"} awaiting our review`
                            : next
                              ? `Next stage: ${next.title}`
                              : "All stages approved"}
                        </p>
                      );
                    })()}

                    <Link
                      href={`/partner/projects/${project.id}`}
                      className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-full bg-brand text-[13.5px] font-medium text-white hover:bg-brand-hover"
                    >
                      Open project · upload stage proof
                    </Link>

                    {review ? (
                      <div className="mt-3 rounded-md border border-line bg-surface p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-ink">
                            {review.rating}★
                          </span>
                          <span className="text-[11.5px] text-ink-4">
                            Rated for {domain.name.toLowerCase()} only
                          </span>
                        </div>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
                          {review.comment}
                        </p>
                      </div>
                    ) : project.status === "completed" ? (
                      <p className="mt-3 text-[12px] text-ink-4">
                        Awaiting the customer&apos;s rating for this service.
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PageBody>
    </>
  );
}
