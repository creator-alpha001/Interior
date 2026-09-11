"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Domain, VendorShowcase } from "@repo/types";
import { Badge, formatDate } from "@repo/ui";
import { reviewAchievementAction, reviewPortfolioItemAction } from "@/app/actions";
import { Decide } from "@/components/vendor-verification";

const STATUS = {
  pending: { label: "Awaiting approval", tone: "warning" },
  approved: { label: "Live", tone: "positive" },
  rejected: { label: "Not published", tone: "neutral" },
} as const;

const KIND = {
  award: "Award",
  certification: "Certification",
  membership: "Membership",
  press: "Press",
  other: "Other",
} as const;

const order = { pending: 0, approved: 1, rejected: 2 } as const;

/**
 * What a vendor has posted to their profile, and the decision on each.
 *
 * Pending first, because that is the work. Approved items can be taken down
 * with a reason — something that turns out not to be the vendor's own work has
 * to come off a public profile without a separate path.
 */
export function VendorShowcaseReview({
  professionalId,
  showcase,
  domains,
}: {
  professionalId: string;
  showcase: VendorShowcase;
  domains: Domain[];
}) {
  const portfolio = [...showcase.portfolio].sort(
    (a, b) => order[a.moderationStatus] - order[b.moderationStatus],
  );
  const achievements = [...showcase.achievements].sort(
    (a, b) => order[a.moderationStatus] - order[b.moderationStatus],
  );
  const waiting =
    portfolio.filter((p) => p.moderationStatus === "pending").length +
    achievements.filter((a) => a.moderationStatus === "pending").length;

  return (
    <div className="rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="text-[14px] font-semibold text-ink">Work and achievements</h2>
        {waiting > 0 ? (
          <Badge tone="warning">{waiting} awaiting approval</Badge>
        ) : (
          <span className="text-[12px] text-ink-4">Nothing waiting</span>
        )}
      </div>

      <div className="px-4 py-3">
        <h3 className="text-[12px] font-semibold uppercase tracking-wider text-ink-3">
          Work ({portfolio.length})
        </h3>
        {portfolio.length === 0 ? (
          <p className="mt-1.5 text-[13px] text-ink-3">Nothing posted.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {portfolio.map((item) => (
              <li key={item.id} className="py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={STATUS[item.moderationStatus].tone}>
                    {STATUS[item.moderationStatus].label}
                  </Badge>
                  <Badge tone="neutral">
                    {domains.find((d) => d.id === item.domainId)?.name ?? "Trade"}
                  </Badge>
                  <span className="text-[11.5px] text-ink-4">Posted {formatDate(item.createdAt)}</span>
                </div>
                <p className="mt-1.5 text-[13.5px] font-medium text-ink">{item.title}</p>
                {item.description ? (
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-3">{item.description}</p>
                ) : null}
                {item.media.length > 0 ? (
                  <div className="mt-2 flex gap-2 overflow-x-auto">
                    {item.media.map((photo) => (
                      <a
                        key={photo.id}
                        href={photo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="h-20 w-24 shrink-0 overflow-hidden rounded-md border border-line"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.url} alt={item.title} className="h-full w-full object-cover" />
                      </a>
                    ))}
                  </div>
                ) : null}
                {item.reviewNote ? (
                  <p className="mt-1.5 text-[12px] text-ink-3">Note to vendor: {item.reviewNote}</p>
                ) : null}
                {item.moderationStatus === "pending" ? (
                  <Decide
                    what="this work"
                    hint="Check it is the vendor's own finished work, in the trade shown, with nothing identifying the customer's home."
                    onDecide={(decision, note) =>
                      reviewPortfolioItemAction(professionalId, item.id, decision, note)
                    }
                  />
                ) : item.moderationStatus === "approved" ? (
                  <TakeDown
                    what="this work"
                    onTakeDown={(note) =>
                      reviewPortfolioItemAction(professionalId, item.id, "reject", note)
                    }
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-line px-4 py-3">
        <h3 className="text-[12px] font-semibold uppercase tracking-wider text-ink-3">
          Achievements ({achievements.length})
        </h3>
        {achievements.length === 0 ? (
          <p className="mt-1.5 text-[13px] text-ink-3">Nothing posted.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {achievements.map((item) => (
              <li key={item.id} className="py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={STATUS[item.moderationStatus].tone}>
                    {STATUS[item.moderationStatus].label}
                  </Badge>
                  <Badge tone="neutral">{KIND[item.kind]}</Badge>
                </div>
                <p className="mt-1.5 text-[13.5px] font-medium text-ink">{item.title}</p>
                <p className="text-[12.5px] text-ink-3">
                  {[item.issuer, item.year].filter(Boolean).join(" · ") || "No issuer or year given"}
                </p>
                {item.description ? (
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-3">{item.description}</p>
                ) : null}
                {item.media[0] ? (
                  <a
                    href={item.media[0].url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-block text-[12px] font-medium text-brand"
                  >
                    View certificate photo ↗
                  </a>
                ) : null}
                {item.reviewNote ? (
                  <p className="mt-1.5 text-[12px] text-ink-3">Note to vendor: {item.reviewNote}</p>
                ) : null}
                {item.moderationStatus === "pending" ? (
                  <Decide
                    what="this achievement"
                    hint="Check the certificate or award is real and in this business's or signatory's name."
                    onDecide={(decision, note) =>
                      reviewAchievementAction(professionalId, item.id, decision, note)
                    }
                  />
                ) : item.moderationStatus === "approved" ? (
                  <TakeDown
                    what="this achievement"
                    onTakeDown={(note) => reviewAchievementAction(professionalId, item.id, "reject", note)}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Removing something already public, with a reason the vendor reads. */
function TakeDown({
  what,
  onTakeDown,
}: {
  what: string;
  onTakeDown: (note: string) => Promise<{ error?: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-[12px] text-ink-4 hover:text-danger"
      >
        Take down
      </button>
    );
  }

  return (
    <div className="mt-2">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        autoFocus
        placeholder={`Why is ${what} coming down? The vendor reads this.`}
        className="w-full rounded-md border border-line bg-paper px-3 py-2 text-[12.5px] outline-none focus:border-brand"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending || note.trim().length < 10}
          onClick={() =>
            startTransition(async () => {
              setError(undefined);
              const result = await onTakeDown(note.trim());
              if (result.error) {
                setError(result.error);
                return;
              }
              setOpen(false);
              setNote("");
              router.refresh();
            })
          }
          className="rounded-md bg-danger-soft px-3 py-1.5 text-[12.5px] font-medium text-danger hover:brightness-95 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Take down"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setOpen(false)}
          className="rounded-md px-2.5 py-1.5 text-[12.5px] text-ink-3 hover:text-ink"
        >
          Cancel
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-[12px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
