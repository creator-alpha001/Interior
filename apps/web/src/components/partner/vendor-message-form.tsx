"use client";

import { useState, useTransition } from "react";
import { sendVendorMessageAction } from "@/app/partner/actions";

/**
 * Messages go to our coordinator, never to the customer. Anything meant for the
 * customer gets carried across — and usually put to all three vendors, so the
 * quotes stay comparable.
 */
export function VendorMessageForm({ leadDomainId }: { leadDomainId: string }) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="border-t border-line p-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="Ask our coordinator something about this job…"
        className="w-full rounded-md border border-line bg-paper px-3 py-2 text-[13px] outline-none placeholder:text-ink-4 focus:border-brand"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11.5px] text-ink-4">Goes to our team, not the customer.</span>
        <button
          type="button"
          disabled={pending || body.trim().length < 3}
          onClick={() =>
            startTransition(async () => {
              await sendVendorMessageAction(leadDomainId, body.trim());
              setBody("");
            })
          }
          className="rounded-full bg-brand px-4 py-1.5 text-[12.5px] font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
