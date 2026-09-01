"use client";

import { useState, useTransition } from "react";
import type { LeadSalesActivity } from "@repo/types";
import { cn } from "@repo/ui";
import { logCallAction } from "@/app/actions";

const outcomes: Array<{ value: LeadSalesActivity["callStatus"]; label: string }> = [
  { value: "connected", label: "Connected" },
  { value: "not_reachable", label: "Not reachable" },
  { value: "busy", label: "Busy" },
  { value: "callback_requested", label: "Callback" },
  { value: "not_interested", label: "Not interested" },
];

/**
 * Where the scoping detail the client form deliberately omits gets captured —
 * exact sizes, finishes, site constraints. Every assigned vendor then quotes
 * from the same brief, which is the whole reason their quotes are comparable.
 */
export function CallLogForm({ leadId }: { leadId: string }) {
  const [status, setStatus] = useState<LeadSalesActivity["callStatus"]>("connected");
  const [remarks, setRemarks] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {outcomes.map((outcome) => (
          <button
            key={outcome.value}
            type="button"
            onClick={() => setStatus(outcome.value)}
            className={cn(
              "rounded-md px-2.5 py-1 text-[12.5px] transition-colors",
              status === outcome.value
                ? "bg-brand text-white"
                : "bg-surface-2 text-ink-2 hover:text-ink",
            )}
          >
            {outcome.label}
          </button>
        ))}
      </div>

      <textarea
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
        rows={4}
        placeholder="Exact sizes, finishes, site constraints, access timings — everything the vendors need to quote the same job."
        className="mt-3 w-full rounded-md border border-line bg-paper px-3 py-2 text-[13px] outline-none placeholder:text-ink-4 focus:border-brand"
      />

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <label className="text-[12px] text-ink-3">
          Follow up on
          <input
            type="date"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            className="ml-2 rounded-md border border-line bg-paper px-2 py-1 text-[12.5px] text-ink outline-none focus:border-brand"
          />
        </label>
        <button
          type="button"
          disabled={pending || remarks.trim().length < 5}
          onClick={() =>
            startTransition(async () => {
              await logCallAction({
                leadId,
                callStatus: status,
                remarks: remarks.trim(),
                followUpDate: followUp || null,
              });
              setRemarks("");
              setFollowUp("");
            })
          }
          className="rounded-full bg-brand px-4 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
        >
          {pending ? "Saving…" : "Log call"}
        </button>
      </div>
    </div>
  );
}
