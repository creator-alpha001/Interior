"use client";

import { useState, useTransition } from "react";
import { submitReviewAction } from "@/app/actions";
import { Button, cn } from "@repo/ui";

const facets = [
  { key: "qualityRating", label: "Quality of work" },
  { key: "timelinessRating", label: "Timeliness" },
  { key: "professionalismRating", label: "Professionalism" },
] as const;

/**
 * Reviews are per project, so a professional who handled two services for one
 * customer is rated twice, independently. That granularity is what makes the
 * per-domain ratings on their profile mean anything.
 */
export function ReviewForm({
  projectId,
  professionalName,
  domainName,
}: {
  projectId: string;
  professionalName: string;
  domainName: string;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-clay-line bg-clay-soft p-4">
        <p className="text-[14.5px] sm:text-[13.5px] text-ink-2">
          This project is complete — rate {professionalName} on the {domainName.toLowerCase()} work.
        </p>
        <Button variant="clay" size="sm" onClick={() => setOpen(true)}>
          Write a review
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-lg border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-display text-[19px]">Rate the {domainName.toLowerCase()} work</h4>
          <p className="mt-1 text-[13.5px] sm:text-[12.5px] text-ink-3">
            {professionalName} · this rating counts towards their {domainName.toLowerCase()} score
            only
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[13.5px] sm:text-[12.5px] text-ink-4 hover:text-ink"
        >
          Cancel
        </button>
      </div>

      <div className="mt-4 flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(value)}
            onMouseEnter={() => setHover(value)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${value} star${value > 1 ? "s" : ""}`}
            className="p-0.5"
          >
            <svg
              viewBox="0 0 20 20"
              className={cn(
                "h-7 w-7 transition-colors",
                (hover || rating) >= value ? "fill-clay" : "fill-line-strong",
              )}
            >
              <path d="M10 1.6l2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.8L10 1.6z" />
            </svg>
          </button>
        ))}
        <span className="ml-2 text-[14px] sm:text-[13px] text-ink-3">
          {["", "Poor", "Below par", "Fine", "Good", "Excellent"][hover || rating] ?? ""}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {facets.map((facet) => (
          <div key={facet.key}>
            <span className="text-[13.5px] sm:text-[12.5px] text-ink-3">{facet.label}</span>
            <div className="mt-1.5 flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setScores((prev) => ({ ...prev, [facet.key]: value }))}
                  className={cn(
                    "h-7 w-7 rounded-md border text-[13px] sm:text-[12px] transition-colors",
                    (scores[facet.key] ?? 0) >= value
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-line bg-paper text-ink-4 hover:border-ink-4",
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={4}
        placeholder="What went well, and what could have been better? Specifics help the next customer more than praise."
        className="mt-5 w-full rounded-lg border border-line bg-paper px-3.5 py-3 text-[15px] sm:text-[14px] text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-brand"
      />

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-[13px] sm:text-[12px] text-ink-4">Published on their profile with your first name.</p>
        <Button
          size="sm"
          disabled={pending || rating === 0 || comment.trim().length < 10}
          onClick={() =>
            startTransition(async () => {
              await submitReviewAction({
                projectId,
                rating: rating as 1 | 2 | 3 | 4 | 5,
                comment: comment.trim(),
                qualityRating: scores.qualityRating ?? null,
                timelinessRating: scores.timelinessRating ?? null,
                professionalismRating: scores.professionalismRating ?? null,
              });
              setOpen(false);
            })
          }
        >
          {pending ? "Submitting…" : "Submit review"}
        </Button>
      </div>
    </div>
  );
}
