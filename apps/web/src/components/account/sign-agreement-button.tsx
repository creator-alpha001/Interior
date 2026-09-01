"use client";

import { useState, useTransition } from "react";
import { signAgreementAction } from "@/app/actions";
import { Button } from "@repo/ui";

/**
 * Signing starts the projects under the agreement — one per service it covers,
 * because they run and finish independently even under one contract.
 */
export function SignAgreementButton({
  agreementId,
  reference,
  professionalName,
  value,
  services,
}: {
  agreementId: string;
  reference: string;
  professionalName: string;
  value: string;
  services: string[];
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button size="sm" onClick={() => setConfirming(true)}>
        Review and sign
      </Button>
    );
  }

  return (
    <div className="w-full rounded-lg border border-brand-line bg-brand-soft p-5">
      <h4 className="font-display text-[19px] text-ink">Sign {reference}?</h4>
      <p className="mt-2 text-[14.5px] sm:text-[13.5px] leading-relaxed text-ink-2">
        You are agreeing to {value} with {professionalName}, covering{" "}
        {services.join(" and ").toLowerCase()}. Work begins once signed, and{" "}
        {services.length > 1
          ? "each service is tracked as its own project"
          : "the project is tracked through to handover"}
        .
      </p>
      <p className="mt-2 text-[13px] sm:text-[12px] leading-relaxed text-ink-3">
        Payments are made directly to the professional on the terms in this agreement. Aangan
        records the terms and tracks the work but does not hold your money.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => startTransition(async () => signAgreementAction(agreementId))}
        >
          {pending ? "Signing…" : "Confirm and sign"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
          Not yet
        </Button>
      </div>
    </div>
  );
}
