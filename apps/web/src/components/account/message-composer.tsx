"use client";

import { useState, useTransition } from "react";
import { sendClientMessageAction } from "@/app/actions";
import { Button } from "@repo/ui";

/**
 * The client's only outbound channel. There is deliberately no way to address
 * a specific vendor from here — the team decides what goes to whom, and a
 * question worth asking usually goes to all three.
 */
export function MessageComposer({
  leadDomainId,
  leadId,
}: {
  leadDomainId: string;
  leadId: string;
}) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-5 border-t border-line pt-4">
      <label htmlFor={`msg-${leadDomainId}`} className="text-[14px] sm:text-[13px] font-medium text-ink">
        Message our team
      </label>
      <textarea
        id={`msg-${leadDomainId}`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="e.g. can all three quote for a taller loft as well?"
        className="mt-2 w-full rounded-lg border border-line bg-paper px-3.5 py-3 text-[15px] sm:text-[14px] text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-brand"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] sm:text-[12px] text-ink-4">
          Replies usually within a couple of hours on working days.
        </p>
        <Button
          size="sm"
          disabled={pending || body.trim().length < 3}
          onClick={() =>
            startTransition(async () => {
              await sendClientMessageAction(leadDomainId, body.trim(), leadId);
              setBody("");
            })
          }
        >
          {pending ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  );
}
