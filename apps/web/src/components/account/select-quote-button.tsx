"use client";

import { useTransition } from "react";
import { selectQuoteAction } from "@/app/actions";
import { Button } from "@repo/ui";

export function SelectQuoteButton({
  leadDomainId,
  quoteId,
  leadId,
  label = "Choose this professional",
  variant = "primary",
  size = "sm",
}: {
  leadDomainId: string;
  quoteId: string;
  leadId: string;
  label?: string;
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={variant}
      size={size}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await selectQuoteAction(leadDomainId, quoteId, leadId);
        })
      }
    >
      {pending ? "Saving…" : label}
    </Button>
  );
}
