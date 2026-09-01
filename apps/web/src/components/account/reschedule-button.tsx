"use client";

import { useState, useTransition } from "react";
import { requestRescheduleAction } from "@/app/actions";
import { Button } from "@repo/ui";

/**
 * The client asks; they do not rebook. The coordinator re-confirms with the
 * professional before a new slot is set, which is the same reason there is no
 * direct calendar link between the two sides.
 */
export function RescheduleButton({
  meetingId,
  leadId,
}: {
  meetingId: string;
  leadId: string;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[13.5px] sm:text-[12.5px] font-medium text-brand hover:underline"
      >
        Ask to reschedule
      </button>
    );
  }

  return (
    <div className="mt-3 w-full rounded-lg border border-line bg-paper p-4">
      <label htmlFor={`res-${meetingId}`} className="text-[13.5px] sm:text-[12.5px] font-medium text-ink">
        When would suit you better?
      </label>
      <textarea
        id={`res-${meetingId}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="e.g. any evening after 6pm, or Saturday morning"
        className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px] sm:text-[13px] text-ink outline-none placeholder:text-ink-4 focus:border-brand"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] sm:text-[11.5px] text-ink-4">
          We confirm the new slot with the professional and come back to you.
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={pending || note.trim().length < 3}
            onClick={() =>
              startTransition(async () => {
                await requestRescheduleAction(meetingId, note.trim(), leadId);
                setOpen(false);
              })
            }
          >
            {pending ? "Sending…" : "Send request"}
          </Button>
        </div>
      </div>
    </div>
  );
}
