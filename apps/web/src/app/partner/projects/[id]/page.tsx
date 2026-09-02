import Link from "next/link";
import { notFound } from "next/navigation";
import { formatRupees, listVendorProjects } from "@repo/data";
import { Badge, formatDate, projectStatus } from "@repo/ui";
import { StageProofForm } from "@/components/partner/stage-proof-form";
import { PageBody, PageHeader, Panel } from "@/components/partner/panel-ui";
import { CURRENT_PROFESSIONAL_ID } from "@/lib/partner-session";

type Params = { id: string };

export default async function VendorProjectPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const projects = await listVendorProjects(CURRENT_PROFESSIONAL_ID);
  const view = projects.find((p) => p.project.id === id);
  if (!view) notFound();

  const { project, domain, client, cityName, review } = view;
  const status = projectStatus[project.status];

  const approved = project.milestones.filter((m) => m.verification === "approved").length;
  const awaiting = project.milestones.filter((m) => m.verification === "submitted").length;
  const nextIndex = project.milestones.findIndex(
    (m) => m.verification === "not_started" || m.verification === "rejected",
  );

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Work", href: "/projects" }, { label: project.reference }]}
        title={`${domain.name} — ${client.displayName}`}
        subtitle={`${project.reference} · ${client.locality}, ${cityName}`}
        actions={<Badge tone={status.tone}>{status.label}</Badge>}
      />

      <PageBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-line bg-surface p-4">
            <p className="text-[12px] uppercase tracking-wider text-ink-4">Value</p>
            <p className="tnum mt-1 font-display text-[24px] leading-none text-ink">
              {formatRupees(project.value)}
            </p>
            <p className="mt-1.5 text-[12px] text-ink-4">
              less {formatRupees(project.commissionAmount)} commission ({project.commissionPercent}
              %)
            </p>
          </div>
          <div className="rounded-lg border border-line bg-surface p-4">
            <p className="text-[12px] uppercase tracking-wider text-ink-4">Progress</p>
            <p className="tnum mt-1 font-display text-[24px] leading-none text-ink">
              {project.completionPercent}%
            </p>
            <p className="mt-1.5 text-[12px] text-ink-4">
              {approved} of {project.milestones.length} stages approved
            </p>
          </div>
          <div className="rounded-lg border border-line bg-surface p-4">
            <p className="text-[12px] uppercase tracking-wider text-ink-4">Dates</p>
            <p className="mt-1 text-[14px] font-medium text-ink">{formatDate(project.startDate)}</p>
            <p className="mt-1.5 text-[12px] text-ink-4">
              due {formatDate(project.actualEndDate ?? project.estimatedEndDate)}
            </p>
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${project.completionPercent}%` }}
          />
        </div>

        {awaiting > 0 ? (
          <p className="rounded-lg border border-brand-line bg-brand-soft px-4 py-2.5 text-[13.5px] leading-relaxed text-ink-2">
            {awaiting} stage{awaiting === 1 ? "" : "s"} submitted and awaiting review by our team.
            The customer sees a stage as complete once we have approved it.
          </p>
        ) : null}

        <Panel title="Site">
          <p className="text-[14px] text-ink">
            {client.address ?? `${client.locality}, ${cityName}`}
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-4">
            Anything you need from the customer goes through our coordinator — we never share their
            phone number.
          </p>
        </Panel>

        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[16px] font-semibold text-ink">Stages</h2>
            <p className="text-[12.5px] text-ink-4">
              Upload proof as you finish each one — this is what the customer sees.
            </p>
          </div>
          <div className="space-y-2">
            {project.milestones.map((milestone, i) => (
              <StageProofForm
                key={milestone.id}
                projectId={project.id}
                milestone={milestone}
                isNext={i === nextIndex}
              />
            ))}
          </div>
        </div>

        {review ? (
          <Panel title="Customer review">
            <div className="flex items-center gap-2">
              <span className="text-[16px] font-semibold text-ink">{review.rating}★</span>
              <Badge tone="neutral">{domain.name} only</Badge>
            </div>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{review.comment}</p>
          </Panel>
        ) : null}

        <p className="text-center text-[13px] text-ink-4">
          <Link href="/partner/projects" className="text-brand">
            ← All work
          </Link>
        </p>
      </PageBody>
    </>
  );
}
