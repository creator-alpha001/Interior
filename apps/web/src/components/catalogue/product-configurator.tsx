"use client";

import { useMemo, useState } from "react";
import type { ProductView } from "@repo/types";
import { formatRupees, priceUnitLabel } from "@repo/data";
import { ButtonLink, cn } from "@repo/ui";

/**
 * Choosing options here does not place an order — it starts a requirement
 * pre-loaded with the selection, which is what the vendors then quote against.
 */
export function ProductConfigurator({ view }: { view: ProductView }) {
  const { product, effectivePrice } = view;

  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(product.options.map((o) => [o.name, o.values[0]?.label ?? ""])),
  );
  const [quantity, setQuantity] = useState(1);

  const unitPrice = useMemo(() => {
    const delta = product.options.reduce((sum, option) => {
      const value = option.values.find((v) => v.label === selected[option.name]);
      return sum + (value?.priceDelta ?? 0);
    }, 0);
    return effectivePrice + delta;
  }, [product.options, selected, effectivePrice]);

  const href = useMemo(() => {
    const params = new URLSearchParams({
      product: product.slug,
      qty: String(quantity),
    });
    const chosen = Object.entries(selected).filter(([, v]) => v);
    if (chosen.length) {
      params.set("opts", chosen.map(([k, v]) => `${k}:${v}`).join("|"));
    }
    return `/submit-requirement?${params.toString()}`;
  }, [product.slug, quantity, selected]);

  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[13px] sm:text-[12px] text-ink-4">Indicative price</div>
          <div className="mt-1 font-display text-[34px] leading-none text-ink">
            {formatRupees(unitPrice)}
          </div>
          <div className="mt-1.5 text-[13.5px] sm:text-[12.5px] text-ink-3">
            {priceUnitLabel[product.priceUnit]} · final price comes from the vendor quote
          </div>
        </div>
        {product.leadTimeDays ? (
          <div className="text-right">
            <div className="text-[13px] sm:text-[12px] text-ink-4">Typical</div>
            <div className="text-[15px] font-semibold text-ink">{product.leadTimeDays} days</div>
          </div>
        ) : null}
      </div>

      {product.options.length > 0 ? (
        <div className="mt-6 space-y-5 border-t border-line pt-6">
          {product.options.map((option) => (
            <div key={option.id}>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-[14px] sm:text-[13px] font-medium text-ink">{option.name}</span>
                <span className="text-[13px] sm:text-[12px] text-ink-4">{selected[option.name]}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {option.values.map((value) => {
                  const isActive = selected[option.name] === value.label;
                  return (
                    <button
                      key={value.id}
                      type="button"
                      onClick={() =>
                        setSelected((prev) => ({ ...prev, [option.name]: value.label }))
                      }
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-[13.5px] sm:text-[12.5px] transition-colors",
                        isActive
                          ? "border-brand bg-brand-soft font-medium text-brand"
                          : "border-line bg-paper text-ink-2 hover:border-ink-4",
                      )}
                    >
                      {value.label}
                      {value.priceDelta !== 0 ? (
                        <span className={cn("ml-1.5", isActive ? "text-brand" : "text-ink-4")}>
                          {value.priceDelta > 0 ? "+" : "−"}
                          {formatRupees(Math.abs(value.priceDelta)).replace("₹", "₹")}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-between border-t border-line pt-6">
        <span className="text-[14px] sm:text-[13px] font-medium text-ink">Quantity</span>
        <div className="flex items-center gap-1 rounded-full border border-line">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="grid h-9 w-9 place-items-center rounded-full text-ink-2 hover:bg-surface-2"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="w-8 text-center text-[15px] sm:text-[14px] font-medium">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(50, q + 1))}
            className="grid h-9 w-9 place-items-center rounded-full text-ink-2 hover:bg-surface-2"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
      </div>

      <ButtonLink href={href} size="lg" className="mt-6 w-full">
        Get 3 quotes for this
      </ButtonLink>
      <p className="mt-3 text-center text-[13px] sm:text-[12px] leading-relaxed text-ink-4">
        Free. No payment now — three verified professionals visit, measure and quote.
      </p>
    </div>
  );
}
