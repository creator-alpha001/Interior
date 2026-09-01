"use client";

import { useTransition } from "react";
import type { ProjectMilestone } from "@repo/types";
import { formatDate } from "@repo/ui";
import { updateProgressAction } from "@/app/actions";

/**
 * Vendors update progress themselves — the customer watches this on their own
 * screen, which is what removes the "any update?" phone calls that the
 * platform-mediated model would otherwise land on our coordinator.
 */
export function ProgressControl({
  projectId,
  completionPercent,
  milestones,
  editable,
}: {
  projectId: string;
  completionPercent: number;
  milestones: ProjectMilestone[];
  editable: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const doneCount = milestones.filter((m) => m.completedAt).length;

  return (
    <div>
      <div className="flex items-baseline justify-between text-[12.5px]">
        <span className="font-medium text-ink">{completionPercent}% complete</span>
        <span className="text-ink-3">
          {doneCount} of {milestones.length} milestones
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{ width: `${completionPercent}%` }}
        />
      </div>

      <ul className="mt-3 space-y-1.5">
        {milestones.map((milestone) => {
          const done = Boolean(milestone.completedAt);
          const nextIndex = milestones.findIndex((m) => !m.completedAt);
          const isNext = !done && milestones.indexOf(milestone) === nextIndex;

          return (
            <li key={milestone.id} className="flex items-center gap-2.5">
              <span
                className={
                  done
                    ? "grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full bg-brand text-[10px] text-white"
                    : "grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full border border-line-strong bg-surface"
                }
                style={{ height: "1.125rem", width: "1.125rem" }}
              >
                {done ? "✓" : ""}
              </span>
              <span className={done ? "text-[12.5px] text-ink" : "text-[12.5px] text-ink-4"}>
                {milestone.title}
              </span>
              {done ? (
                <span className="ml-auto text-[11px] text-ink-4">
                  {formatDate(milestone.completedAt)}
                </span>
              ) : editable && isNext ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () =>
                      updateProgressAction(
                        projectId,
                        Math.min(
                          100,
                          Math.round(((doneCount + 1) / milestones.length) * 100),
                        ),
                        milestone.id,
                      ),
                    )
                  }
                  className="ml-auto rounded-md bg-brand px-2.5 py-1 text-[11.5px] font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                >
                  {pending ? "…" : "Mark done"}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {editable ? (
        <p className="mt-2.5 text-[11px] leading-relaxed text-ink-4">
          The customer sees this update the moment you make it.
        </p>
      ) : null}
    </div>
  );
}
