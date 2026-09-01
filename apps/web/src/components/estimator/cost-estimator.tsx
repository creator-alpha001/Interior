"use client";

import { useMemo, useState } from "react";
import type { EstimatorConfig } from "@repo/data";
import { estimate, formatRupees, formatRupeesShort } from "@repo/data";
import { ButtonLink, cn } from "@repo/ui";

/**
 * Deliberately produces a range, never a single number. An estimate that looks
 * precise is worse than one that admits what it is — the customer anchors on it
 * and then feels misled when the real quote lands.
 */
export function CostEstimator({ configs }: { configs: EstimatorConfig[] }) {
  const [domainIndex, setDomainIndex] = useState(0);
  const config = configs[domainIndex];

  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(configs.map((c) => [c.domainId, c.field.default])),
  );
  const [tiers, setTiers] = useState<Record<string, string>>(() =>
    Object.fromEntries(configs.map((c) => [c.domainId, c.tiers[0].key])),
  );

  const quantity = quantities[config.domainId] ?? config.field.default;
  const tierKey = tiers[config.domainId] ?? config.tiers[0].key;
  const result = useMemo(() => estimate(config, quantity, tierKey), [config, quantity, tierKey]);

  const unitLabel: Record<string, string> = {
    rooms: quantity === 1 ? "bedroom" : "bedrooms",
    area: "sq.ft carpet area",
    pieces: quantity === 1 ? "piece" : "pieces",
    running_ft: "running ft",
  };

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      {/* Trade selector */}
      <div className="flex gap-1 overflow-x-auto border-b border-line bg-surface-2 p-1.5 no-scrollbar">
        {configs.map((c, i) => (
          <button
            key={c.domainId}
            type="button"
            onClick={() => setDomainIndex(i)}
            className={cn(
              "shrink-0 rounded-lg px-4 py-2 text-[14.5px] sm:text-[13.5px] font-medium transition-colors",
              i === domainIndex
                ? "bg-surface text-brand shadow-sm"
                : "text-ink-3 hover:text-ink",
            )}
          >
            {c.domainName}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
        {/* Inputs */}
        <div className="p-6 sm:p-8">
          <p className="text-[14.5px] sm:text-[13.5px] leading-relaxed text-ink-3">{config.basis}</p>

          <div className="mt-7">
            <div className="flex items-baseline justify-between">
              <label htmlFor="qty" className="text-[14px] sm:text-[13px] font-medium text-ink">
                {config.field.label}
              </label>
              <span className="font-display text-[22px] text-ink">
                {quantity.toLocaleString("en-IN")}{" "}
                <span className="font-sans text-[13.5px] sm:text-[12.5px] text-ink-4">
                  {unitLabel[config.field.kind]}
                </span>
              </span>
            </div>
            <input
              id="qty"
              type="range"
              min={config.field.min}
              max={config.field.max}
              step={config.field.step}
              value={quantity}
              onChange={(e) =>
                setQuantities((prev) => ({ ...prev, [config.domainId]: Number(e.target.value) }))
              }
              className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-2 accent-[var(--color-brand)]"
            />
            <p className="mt-2 text-[13px] sm:text-[12px] text-ink-4">{config.field.hint}</p>
          </div>

          <div className="mt-7">
            <span className="text-[14px] sm:text-[13px] font-medium text-ink">Finish level</span>
            <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
              {config.tiers.map((tier) => {
                const active = tierKey === tier.key;
                return (
                  <button
                    key={tier.key}
                    type="button"
                    onClick={() => setTiers((prev) => ({ ...prev, [config.domainId]: tier.key }))}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      active ? "border-brand bg-brand-soft" : "border-line bg-paper hover:border-ink-4",
                    )}
                  >
                    <div
                      className={cn(
                        "text-[14.5px] sm:text-[13.5px] font-medium",
                        active ? "text-brand" : "text-ink",
                      )}
                    >
                      {tier.label}
                    </div>
                    <div className="mt-0.5 text-[13px] sm:text-[12px] leading-snug text-ink-3">{tier.hint}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Result */}
        <div className="border-t border-line bg-paper p-6 sm:p-8 lg:border-l lg:border-t-0">
          <p className="text-[13px] sm:text-[12px] uppercase tracking-wider text-ink-4">Rough range</p>
          <div className="mt-2 font-display text-[34px] leading-none text-ink sm:text-[40px]">
            {formatRupeesShort(result.low)} – {formatRupeesShort(result.high)}
          </div>
          <p className="mt-2 text-[14px] sm:text-[13px] text-ink-3">
            Midpoint {formatRupees(result.mid)} · {config.domainName.toLowerCase()} in a typical
            home
          </p>

          <div className="mt-6 rounded-lg border border-clay-line bg-clay-soft p-4">
            <p className="text-[13.5px] sm:text-[12.5px] font-semibold text-clay">This is a bracket, not a quote</p>
            <p className="mt-1.5 text-[13.5px] sm:text-[12.5px] leading-relaxed text-ink-2">
              Real prices come from a site visit. Three professionals will each measure the job and
              quote against the same brief — that is the number you should decide on.
            </p>
          </div>

          <div className="mt-5">
            <p className="text-[13px] sm:text-[12px] font-semibold uppercase tracking-wider text-ink-4">
              Not included
            </p>
            <ul className="mt-2.5 space-y-1.5">
              {config.caveats.map((c) => (
                <li key={c} className="flex gap-2 text-[13.5px] sm:text-[12.5px] leading-relaxed text-ink-3">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-4" />
                  {c}
                </li>
              ))}
            </ul>
          </div>

          <ButtonLink
            href={`/submit-requirement?domain=${config.domainSlug}`}
            size="lg"
            className="mt-6 w-full"
          >
            Get a real quote, free
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
