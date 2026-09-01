"use client";

import { useState, useTransition } from "react";
import type { VendorPoolEntry } from "@repo/data";
import { Badge, cn } from "@repo/ui";
import { assignProfessionalsAction } from "@/app/actions";

/**
 * Assignment is manual and deliberate: the coordinator rings round, then ticks
 * the ones who confirmed. The pool is ranked to give them a shortlist to call —
 * requested vendors first, then rating, then whoever is least loaded — but
 * nothing is chosen automatically.
 */
export function AssignPanel({
  pool,
  leadDomainId,
  leadId,
  domainName,
  cityName,
}: {
  pool: VendorPoolEntry[];
  leadDomainId: string;
  leadId: string;
  domainName: string;
  cityName: string;
}) {
  const available = pool.filter((entry) => !entry.isAssigned);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  if (available.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-line-strong p-4 text-[13px] text-ink-3">
        No further {domainName.toLowerCase()} vendors available in {cityName}. Recruit for this
        city, or widen the service area of an existing vendor.
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-[12.5px] text-ink-3">
        {available.length} eligible in {cityName}. Call them first — tick the ones who confirmed
        they can take it, then assign.
      </p>

      <div className="space-y-1.5">
        {available.map((entry) => {
          const checked = selected.includes(entry.professional.id);
          const rating = entry.professional.domainRating?.avgRating ?? entry.professional.avgRating;
          return (
            <label
              key={entry.professional.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors",
                checked ? "border-brand bg-brand-soft" : "border-line hover:border-ink-4",
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  setSelected((prev) =>
                    checked
                      ? prev.filter((id) => id !== entry.professional.id)
                      : [...prev, entry.professional.id],
                  )
                }
                className="h-4 w-4 accent-[var(--color-brand)]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13.5px] font-medium text-ink">
                    {entry.professional.companyName}
                  </span>
                  {entry.isPreferred ? <Badge tone="clay">Client asked for them</Badge> : null}
                </div>
                <p className="mt-0.5 text-[11.5px] text-ink-4">
                  {entry.professional.name} · {entry.professional.experienceYears} yrs ·{" "}
                  {entry.professional.completedProjects} projects · replies in ~
                  {entry.professional.avgResponseHours}h
                </p>
              </div>
              <div className="shrink-0 text-right">
                <div className="tnum text-[13px] font-semibold text-ink">{rating.toFixed(1)}</div>
                <div className="text-[11px] text-ink-4">
                  {entry.activeLoad} live {entry.activeLoad === 1 ? "job" : "jobs"}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12px] text-ink-4">
          {selected.length} selected{selected.length > 3 ? " — three is the norm" : ""}
        </span>
        <button
          type="button"
          disabled={pending || selected.length === 0}
          onClick={() =>
            startTransition(async () => {
              await assignProfessionalsAction(leadDomainId, selected, leadId);
              setSelected([]);
            })
          }
          className="rounded-full bg-brand px-4 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
        >
          {pending ? "Assigning…" : selected.length > 0 ? `Assign ${selected.length}` : "Assign"}
        </button>
      </div>
    </div>
  );
}
