"use client";

import Link from "next/link";
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
  domainSlug,
  cityName,
}: {
  pool: VendorPoolEntry[];
  leadDomainId: string;
  leadId: string;
  domainName: string;
  /** For the link to the vendors list, filtered to this trade. */
  domainSlug: string;
  cityName: string;
}) {
  const available = pool.filter((entry) => !entry.isAssigned);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  /**
   * Two different situations, and they were saying the same sentence.
   *
   * "No further vendors" is true when every eligible one is already on this
   * job. It is misleading when there were never any — which is what a
   * coordinator actually hits on a lead in a city the trade does not cover
   * yet, and it reads as though the panel is broken rather than as though the
   * answer is genuinely nobody.
   *
   * Eligibility is four conditions at once (`eligible_vendors`): verified,
   * approved for this trade, serving this city, and signed up on the current
   * terms. Saying so is the difference between "assign is missing" and "here
   * is what to go and fix".
   */
  if (pool.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-line-strong p-4 text-[13px] text-ink-3">
        <p className="font-medium text-ink">
          No vendor can take {domainName.toLowerCase()} in {cityName} yet.
        </p>
        <p className="mt-1.5 leading-relaxed">
          A vendor reaches this pool only when all four are true: verified, approved for{" "}
          {domainName.toLowerCase()}, covering {cityName}, and signed up on the current partner
          terms. Nobody currently clears all four.
        </p>
        <Link
          href={`/vendors?domain=${encodeURIComponent(domainSlug)}`}
          className="mt-2.5 inline-block font-medium text-brand"
        >
          See who is approved for {domainName.toLowerCase()} →
        </Link>
      </div>
    );
  }

  if (available.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-line-strong p-4 text-[13px] text-ink-3">
        Every eligible {domainName.toLowerCase()} vendor in {cityName} is already assigned to this
        job. Recruit for this city, or widen the service area of an existing vendor.
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
