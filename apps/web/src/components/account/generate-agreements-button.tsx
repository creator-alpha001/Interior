"use client";

import { useTransition } from "react";
import { generateAgreementsAction } from "@/app/actions";
import { Button } from "@repo/ui";

export function GenerateAgreementsButton({ leadId }: { leadId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="text-right">
      <Button
        size="md"
        disabled={pending}
        onClick={() => startTransition(async () => generateAgreementsAction(leadId))}
      >
        {pending ? "Generating…" : "Generate agreements"}
      </Button>
      <p className="mt-2 max-w-[240px] text-[13px] sm:text-[12px] leading-relaxed text-ink-4">
        One agreement per professional. A professional covering two services gets a single combined
        contract.
      </p>
    </div>
  );
}
