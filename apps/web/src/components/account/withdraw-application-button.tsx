"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui";
import { withdrawApplicationAction } from "@/app/(site)/account/become-a-professional/actions";

/**
 * Withdrawing an application, with one confirmation step.
 *
 * The confirmation is not ceremony: the button sits next to a screen somebody
 * is reading because they are waiting, and a single mis-tap that silently
 * removes them from the queue is the one mistake here that cannot be undone by
 * pressing back.
 */
export function WithdrawApplicationButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
        Withdraw application
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {error ? (
        <span role="alert" className="text-[13px] text-danger">
          {error}
        </span>
      ) : (
        <span className="text-[13px] text-ink-3">Withdraw it?</span>
      )}
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await withdrawApplicationAction();
            if (result.error) {
              setError(result.error);
              return;
            }
            router.refresh();
          })
        }
      >
        {pending ? "Withdrawing…" : "Yes, withdraw"}
      </Button>
      <Button variant="secondary" size="sm" disabled={pending} onClick={() => setConfirming(false)}>
        Keep it
      </Button>
    </div>
  );
}
