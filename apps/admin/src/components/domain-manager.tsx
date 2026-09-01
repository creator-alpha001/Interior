"use client";

import { useState, useTransition } from "react";
import type { Domain } from "@repo/types";
import { Badge, cn } from "@repo/ui";
import { createDomainAction, updateDomainAction } from "@/app/actions";

export interface DomainUsage {
  vendors: number;
  liveLeads: number;
  products: number;
  packages: number;
  projects: number;
}

/**
 * Adding a trade is configuration, not a release. Everything downstream —
 * leads, quotes, agreements, projects, invoices, reports — already reads
 * domainId, so a domain created here is usable across the platform immediately.
 *
 * The labels matter more than they look: they are what let one reusable
 * compare-quotes table speak each trade's language.
 */
export function DomainManager({
  domains,
  usage,
}: {
  domains: Domain[];
  usage: Record<string, DomainUsage>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-3">
      {domains.map((domain) => {
        const use = usage[domain.id];
        return (
          <div
            key={domain.id}
            className={cn(
              "rounded-lg border bg-surface",
              domain.isActive ? "border-line" : "border-dashed border-line-strong opacity-70",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[15px] font-semibold text-ink">{domain.name}</h3>
                  <Badge tone="brand">{domain.defaultCommissionPercent}% commission</Badge>
                  {!domain.isActive ? <Badge tone="neutral">Inactive</Badge> : null}
                </div>
                <p className="mt-1 text-[12.5px] text-ink-3">{domain.tagline}</p>
                <p className="mt-1.5 font-mono text-[11px] text-ink-4">/{domain.slug}</p>
              </div>

              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditing(editing === domain.id ? null : domain.id)}
                  className="rounded-md bg-surface-2 px-2.5 py-1 text-[12px] text-ink-2 hover:text-ink"
                >
                  {editing === domain.id ? "Close" : "Edit"}
                </button>
                <ToggleActive domain={domain} usage={use} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-5">
              {[
                ["Vendors", use?.vendors ?? 0],
                ["Live leads", use?.liveLeads ?? 0],
                ["Products", use?.products ?? 0],
                ["Packages", use?.packages ?? 0],
                ["Projects", use?.projects ?? 0],
              ].map(([label, value]) => (
                <div key={String(label)} className="bg-surface px-3 py-2">
                  <div className="text-[10.5px] uppercase tracking-wider text-ink-4">{label}</div>
                  <div className="tnum text-[14px] font-semibold text-ink">{value}</div>
                </div>
              ))}
            </div>

            {editing === domain.id ? <DomainForm domain={domain} onDone={() => setEditing(null)} /> : null}
          </div>
        );
      })}

      {creating ? (
        <div className="rounded-lg border border-brand bg-surface">
          <div className="border-b border-line px-4 py-3">
            <h3 className="text-[15px] font-semibold text-ink">Add a trade</h3>
            <p className="mt-1 text-[12px] text-ink-3">
              Electrical, plumbing, modular kitchen, false ceiling — anything the business is ready
              to take leads for. No engineering work required.
            </p>
          </div>
          <DomainForm onDone={() => setCreating(false)} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="w-full rounded-lg border border-dashed border-line-strong py-4 text-[13px] font-medium text-brand transition-colors hover:border-brand hover:bg-brand-soft"
        >
          + Add a new trade
        </button>
      )}
    </div>
  );
}

function ToggleActive({ domain, usage }: { domain: Domain; usage?: DomainUsage }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const blocking = usage?.liveLeads ?? 0;

  if (confirming && domain.isActive) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[11.5px] text-ink-3">
          {blocking > 0 ? `${blocking} live leads — deactivate anyway?` : "Deactivate?"}
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await updateDomainAction(domain.id, { isActive: false });
              setConfirming(false);
            })
          }
          className="rounded-md bg-danger-soft px-2.5 py-1 text-[12px] text-danger"
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-md px-2 py-1 text-[12px] text-ink-3"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (domain.isActive) setConfirming(true);
        else startTransition(async () => updateDomainAction(domain.id, { isActive: true }));
      }}
      className="rounded-md bg-surface-2 px-2.5 py-1 text-[12px] text-ink-2 hover:text-ink disabled:opacity-50"
    >
      {domain.isActive ? "Deactivate" : "Activate"}
    </button>
  );
}

function DomainForm({ domain, onDone }: { domain?: Domain; onDone: () => void }) {
  const [name, setName] = useState(domain?.name ?? "");
  const [tagline, setTagline] = useState(domain?.tagline ?? "");
  const [description, setDescription] = useState(domain?.description ?? "");
  const [commission, setCommission] = useState(String(domain?.defaultCommissionPercent ?? 8));
  const [materials, setMaterials] = useState(domain?.labels.materials ?? "");
  const [warranty, setWarranty] = useState(domain?.labels.warranty ?? "Warranty");
  const [basis, setBasis] = useState(domain?.labels.pricingBasis ?? "");
  const [pending, startTransition] = useTransition();

  const field =
    "mt-1 w-full rounded-md border border-line bg-paper px-2.5 py-1.5 text-[13px] outline-none placeholder:text-ink-4 focus:border-brand";
  const label = "text-[11.5px] uppercase tracking-wider text-ink-4";

  const valid = name.trim().length > 1 && tagline.trim().length > 3 && basis.trim().length > 3;

  return (
    <div className="border-t border-line bg-paper p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="Electrical Work" />
        </label>
        <label className={label}>
          Default commission %
          <input
            value={commission}
            onChange={(e) => setCommission(e.target.value.replace(/[^0-9.]/g, ""))}
            className={field}
          />
        </label>
        <label className={cn(label, "sm:col-span-2")}>
          Tagline
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className={field}
            placeholder="Wiring, fittings and switchboards"
          />
        </label>
        <label className={cn(label, "sm:col-span-2")}>
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={field}
          />
        </label>
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <p className="text-[11.5px] uppercase tracking-wider text-ink-4">
          Quote table labels
        </p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">
          One comparison table serves every trade; only these captions change. Getting them right is
          what makes a quote readable to the customer.
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <label className={label}>
            Materials column
            <input
              value={materials}
              onChange={(e) => setMaterials(e.target.value)}
              className={field}
              placeholder="Wire & Switch Brand"
            />
          </label>
          <label className={label}>
            Warranty column
            <input value={warranty} onChange={(e) => setWarranty(e.target.value)} className={field} />
          </label>
          <label className={label}>
            Pricing basis
            <input
              value={basis}
              onChange={(e) => setBasis(e.target.value)}
              className={field}
              placeholder="Priced per point or per running ft"
            />
          </label>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button type="button" onClick={onDone} className="rounded-md px-3 py-1.5 text-[12.5px] text-ink-3">
          Cancel
        </button>
        <button
          type="button"
          disabled={pending || !valid}
          onClick={() =>
            startTransition(async () => {
              const payload = {
                name: name.trim(),
                tagline: tagline.trim(),
                description: description.trim() || tagline.trim(),
                defaultCommissionPercent: Number(commission) || 8,
                materialsLabel: materials.trim() || "Materials",
                warrantyLabel: warranty.trim() || "Warranty",
                pricingBasis: basis.trim(),
              };
              if (domain) await updateDomainAction(domain.id, payload);
              else await createDomainAction(payload);
              onDone();
            })
          }
          className="rounded-full bg-brand px-4 py-1.5 text-[12.5px] font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {pending ? "Saving…" : domain ? "Save changes" : "Create trade"}
        </button>
      </div>
    </div>
  );
}
