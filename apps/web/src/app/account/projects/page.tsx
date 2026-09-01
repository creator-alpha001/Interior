import Link from "next/link";
import { formatRupees, listProjectsForClient } from "@repo/data";
import { Media } from "@repo/ui";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  Stars,
} from "@repo/ui";
import { ReviewForm } from "@/components/account/review-form";
import { formatDate, projectStatus } from "@repo/ui";

export default async function ProjectsPage() {
  const projects = await listProjectsForClient();

  if (projects.length === 0) {
    return (
      <EmptyState
        title="No projects yet"
        description="A project starts once an agreement is signed. Each service runs as its own project, with its own timeline."
        action={<ButtonLink href="/account/requirements">View requirements</ButtonLink>}
      />
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-[15px] sm:text-[14px] text-ink-3">
        {projects.filter((p) => p.project.status === "ongoing").length} in progress ·{" "}
        {projects.filter((p) => p.project.status === "completed").length} completed
      </p>

      {projects.map(({ project, domain, professional, review }) => {
        const status = projectStatus[project.status];
        return (
          <Card key={project.id} padded={false}>
            <div className="flex flex-wrap items-start justify-between gap-4 p-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[13.5px] sm:text-[12.5px] text-ink-4">{project.reference}</span>
                  <Badge tone="neutral">{domain.name}</Badge>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
                <h3 className="mt-2.5 font-display text-[22px] text-ink">
                  {professional.companyName}
                </h3>
                <Link
                  href={`/professionals/${professional.id}`}
                  className="text-[14px] sm:text-[13px] text-ink-3 hover:text-brand"
                >
                  {professional.name} →
                </Link>
              </div>
              <div className="text-right">
                <div className="font-display text-[26px] leading-none text-ink">
                  {formatRupees(project.value)}
                </div>
                <div className="mt-1.5 text-[13.5px] sm:text-[12.5px] text-ink-4">
                  {formatDate(project.startDate)} →{" "}
                  {formatDate(project.actualEndDate ?? project.estimatedEndDate)}
                </div>
              </div>
            </div>

            <div className="border-t border-line bg-paper px-6 py-5">
              <div className="flex items-baseline justify-between text-[14px] sm:text-[13px]">
                <span className="font-medium text-ink">{project.completionPercent}% complete</span>
                <span className="text-ink-3">
                  {project.milestones.filter((m) => m.completedAt).length} of{" "}
                  {project.milestones.length} milestones
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-brand transition-all"
                  style={{ width: `${project.completionPercent}%` }}
                />
              </div>

              {/* Stages with the photographs the professional submitted, so
                  progress is something you can see rather than take on trust. */}
              <ol className="mt-5 space-y-3">
                {project.milestones.map((milestone) => {
                  const done = milestone.verification === "approved";
                  return (
                    <li key={milestone.id}>
                      <div className="flex items-center gap-3">
                        <span
                          className={
                            done
                              ? "grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand text-[12px] text-white sm:text-[11px]"
                              : "grid h-5 w-5 shrink-0 place-items-center rounded-full border border-line-strong bg-surface text-[12px] text-ink-4 sm:text-[11px]"
                          }
                        >
                          {done ? "✓" : ""}
                        </span>
                        <span
                          className={
                            done
                              ? "text-[14.5px] text-ink sm:text-[13.5px]"
                              : "text-[14.5px] text-ink-4 sm:text-[13.5px]"
                          }
                        >
                          {milestone.title}
                        </span>
                        {done && milestone.completedAt ? (
                          <span className="ml-auto text-[13px] text-ink-4 sm:text-[12px]">
                            {formatDate(milestone.completedAt)}
                          </span>
                        ) : milestone.verification === "submitted" ? (
                          <span className="ml-auto text-[12.5px] text-ink-4 sm:text-[11.5px]">
                            being checked
                          </span>
                        ) : null}
                      </div>

                      {milestone.proofNote && done ? (
                        <p className="mt-1.5 pl-8 text-[13.5px] leading-relaxed text-ink-3 sm:text-[12.5px]">
                          {milestone.proofNote}
                        </p>
                      ) : null}

                      {done && milestone.proof.length > 0 ? (
                        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pl-8">
                          {milestone.proof.map((asset) => (
                            <div
                              key={asset.id}
                              className="h-24 w-32 shrink-0 overflow-hidden rounded-lg"
                            >
                              <Media
                                src={asset.url}
                                alt={`${milestone.title} — progress photo`}
                                rounded={false}
                              />
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>

              {review ? (
                <div className="mt-5 rounded-lg border border-line bg-surface p-4">
                  <div className="flex items-center gap-2">
                    <Stars value={review.rating} />
                    <span className="text-[14px] sm:text-[13px] font-medium text-ink">Your review</span>
                  </div>
                  <p className="mt-2 text-[14.5px] sm:text-[13.5px] leading-relaxed text-ink-2">{review.comment}</p>
                </div>
              ) : project.status === "completed" ? (
                <ReviewForm
                  projectId={project.id}
                  professionalName={professional.name}
                  domainName={domain.name}
                />
              ) : null}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
