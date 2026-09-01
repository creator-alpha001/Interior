"use client";

import { useState, useTransition } from "react";
import type { MeetingType, ProfessionalSummary } from "@repo/types";
import { scheduleVisitAction } from "@/app/actions";

const types: Array<{ value: MeetingType; label: string }> = [
  { value: "site_visit", label: "Site visit" },
  { value: "measurement", label: "Measurement" },
  { value: "consultation", label: "Consultation" },
  { value: "handover", label: "Handover" },
];

/**
 * Booked by us, having confirmed the slot with both sides separately. Booking
 * releases the site address to that one vendor, for that one visit — the client
 * number is never released at all.
 */
export function ScheduleVisitForm({
  leadDomainId,
  leadId,
  professionals,
}: {
  leadDomainId: string;
  leadId: string;
  professionals: ProfessionalSummary[];
}) {
  const [professionalId, setProfessionalId] = useState(professionals[0]?.id ?? "");
  const [type, setType] = useState<MeetingType>("site_visit");
  const [when, setWhen] = useState("");
  const [pending, startTransition] = useTransition();

  if (professionals.length === 0) return null;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-[11.5px] text-ink-4">
        Professional
        <select
          value={professionalId}
          onChange={(e) => setProfessionalId(e.target.value)}
          className="mt-1 block rounded-md border border-line bg-paper px-2 py-1.5 text-[12.5px] text-ink outline-none focus:border-brand"
        >
          {professionals.map((pro) => (
            <option key={pro.id} value={pro.id}>
              {pro.companyName}
            </option>
          ))}
        </select>
      </label>

      <label className="text-[11.5px] text-ink-4">
        Type
        <select
          value={type}
          onChange={(e) => setType(e.target.value as MeetingType)}
          className="mt-1 block rounded-md border border-line bg-paper px-2 py-1.5 text-[12.5px] text-ink outline-none focus:border-brand"
        >
          {types.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label className="text-[11.5px] text-ink-4">
        When
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="mt-1 block rounded-md border border-line bg-paper px-2 py-1.5 text-[12.5px] text-ink outline-none focus:border-brand"
        />
      </label>

      <button
        type="button"
        disabled={pending || !when || !professionalId}
        onClick={() =>
          startTransition(async () => {
            await scheduleVisitAction(
              {
                leadDomainId,
                professionalId,
                scheduledAt: new Date(when).toISOString(),
                type,
              },
              leadId,
            );
            setWhen("");
          })
        }
        className="rounded-full bg-brand px-4 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
      >
        {pending ? "Booking…" : "Book visit"}
      </button>
    </div>
  );
}
