"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import type { City } from "@repo/types";
import { setCityAction } from "@/app/actions";
import { cn } from "@repo/ui";

/**
 * The city is not cosmetic: it decides which professionals can be assigned and
 * which price a catalogue item shows, since labour and material rates are not
 * uniform across cities.
 */
export function CitySwitcher({ cities, selected }: { cities: City[]; selected: City }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="flex h-11 items-center gap-1.5 rounded-full px-2.5 text-[14.5px] sm:text-[13.5px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
        aria-label={`Change city, currently ${selected.name}`}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-ink-4" aria-hidden="true">
          <path d="M8 1a4.5 4.5 0 00-4.5 4.5C3.5 9 8 15 8 15s4.5-6 4.5-9.5A4.5 4.5 0 008 1zm0 6.2a1.7 1.7 0 110-3.4 1.7 1.7 0 010 3.4z" />
        </svg>
        <span className="hidden sm:inline">{selected.name}</span>
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-lift)]">
          <p className="px-3 py-2 text-[12px] sm:text-[11px] uppercase tracking-wider text-ink-4">
            Prices and available professionals vary by city
          </p>
          {cities.map((city) => (
            <button
              key={city.id}
              type="button"
              onClick={() => {
                setOpen(false);
                startTransition(async () => setCityAction(city.id, pathname));
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[14.5px] sm:text-[13.5px] transition-colors hover:bg-surface-2",
                city.id === selected.id ? "font-medium text-brand" : "text-ink-2",
              )}
            >
              <span>{city.name}</span>
              <span className="text-[12.5px] sm:text-[11.5px] text-ink-4">{city.state}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
