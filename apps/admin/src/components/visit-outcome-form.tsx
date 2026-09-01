"use client";

import { useState, useTransition } from "react";
import { cn, formatDateTime } from "@repo/ui";
import { recordVisitOutcomeAction } from "@/app/actions";

/**
 * Optional by design. Plenty of visits simply confirm what was already known,
 * and forcing a write-up on those produces noise. But when the visit changes
 * something — a wall is longer, damp is coming from next door — this is the
 * record every vendor quoting the job then works from, so the scope flag is
 * deliberately prominent.
 */
export function VisitOutcomeForm({
  meetingId,
  leadId,
  outcome,
  recordedAt,
  changedScope,
}: {
  meetingId: string;
  leadId: string;
  outcome: string | null;
  recordedAt: string | null;
  changedScope: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(outcome ?? "");
  const [scope, setScope] = useState(changedScope);
  const [pending, startTransition] = useTransition();

  if (outcome && !editing) {
    return (
      <div
        className={cn(
          "mt-2.5 rounded-md border-l-2 py-2 pl-3 pr-2",
          changedScope ? "border-warning bg-warning-soft" : "border-line bg-paper",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-wider text-ink-4 sm:text-[11px]">
            {changedScope ? "Outcome — scope changed" : "Outcome"}
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[12.5px] text-ink-4 hover:text-ink sm:text-[11.5px]"
          >
            Edit
          </button>
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-2 sm:text-[12px]">{outcome}</p>
        {recordedAt ? (
          <p className="mt-1 text-[12px] text-ink-4 sm:text-[11px]">
            Recorded {formatDateTime(recordedAt)}
          </p>
        ) : null}
      </div>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-2.5 text-[13px] font-medium text-brand hover:underline sm:text-[12px]"
      >
        + Record what the visit established
      </button>
    );
  }

  return (
    <div className="mt-2.5 rounded-md border border-line bg-paper p-3">
      <label
        htmlFor={`outcome-${meetingId}`}
        className="text-[12px] font-semibold uppercase tracking-wider text-ink-4 sm:text-[11px]"
      >
        Visit outcome
      </label>
      <textarea
        id={`outcome-${meetingId}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="Measurements taken, conditions found, anything that differs from what the customer described. This is what the vendors quote against."
        className="mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px] outline-none placeholder:text-ink-4 focus:border-brand"
      />

      <label className="mt-2.5 flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={scope}
          onChange={(e) => setScope(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]"
        />
        <span className="text-[13px] leading-snug text-ink-2 sm:text-[12px]">
          This changed the scope
          <span className="block text-[12px] text-ink-4 sm:text-[11px]">
            Flags the lead so existing quotes get revisited — otherwise vendors are pricing the
            wrong job.
          </span>
        </span>
      </label>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setText(outcome ?? "");
            setScope(changedScope);
          }}
          className="rounded-md px-3 py-1.5 text-[13px] text-ink-3 sm:text-[12.5px]"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={pending || text.trim().length < 5}
          onClick={() =>
            startTransition(async () => {
              await recordVisitOutcomeAction(meetingId, text.trim(), scope, leadId);
              setEditing(false);
            })
          }
          className="rounded-full bg-brand px-4 py-1.5 text-[13px] font-medium text-white hover:bg-brand-hover disabled:opacity-50 sm:text-[12.5px]"
        >
          {pending ? "Saving…" : "Save outcome"}
        </button>
      </div>
    </div>
  );
}
