"use client";

import { useState, useTransition } from "react";
import { replyToTicketAction } from "@/app/actions";
import { Button } from "@repo/ui";

export function TicketReplyForm({ ticketId }: { ticketId: string }) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="Add to this ticket…"
        aria-label="Reply to ticket"
        className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-[14.5px] sm:text-[13.5px] text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-brand"
      />
      <Button
        size="sm"
        disabled={pending || body.trim().length < 3}
        onClick={() =>
          startTransition(async () => {
            await replyToTicketAction(ticketId, body.trim());
            setBody("");
          })
        }
      >
        {pending ? "Sending…" : "Reply"}
      </Button>
    </div>
  );
}
