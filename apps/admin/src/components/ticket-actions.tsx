"use client";

import { useState, useTransition } from "react";
import type { SupportTicket } from "@repo/types";
import { cn } from "@repo/ui";
import { replyToTicketAction, setTicketStatusAction } from "@/app/actions";

export function TicketActions({
  ticketId,
  status,
}: {
  ticketId: string;
  status: SupportTicket["status"];
}) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  const statuses: Array<{ value: SupportTicket["status"]; label: string }> = [
    { value: "open", label: "Open" },
    { value: "in_progress", label: "In progress" },
    { value: "resolved", label: "Resolved" },
    { value: "closed", label: "Closed" },
  ];

  return (
    <div className="border-t border-line bg-paper p-4">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="Reply to whoever raised this…"
        className="w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px] outline-none placeholder:text-ink-4 focus:border-brand"
      />
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {statuses.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={pending || option.value === status}
              onClick={() =>
                startTransition(async () => setTicketStatusAction(ticketId, option.value))
              }
              className={cn(
                "rounded-md px-2 py-1 text-[11.5px] transition-colors disabled:cursor-default",
                option.value === status
                  ? "bg-brand text-white"
                  : "bg-surface-2 text-ink-2 hover:text-ink",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={pending || body.trim().length < 3}
          onClick={() =>
            startTransition(async () => {
              await replyToTicketAction(ticketId, body.trim());
              setBody("");
            })
          }
          className="rounded-full bg-brand px-4 py-1.5 text-[12.5px] font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {pending ? "Sending…" : "Reply"}
        </button>
      </div>
    </div>
  );
}
