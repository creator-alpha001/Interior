"use client";

import { useState, useTransition } from "react";
import type { ProjectMilestone } from "@repo/types";
import { Media, cn, formatDateTime } from "@repo/ui";
import { submitStageProofAction } from "@/app/partner/actions";

/**
 * Closing out a stage with evidence.
 *
 * Submitting does not mark the stage complete — our team approves it, and only
 * then does the customer's progress bar move. That gap is deliberate: "done"
 * should mean somebody checked, not that somebody said so.
 */
export function StageProofForm({
  projectId,
  milestone,
  isNext,
}: {
  projectId: string;
  milestone: ProjectMilestone;
  isNext: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<Array<{ name: string; url: string }>>([]);
  const [pending, startTransition] = useTransition();

  const state = milestone.verification;

  return (
    <div
      className={cn(
        "rounded-md border p-3",
        state === "approved"
          ? "border-line bg-paper"
          : state === "submitted"
            ? "border-brand-line bg-brand-soft"
            : state === "rejected"
              ? "border-danger/30 bg-danger-soft"
              : isNext
                ? "border-line-strong bg-surface"
                : "border-line bg-surface",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px]",
                state === "approved"
                  ? "bg-brand text-white"
                  : state === "submitted"
                    ? "bg-brand-soft text-brand ring-1 ring-brand"
                    : state === "rejected"
                      ? "bg-danger text-white"
                      : "border border-line-strong bg-surface text-ink-4",
              )}
            >
              {state === "approved" ? "✓" : state === "rejected" ? "!" : ""}
            </span>
            <span
              className={cn(
                "text-[14px] font-medium",
                state === "approved" ? "text-ink" : "text-ink-2",
              )}
            >
              {milestone.title}
            </span>
          </div>
          {milestone.description ? (
            <p className="mt-1 pl-7 text-[12.5px] leading-relaxed text-ink-4">
              {milestone.description}
            </p>
          ) : null}
        </div>

        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-medium",
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
            ? "Approved"
            : state === "submitted"
              ? "Awaiting review"
              : state === "rejected"
                ? "Sent back"
                : isNext
                  ? "Up next"
                  : "Not started"}
        </span>
      </div>

      {milestone.verifierNote && state === "rejected" ? (
        <p className="mt-2 rounded bg-surface px-3 py-2 text-[12.5px] leading-relaxed text-danger">
          Sent back by our team: {milestone.verifierNote}
        </p>
      ) : null}

      {milestone.proofNote ? (
        <p className="mt-2 pl-7 text-[13px] leading-relaxed text-ink-2">{milestone.proofNote}</p>
      ) : null}

      {milestone.proof.length > 0 ? (
        <div className="mt-2 flex gap-2 overflow-x-auto pl-7">
          {milestone.proof.map((asset) => (
            <div key={asset.id} className="h-20 w-24 shrink-0 overflow-hidden rounded-md">
              <Media src={asset.url} alt={asset.caption ?? milestone.title} rounded={false} />
            </div>
          ))}
        </div>
      ) : null}

      {milestone.submittedAt ? (
        <p className="mt-2 pl-7 text-[11.5px] text-ink-4">
          Submitted {formatDateTime(milestone.submittedAt)}
          {milestone.verifiedAt ? ` · reviewed ${formatDateTime(milestone.verifiedAt)}` : ""}
        </p>
      ) : null}

      {/* Evidence can be added while not started, or re-sent after a rejection. */}
      {state === "not_started" || state === "rejected" ? (
        open ? (
          <div className="mt-3 rounded-md border border-line bg-paper p-3">
            <label className="text-[12px] uppercase tracking-wider text-ink-4">
              What was done at this stage
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="What you completed, anything the customer should know, and anything left over."
                className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-[13.5px] outline-none placeholder:text-ink-4 focus:border-brand"
              />
            </label>

            <div className="mt-3">
              <span className="text-[12px] uppercase tracking-wider text-ink-4">Photos</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {photos.map((photo, i) => (
                  <div
                    key={photo.url}
                    className="group relative h-20 w-20 overflow-hidden rounded-md border border-line"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt={photo.name} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                      aria-label={`Remove ${photo.name}`}
                      className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-[11px] text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-md border border-dashed border-line-strong bg-surface text-center text-[11.5px] text-ink-3 hover:border-brand hover:text-brand">
                  <span>
                    <span className="block text-[18px] leading-none">+</span>
                    Photo
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []).slice(0, 8 - photos.length);
                      setPhotos((prev) => [
                        ...prev,
                        ...files.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })),
                      ]);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <p className="mt-1.5 text-[11.5px] text-ink-4">
                The customer sees these. Photographs of the finished stage, not of the packaging.
              </p>
            </div>

            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-1.5 text-[13px] text-ink-3"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending || note.trim().length < 5 || photos.length === 0}
                onClick={() =>
                  startTransition(async () => {
                    await submitStageProofAction(
                      projectId,
                      milestone.id,
                      note.trim(),
                      photos.length,
                    );
                    setOpen(false);
                    setNote("");
                    setPhotos([]);
                  })
                }
                className="rounded-full bg-brand px-4 py-1.5 text-[13px] font-medium text-white hover:bg-brand-hover disabled:opacity-50"
              >
                {pending ? "Submitting…" : "Submit for review"}
              </button>
            </div>
            {photos.length === 0 ? (
              <p className="mt-2 text-right text-[11.5px] text-ink-4">
                At least one photo is required.
              </p>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-3 h-10 w-full rounded-full bg-brand text-[13.5px] font-medium text-white hover:bg-brand-hover"
          >
            {state === "rejected" ? "Resubmit this stage" : "Mark done and upload proof"}
          </button>
        )
      ) : null}
    </div>
  );
}
