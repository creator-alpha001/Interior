"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Domain, ProfessionalApplication } from "@repo/types";
import { Badge, cn } from "@repo/ui";
import { decideApplicationAction } from "@/app/actions";

/**
 * The decision itself.
 *
 * Approving is destructive in the sense that matters: it creates a vendor and
 * moves somebody's account across, and there is no button anywhere that undoes
 * it. So approval is two presses — pick the trades, then confirm — while
 * asking for changes is one, because that is reversible by definition.
 */
export function ApplicationReview({
  application,
  requestedDomains,
}: {
  application: ProfessionalApplication;
  requestedDomains: Domain[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [mode, setMode] = useState<"idle" | "approve" | "changes" | "reject">("idle");
  const [note, setNote] = useState("");
  const [granted, setGranted] = useState<string[]>(requestedDomains.map((d) => d.id));

  const decided = application.status === "approved" || application.status === "rejected";

  function run(decision: Parameters<typeof decideApplicationAction>[1]) {
    setError(undefined);
    startTransition(async () => {
      const result = await decideApplicationAction(application.id, decision);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMode("idle");
      setNote("");
      router.refresh();
    });
  }

  if (decided) {
    return (
      <div className="rounded-lg border border-line bg-surface p-4">
        <div className="flex items-center gap-2">
          <Badge tone={application.status === "approved" ? "positive" : "neutral"}>
            {application.status === "approved" ? "Approved" : "Rejected"}
          </Badge>
          <span className="text-[12.5px] text-ink-3">
            This application has been decided and cannot be decided again.
          </span>
        </div>
        {application.reviewerNote ? (
          <p className="mt-3 border-t border-line pt-3 text-[13px] leading-relaxed text-ink-2">
            {application.reviewerNote}
          </p>
        ) : null}
        {application.status === "approved" && application.professionalId ? (
          <p className="mt-3 text-[12.5px] text-ink-4">
            Manage them from{" "}
            <a
              href={`/vendors/${application.professionalId}`}
              className="font-medium text-brand"
            >
              their vendor record
            </a>
            .
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-semibold text-ink">Decide</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-3">
            Approving creates the vendor, approves the trades you pick, and moves this account to
            the professional portal.
          </p>
        </div>

        {application.status === "submitted" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run({ action: "start_review" })}
            className="rounded-md bg-surface-2 px-2.5 py-1 text-[12px] text-ink-2 transition-colors hover:text-ink disabled:opacity-50"
          >
            Mark as being reviewed
          </button>
        ) : null}
      </div>

      {mode === "idle" ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
          <button
            type="button"
            disabled={pending}
            onClick={() => setMode("approve")}
            className="rounded-md bg-brand px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setMode("changes")}
            className="rounded-md bg-surface-2 px-3 py-1.5 text-[12.5px] text-ink-2 transition-colors hover:text-ink disabled:opacity-50"
          >
            Ask for changes
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setMode("reject")}
            className="rounded-md bg-danger-soft px-3 py-1.5 text-[12.5px] text-danger transition-colors hover:brightness-95 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      ) : null}

      {mode === "approve" ? (
        <div className="mt-4 border-t border-line pt-4">
          <span className="text-[12.5px] font-medium text-ink">Approve for which trades?</span>
          <p className="mt-0.5 text-[12px] text-ink-4">
            Only the ones they asked for. Anything left unticked can be approved later from their
            vendor record.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {requestedDomains.map((domain) => {
              const on = granted.includes(domain.id);
              return (
                <button
                  key={domain.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setGranted((list) =>
                      on ? list.filter((x) => x !== domain.id) : [...list, domain.id],
                    )
                  }
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[12.5px] transition-colors",
                    on ? "bg-brand text-white" : "bg-surface-2 text-ink-3 hover:text-ink",
                  )}
                >
                  {domain.name}
                </button>
              );
            })}
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Optional note the applicant will see on their account."
            className="mt-3 w-full rounded-md border border-line bg-paper px-3 py-2 text-[12.5px] outline-none focus:border-brand"
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending || granted.length === 0}
              onClick={() =>
                run({
                  action: "approve",
                  note: note.trim() || undefined,
                  approvedDomainIds: granted,
                })
              }
              className="rounded-md bg-brand px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              {pending
                ? "Approving…"
                : `Approve for ${granted.length} ${granted.length === 1 ? "trade" : "trades"}`}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setMode("idle")}
              className="rounded-md px-2.5 py-1.5 text-[12.5px] text-ink-3 hover:text-ink"
            >
              Cancel
            </button>
            {granted.length === 0 ? (
              <span className="text-[12px] text-ink-4">
                A vendor approved for nothing is in no lead pool — reject instead.
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {mode === "changes" || mode === "reject" ? (
        <div className="mt-4 border-t border-line pt-4">
          <span className="text-[12.5px] font-medium text-ink">
            {mode === "reject" ? "Why are we refusing?" : "What needs to change?"}
          </span>
          <p className="mt-0.5 text-[12px] text-ink-4">
            The applicant reads this on their account, so write it to them.
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            autoFocus
            placeholder={
              mode === "reject"
                ? "e.g. We are not taking on new fabricators in Lucknow this quarter. Do apply again after March."
                : "e.g. Please add your GST number, and tell us which localities in south Bengaluru you cover."
            }
            className="mt-2 w-full rounded-md border border-line bg-paper px-3 py-2 text-[12.5px] outline-none focus:border-brand"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending || note.trim().length < 10}
              onClick={() =>
                run(
                  mode === "reject"
                    ? { action: "reject", note: note.trim() }
                    : { action: "request_changes", note: note.trim() },
                )
              }
              className={cn(
                "rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-50",
                mode === "reject"
                  ? "bg-danger-soft text-danger hover:brightness-95"
                  : "bg-brand text-white hover:bg-brand-hover",
              )}
            >
              {pending ? "Saving…" : mode === "reject" ? "Reject application" : "Send back"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setMode("idle")}
              className="rounded-md px-2.5 py-1.5 text-[12.5px] text-ink-3 hover:text-ink"
            >
              Cancel
            </button>
            {note.trim().length < 10 ? (
              <span className="text-[12px] text-ink-4">A sentence at least.</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-[12.5px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
