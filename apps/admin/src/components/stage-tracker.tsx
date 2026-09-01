"use client";

import { useState, useTransition } from "react";
import type { ProjectMilestone } from "@repo/types";
import { Media, cn, formatDate, formatDateTime } from "@repo/ui";
import { reviewStageAction } from "@/app/actions";

/**
 * Where a job actually is, with the evidence attached.
 *
 * This exists so a coordinator can answer "how far along is my kitchen?" from
 * the lead, without ringing the vendor — and so that when a stage is marked
 * done there is a photograph behind it rather than somebody's word.
 */
export function StageTracker({
  projectId,
  leadId,
  milestones,
  completionPercent,
  reference,
}: {
  projectId: string;
  leadId: string;
  milestones: ProjectMilestone[];
  completionPercent: number;
  reference: string;
}) {
  const approved = milestones.filter((m) => m.verification === "approved").length;
  const awaiting = milestones.filter((m) => m.verification === "submitted");

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-mono text-[12px] text-ink-4">{reference}</span>
        <span className="tnum text-[13px] text-ink-3">
          {approved} of {milestones.length} stages approved · {completionPercent}%
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{ width: `${completionPercent}%` }}
        />
      </div>

      {awaiting.length > 0 ? (
        <p className="mt-2 rounded-md border border-brand-line bg-brand-soft px-3 py-2 text-[12.5px] text-ink-2">
          {awaiting.length} stage{awaiting.length === 1 ? "" : "s"} submitted and waiting on you.
          The customer will not see it as complete until it is approved.
        </p>
      ) : null}

      <ul className="mt-3 space-y-2">
        {milestones.map((milestone) => (
          <StageRow
            key={milestone.id}
            projectId={projectId}
            leadId={leadId}
            milestone={milestone}
          />
        ))}
      </ul>
    </div>
  );
}

function StageRow({
  projectId,
  leadId,
  milestone,
}: {
  projectId: string;
  leadId: string;
  milestone: ProjectMilestone;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const state = milestone.verification;

  return (
    <li
      className={cn(
        "rounded-md border p-3",
        state === "submitted"
          ? "border-brand-line bg-brand-soft"
          : state === "rejected"
            ? "border-danger/30 bg-danger-soft"
            : "border-line bg-surface",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full text-[10px]",
                state === "approved"
                  ? "bg-brand text-white"
                  : state === "rejected"
                    ? "bg-danger text-white"
                    : "border border-line-strong bg-surface text-ink-4",
              )}
              style={{ height: "1.125rem", width: "1.125rem" }}
            >
              {state === "approved" ? "✓" : state === "rejected" ? "!" : ""}
            </span>
            <span className="text-[13.5px] font-medium text-ink">{milestone.title}</span>
          </div>
          {milestone.description ? (
            <p className="mt-0.5 pl-6 text-[12px] text-ink-4">{milestone.description}</p>
          ) : null}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
            state === "approved"
              ? "bg-positive-soft text-positive"
              : state === "submitted"
                ? "bg-brand text-white"
                : state === "rejected"
                  ? "bg-danger text-white"
                  : "bg-surface-2 text-ink-4",
          )}
        >
          {state === "approved"
            ? `Approved ${formatDate(milestone.verifiedAt)}`
            : state === "submitted"
              ? "Needs review"
              : state === "rejected"
                ? "Sent back"
                : "Not started"}
        </span>
      </div>

      {milestone.proofNote ? (
        <p className="mt-2 pl-6 text-[12.5px] leading-relaxed text-ink-2">{milestone.proofNote}</p>
      ) : null}

      {milestone.proof.length > 0 ? (
        <div className="mt-2 flex gap-2 overflow-x-auto pl-6">
          {milestone.proof.map((asset) => (
            <div key={asset.id} className="h-20 w-24 shrink-0 overflow-hidden rounded-md">
              <Media src={asset.url} alt={asset.caption ?? milestone.title} rounded={false} />
            </div>
          ))}
        </div>
      ) : null}

      {milestone.submittedAt ? (
        <p className="mt-1.5 pl-6 text-[11.5px] text-ink-4">
          Submitted {formatDateTime(milestone.submittedAt)}
        </p>
      ) : null}

      {milestone.verifierNote ? (
        <p className="mt-1.5 pl-6 text-[12px] italic text-ink-3">
          Your note: {milestone.verifierNote}
        </p>
      ) : null}

      {state === "submitted" ? (
        rejecting ? (
          <div className="mt-2.5 pl-6">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What needs redoing or re-photographing?"
              className="w-full rounded-md border border-line bg-surface px-3 py-1.5 text-[12.5px] outline-none focus:border-brand"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejecting(false)}
                className="rounded-md px-2.5 py-1 text-[12px] text-ink-3"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending || note.trim().length < 3}
                onClick={() =>
                  startTransition(async () => {
                    await reviewStageAction(projectId, milestone.id, false, note.trim(), leadId);
                    setRejecting(false);
                  })
                }
                className="rounded-md bg-danger px-2.5 py-1 text-[12px] font-medium text-white disabled:opacity-50"
              >
                Send back
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2.5 flex justify-end gap-2 pl-6">
            <button
              type="button"
              onClick={() => setRejecting(true)}
              className="rounded-md bg-surface px-3 py-1.5 text-[12.5px] text-ink-2 hover:text-ink"
            >
              Send back
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () =>
                  reviewStageAction(projectId, milestone.id, true, null, leadId),
                )
              }
              className="rounded-md bg-brand px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-brand-hover disabled:opacity-50"
            >
              {pending ? "…" : "Approve stage"}
            </button>
          </div>
        )
      ) : null}
    </li>
  );
}
