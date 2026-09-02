"use client";

import { useMemo, useState, useTransition } from "react";
import type { Quote } from "@repo/types";
import { formatRupees } from "@repo/data";
import { cn } from "@repo/ui";
import { submitQuoteAction } from "@/app/partner/actions";

interface Line {
  description: string;
  quantity: string;
  unit: string;
  rate: string;
}

/**
 * Quotes are line-itemised on purpose. The customer compares three of these
 * side by side, and a single lump sum loses every time against a quote that
 * shows what the money buys — so the form makes itemising the easy path.
 */
export function QuoteBuilder({
  leadDomainId,
  suggestedUnit,
  materialsLabel,
  existing,
}: {
  leadDomainId: string;
  suggestedUnit: string;
  materialsLabel: string;
  existing: Quote | null;
}) {
  const [open, setOpen] = useState(!existing);
  const [lines, setLines] = useState<Line[]>(
    existing
      ? existing.lineItems.map((l) => ({
          description: l.description,
          quantity: String(l.quantity),
          unit: l.unit,
          rate: String(l.rate),
        }))
      : [{ description: "", quantity: "1", unit: suggestedUnit, rate: "" }],
  );
  const [taxPercent, setTaxPercent] = useState(String(existing?.taxPercent ?? 18));
  const [timelineDays, setTimelineDays] = useState(String(existing?.timelineDays ?? ""));
  const [warrantyMonths, setWarrantyMonths] = useState(String(existing?.warrantyMonths ?? ""));
  const [warrantyDetails, setWarrantyDetails] = useState(existing?.warrantyDetails ?? "");
  const [materials, setMaterials] = useState(existing?.materialsSummary ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [pending, startTransition] = useTransition();

  const totals = useMemo(() => {
    const subtotal = lines.reduce(
      (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.rate) || 0),
      0,
    );
    const tax = Math.round((subtotal * (Number(taxPercent) || 0)) / 100);
    return { subtotal: Math.round(subtotal), tax, total: Math.round(subtotal) + tax };
  }, [lines, taxPercent]);

  const valid =
    lines.some((l) => l.description.trim() && Number(l.rate) > 0) &&
    Number(timelineDays) > 0 &&
    materials.trim().length > 3;

  const field =
    "w-full rounded-md border border-line bg-paper px-2.5 py-1.5 text-[13px] outline-none placeholder:text-ink-4 focus:border-brand";

  if (!open) {
    return (
      <div className="rounded-lg border border-line bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[12px] uppercase tracking-wider text-ink-4">
              Your quote{existing && existing.version > 1 ? ` · version ${existing.version}` : ""}
            </p>
            <p className="tnum mt-1 font-display text-[26px] leading-none text-ink">
              {formatRupees(existing?.total ?? 0)}
            </p>
            <p className="mt-1.5 text-[12.5px] text-ink-3">
              {existing?.timelineDays} days · {existing?.warrantyMonths} month warranty
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-md bg-surface-2 px-3 py-1.5 text-[12.5px] text-ink-2 hover:text-ink"
          >
            Revise quote
          </button>
        </div>

        <dl className="mt-3 border-t border-line pt-3 text-[12.5px]">
          <div className="flex justify-between gap-4 py-1">
            <dt className="text-ink-4">{materialsLabel}</dt>
            <dd className="max-w-[60%] text-right text-ink-2">{existing?.materialsSummary}</dd>
          </div>
          {existing?.notes ? (
            <div className="flex justify-between gap-4 py-1">
              <dt className="text-ink-4">Note to client</dt>
              <dd className="max-w-[60%] text-right italic text-ink-3">{existing.notes}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-brand bg-surface">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h3 className="text-[14px] font-semibold text-ink">
          {existing ? `Revise your quote (version ${existing.version + 1})` : "Send your quote"}
        </h3>
        {existing ? (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-[12.5px] text-ink-3 hover:text-ink"
          >
            Cancel
          </button>
        ) : null}
      </header>

      <div className="p-4">
        {/* Line items */}
        <div className="space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <input
                value={line.description}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((l, idx) => (idx === i ? { ...l, description: e.target.value } : l)),
                  )
                }
                placeholder="What this covers"
                className={cn(field, "col-span-12 sm:col-span-5")}
              />
              <input
                value={line.quantity}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((l, idx) =>
                      idx === i ? { ...l, quantity: e.target.value.replace(/[^0-9.]/g, "") } : l,
                    ),
                  )
                }
                placeholder="Qty"
                className={cn(field, "tnum col-span-3 sm:col-span-2")}
              />
              <input
                value={line.unit}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((l, idx) => (idx === i ? { ...l, unit: e.target.value } : l)),
                  )
                }
                placeholder="Unit"
                className={cn(field, "col-span-4 sm:col-span-2")}
              />
              <input
                value={line.rate}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((l, idx) =>
                      idx === i ? { ...l, rate: e.target.value.replace(/[^0-9.]/g, "") } : l,
                    ),
                  )
                }
                placeholder="Rate"
                className={cn(field, "tnum col-span-4 sm:col-span-2")}
              />
              <div className="col-span-1 flex items-center justify-end">
                {lines.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label="Remove line"
                    className="text-[16px] text-ink-4 hover:text-danger"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            setLines((prev) => [
              ...prev,
              { description: "", quantity: "1", unit: suggestedUnit, rate: "" },
            ])
          }
          className="mt-2 text-[12.5px] font-medium text-brand hover:underline"
        >
          + Add a line
        </button>

        {/* Totals */}
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 rounded-md bg-paper p-3">
          <label className="text-[11.5px] uppercase tracking-wider text-ink-4">
            GST %
            <input
              value={taxPercent}
              onChange={(e) => setTaxPercent(e.target.value.replace(/[^0-9.]/g, ""))}
              className={cn(field, "tnum mt-1 w-20")}
            />
          </label>
          <dl className="tnum text-right text-[12.5px]">
            <div className="flex justify-end gap-6">
              <dt className="text-ink-4">Subtotal</dt>
              <dd className="w-28 text-ink-2">{formatRupees(totals.subtotal)}</dd>
            </div>
            <div className="flex justify-end gap-6">
              <dt className="text-ink-4">GST</dt>
              <dd className="w-28 text-ink-2">{formatRupees(totals.tax)}</dd>
            </div>
            <div className="mt-1 flex justify-end gap-6 border-t border-line pt-1">
              <dt className="font-medium text-ink">Total</dt>
              <dd className="w-28 font-semibold text-ink">{formatRupees(totals.total)}</dd>
            </div>
          </dl>
        </div>

        {/* Terms — the columns the customer compares on */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-[11.5px] uppercase tracking-wider text-ink-4">
            Timeline (days)
            <input
              value={timelineDays}
              onChange={(e) => setTimelineDays(e.target.value.replace(/[^0-9]/g, ""))}
              className={cn(field, "tnum mt-1")}
            />
          </label>
          <label className="text-[11.5px] uppercase tracking-wider text-ink-4">
            Warranty (months)
            <input
              value={warrantyMonths}
              onChange={(e) => setWarrantyMonths(e.target.value.replace(/[^0-9]/g, ""))}
              className={cn(field, "tnum mt-1")}
            />
          </label>
          <label className="text-[11.5px] uppercase tracking-wider text-ink-4 sm:col-span-2">
            {materialsLabel}
            <input
              value={materials}
              onChange={(e) => setMaterials(e.target.value)}
              placeholder="Brands and grades you will actually use"
              className={cn(field, "mt-1")}
            />
          </label>
          <label className="text-[11.5px] uppercase tracking-wider text-ink-4 sm:col-span-2">
            Warranty details
            <input
              value={warrantyDetails}
              onChange={(e) => setWarrantyDetails(e.target.value)}
              placeholder="What the warranty actually covers"
              className={cn(field, "mt-1")}
            />
          </label>
          <label className="text-[11.5px] uppercase tracking-wider text-ink-4 sm:col-span-2">
            Note to the client (optional)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Anything that explains your price — work the others may have left out, for instance."
              className={cn(field, "mt-1")}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          <p className="max-w-md text-[11.5px] leading-relaxed text-ink-4">
            The customer sees this next to two other quotes, with timeline, warranty and materials
            in the same table. Itemised quotes win more often than a single figure.
          </p>
          <button
            type="button"
            disabled={pending || !valid}
            onClick={() =>
              startTransition(async () => {
                await submitQuoteAction({
                  leadDomainId,
                  lineItems: lines
                    .filter((l) => l.description.trim() && Number(l.rate) > 0)
                    .map((l) => ({
                      description: l.description.trim(),
                      quantity: Number(l.quantity) || 1,
                      unit: l.unit.trim() || suggestedUnit,
                      rate: Number(l.rate) || 0,
                    })),
                  taxPercent: Number(taxPercent) || 0,
                  timelineDays: Number(timelineDays) || 0,
                  warrantyMonths: Number(warrantyMonths) || 0,
                  warrantyDetails: warrantyDetails.trim(),
                  materialsSummary: materials.trim(),
                  notes: notes.trim() || null,
                });
                setOpen(false);
              })
            }
            className="rounded-full bg-brand px-5 py-2 text-[13px] font-medium text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {pending ? "Sending…" : existing ? "Send revised quote" : "Send quote"}
          </button>
        </div>
      </div>
    </div>
  );
}
