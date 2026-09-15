"use client";

import { useState, useTransition } from "react";
import { Button } from "@repo/ui";
import { setPasswordAction } from "@/app/(site)/login/actions";

export function SetPasswordForm({ next }: { next?: string }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (pending) return;
    if (password.length < 12) {
      setError("Use at least 12 characters for your password.");
      return;
    }
    if (password !== confirmation) {
      setError("Those passwords do not match.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await setPasswordAction(password, next);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-6 sm:p-8">
      <label htmlFor="new-password" className="block text-[14px] font-medium text-ink">
        Create password
      </label>
      <input
        id="new-password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="new-password"
        className="mt-2 h-12 w-full rounded-lg border border-line bg-paper px-3.5 text-[15px] outline-none focus:border-brand"
      />

      <label htmlFor="confirm-new-password" className="mt-4 block text-[14px] font-medium text-ink">
        Confirm password
      </label>
      <input
        id="confirm-new-password"
        type="password"
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && submit()}
        autoComplete="new-password"
        className="mt-2 h-12 w-full rounded-lg border border-line bg-paper px-3.5 text-[15px] outline-none focus:border-brand"
      />
      <p className="mt-2 text-[12.5px] text-ink-4">Use at least 12 characters.</p>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-3 py-2.5 text-[13.5px] text-danger">
          {error}
        </p>
      ) : null}

      <Button onClick={submit} disabled={pending} size="lg" className="mt-5 w-full">
        {pending ? "Saving…" : "Save password and continue"}
      </Button>
    </div>
  );
}
