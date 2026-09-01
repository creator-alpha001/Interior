"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@repo/ui";

/**
 * Multi-service requirements are grouped by service rather than shown as one
 * mixed list, so a client never assumes one professional is handling
 * everything unless that is actually the case.
 */
export function DomainTabs({
  tabs,
  panels,
}: {
  tabs: Array<{ label: string; hint: string; badge?: string }>;
  panels: ReactNode[];
}) {
  const [active, setActive] = useState(0);

  if (tabs.length === 1) return <>{panels[0]}</>;

  return (
    <div>
      <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "w-[78%] shrink-0 snap-start rounded-xl border p-4 text-left transition-colors sm:w-auto sm:min-w-[190px]",
              active === i
                ? "border-brand bg-brand-soft"
                : "border-line bg-surface hover:border-ink-4",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "text-[15.5px] sm:text-[14.5px] font-semibold",
                  active === i ? "text-brand" : "text-ink",
                )}
              >
                {tab.label}
              </span>
              {tab.badge ? (
                <span className="rounded-full bg-clay px-1.5 py-0.5 text-[12px] sm:text-[10.5px] font-semibold text-white">
                  {tab.badge}
                </span>
              ) : null}
            </div>
            <span className="mt-1 block text-[13.5px] sm:text-[12.5px] text-ink-3">{tab.hint}</span>
          </button>
        ))}
      </div>
      <div className="mt-6">{panels[active]}</div>
    </div>
  );
}
