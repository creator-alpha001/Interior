"use client";

import { useState, useTransition } from "react";
import type { Domain, DomainApprovalStatus, ProfessionalDomain, VerificationStatus } from "@repo/types";
import { Badge, cn } from "@repo/ui";
import {
  setCommissionOverrideAction,
  setVendorDomainStatusAction,
  setVendorStatusAction,
} from "@/app/actions";

export function VendorStatusControl({
  professionalId,
  status,
}: {
  professionalId: string;
  status: VerificationStatus;
}) {
  const [pending, startTransition] = useTransition();

  const options: Array<{ value: VerificationStatus; label: string }> = [
    { value: "verified", label: "Verified" },
    { value: "pending", label: "Pending" },
    { value: "suspended", label: "Suspend" },
    { value: "blacklisted", label: "Blacklist" },
  ];

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={pending || option.value === status}
          onClick={() =>
            startTransition(async () => setVendorStatusAction(professionalId, option.value))
          }
          className={cn(
            "rounded-md px-2.5 py-1 text-[12.5px] transition-colors disabled:cursor-default",
            option.value === status
              ? "bg-brand text-white"
              : option.value === "suspended" || option.value === "blacklisted"
                ? "bg-danger-soft text-danger hover:brightness-95"
                : "bg-surface-2 text-ink-2 hover:text-ink",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Trade approval is a separate decision from account verification: a legitimate
 * fabricator is not automatically a painter. Requests land here as "pending"
 * and stay there until someone actually checks.
 */
export function VendorDomainRow({
  professionalId,
  link,
  domain,
}: {
  professionalId: string;
  link: ProfessionalDomain;
  domain: Domain;
}) {
  const [pending, startTransition] = useTransition();
  const [override, setOverride] = useState(
    link.commissionPercentOverride !== null ? String(link.commissionPercentOverride) : "",
  );

  const setStatus = (status: DomainApprovalStatus) =>
    startTransition(async () => setVendorDomainStatusAction(professionalId, domain.id, status));

  return (
    <div className="rounded-md border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13.5px] font-medium text-ink">{domain.name}</span>
          <Badge
            tone={
              link.verificationStatus === "approved"
                ? "positive"
                : link.verificationStatus === "pending"
                  ? "warning"
                  : "neutral"
            }
          >
            {link.verificationStatus}
          </Badge>
          {link.verificationStatus === "approved" ? (
            <span className="text-[12px] text-ink-4">
              {link.avgRating.toFixed(1)}★ · {link.ratingCount} reviews · {link.completedProjects}{" "}
              projects
            </span>
          ) : null}
        </div>

        <div className="flex gap-1.5">
          {link.verificationStatus !== "approved" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => setStatus("approved")}
              className="rounded-md bg-brand px-2.5 py-1 text-[12px] font-medium text-white hover:bg-brand-hover disabled:opacity-50"
            >
              Approve
            </button>
          ) : null}
          {link.verificationStatus !== "rejected" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => setStatus("rejected")}
              className="rounded-md bg-surface-2 px-2.5 py-1 text-[12px] text-ink-2 hover:text-ink disabled:opacity-50"
            >
              {link.verificationStatus === "approved" ? "Revoke" : "Reject"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-line pt-2.5">
        <span className="text-[11.5px] text-ink-4">
          Commission — domain default {domain.defaultCommissionPercent}%
        </span>
        <input
          value={override}
          onChange={(e) => setOverride(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="override"
          className="w-20 rounded-md border border-line bg-paper px-2 py-1 text-[12.5px] outline-none focus:border-brand"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () =>
              setCommissionOverrideAction(
                professionalId,
                domain.id,
                override.trim() === "" ? null : Number(override),
              ),
            )
          }
          className="rounded-md bg-surface-2 px-2.5 py-1 text-[12px] text-ink-2 hover:text-ink disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save rate"}
        </button>
        {link.commissionPercentOverride !== null ? (
          <Badge tone="clay">Overridden at {link.commissionPercentOverride}%</Badge>
        ) : null}
      </div>
    </div>
  );
}
