"use client";

import { useState, useTransition } from "react";
import type { SupportTicket } from "@repo/types";
import { createTicketAction } from "@/app/actions";
import { Button, Card, cn } from "@repo/ui";

const categories: Array<{ value: SupportTicket["category"]; label: string; hint: string }> = [
  { value: "query", label: "Question", hint: "Something you want explained" },
  { value: "complaint", label: "Complaint", hint: "Work or conduct fell short" },
  { value: "escalation", label: "Escalation", hint: "Delayed, and not moving" },
  { value: "refund", label: "Refund", hint: "Money needs sorting out" },
  { value: "technical", label: "Technical", hint: "Something on the site is broken" },
];

export function NewTicketForm() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<SupportTicket["category"]>("query");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-5">
        <p className="text-[15px] sm:text-[14px] text-ink-2">Something not right? Tell us and we will act on it.</p>
        <Button size="sm" onClick={() => setOpen(true)}>
          Raise a ticket
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-[21px]">Raise a ticket</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[13.5px] sm:text-[12.5px] text-ink-4 hover:text-ink"
        >
          Cancel
        </button>
      </div>

      <div className="mt-5">
        <span className="text-[14px] sm:text-[13px] font-medium text-ink">What is this about?</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              title={c.hint}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[14px] sm:text-[13px] transition-colors",
                category === c.value
                  ? "border-brand bg-brand-soft font-medium text-brand"
                  : "border-line bg-paper text-ink-2 hover:border-ink-4",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[13px] sm:text-[12px] text-ink-4">
          {categories.find((c) => c.value === category)?.hint}
        </p>
      </div>

      <div className="mt-5">
        <label htmlFor="subject" className="text-[14px] sm:text-[13px] font-medium text-ink">
          Subject
        </label>
        <input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Installation delayed by a week with no update"
          className="mt-2 h-11 w-full rounded-lg border border-line bg-paper px-3.5 text-[15px] sm:text-[14px] text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-brand"
        />
      </div>

      <div className="mt-4">
        <label htmlFor="body" className="text-[14px] sm:text-[13px] font-medium text-ink">
          What happened?
        </label>
        <textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="Dates, what was promised, and what actually happened. Specifics let us act on it the same day."
          className="mt-2 w-full rounded-lg border border-line bg-paper px-3.5 py-3 text-[15px] sm:text-[14px] text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-brand"
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-[13px] sm:text-[12px] text-ink-4">Complaints and escalations are prioritised.</p>
        <Button
          size="sm"
          disabled={pending || subject.trim().length < 5 || body.trim().length < 10}
          onClick={() =>
            startTransition(async () =>
              createTicketAction({ category, subject: subject.trim(), body: body.trim() }),
            )
          }
        >
          {pending ? "Submitting…" : "Submit ticket"}
        </Button>
      </div>
    </Card>
  );
}
