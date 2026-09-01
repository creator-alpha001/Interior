"use client";

import { useState, useTransition } from "react";
import type { InvoiceStatus } from "@repo/types";
import { setInvoiceStatusAction } from "@/app/actions";

/**
 * Commission accrues on the agreed price at signing. The waive path exists
 * because the cancellation rule needs a human: waived if work never started,
 * retained once it has — and either way the reason is recorded.
 */
export function InvoiceActions({
  invoiceId,
  status,
}: {
  invoiceId: string;
  status: InvoiceStatus;
}) {
  const [waiving, setWaiving] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  if (status === "paid" || status === "waived" || status === "cancelled") {
    return <span className="text-[11.5px] text-ink-4">Closed</span>;
  }

  if (waiving) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reason for waiving"
          className="w-44 rounded-md border border-line bg-paper px-2 py-1 text-[12px] outline-none focus:border-brand"
        />
        <button
          type="button"
          disabled={pending || note.trim().length < 3}
          onClick={() =>
            startTransition(async () => {
              await setInvoiceStatusAction(invoiceId, "waived", note.trim());
              setWaiving(false);
            })
          }
          className="rounded-md bg-danger-soft px-2 py-1 text-[12px] text-danger disabled:opacity-50"
        >
          Waive
        </button>
        <button
          type="button"
          onClick={() => setWaiving(false)}
          className="rounded-md px-2 py-1 text-[12px] text-ink-3"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex justify-end gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setInvoiceStatusAction(invoiceId, "paid"))}
        className="rounded-md bg-brand px-2.5 py-1 text-[12px] font-medium text-white hover:bg-brand-hover disabled:opacity-50"
      >
        {pending ? "…" : "Mark paid"}
      </button>
      <button
        type="button"
        onClick={() => setWaiving(true)}
        className="rounded-md bg-surface-2 px-2.5 py-1 text-[12px] text-ink-2 hover:text-ink"
      >
        Waive
      </button>
    </div>
  );
}
