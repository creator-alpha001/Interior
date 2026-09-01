"use client";

import { useState } from "react";
import { Button } from "@repo/ui";

export function ReferralShare({
  code,
  shareUrl,
  reward,
}: {
  code: string;
  shareUrl: string;
  reward: number;
}) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  async function copy(value: string, which: "code" | "link") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard can be blocked; the value is visible on screen either way.
    }
  }

  const message = `I used Aangan to get three quotes for work on my home — interiors, furniture, fabrication and painting. Use my code ${code} and we both get ₹${reward}. ${shareUrl}`;

  return (
    <div className="overflow-hidden rounded-xl border border-brand-line bg-brand-soft">
      <div className="p-6 sm:p-8">
        <p className="text-[12px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">
          Refer a friend
        </p>
        <h2 className="mt-2 font-display text-[26px] text-ink sm:text-[30px]">
          You both get ₹{reward.toLocaleString("en-IN")}
        </h2>
        <p className="mt-2 max-w-lg text-[15px] sm:text-[14px] leading-relaxed text-ink-2">
          When someone you refer starts their first project, the reward lands for both of you.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 items-center justify-between gap-3 rounded-lg border border-brand-line bg-surface px-4 py-3">
            <div>
              <div className="text-[12px] sm:text-[11px] uppercase tracking-wider text-ink-4">Your code</div>
              <div className="font-mono text-[19px] font-semibold tracking-wider text-ink">
                {code}
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => copy(code, "code")}>
              {copied === "code" ? "Copied" : "Copy"}
            </Button>
          </div>

          <div className="flex flex-1 items-center justify-between gap-3 rounded-lg border border-brand-line bg-surface px-4 py-3">
            <div className="min-w-0">
              <div className="text-[12px] sm:text-[11px] uppercase tracking-wider text-ink-4">Share link</div>
              <div className="truncate text-[14px] sm:text-[13px] text-ink-2">{shareUrl}</div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => copy(shareUrl, "link")}>
              {copied === "link" ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center rounded-full bg-brand px-4 text-[14px] sm:text-[13px] font-medium text-white transition-colors hover:bg-brand-hover"
          >
            Share on WhatsApp
          </a>
          <Button variant="secondary" size="sm" onClick={() => copy(message, "link")}>
            Copy message
          </Button>
        </div>
      </div>
    </div>
  );
}
