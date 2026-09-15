"use client";

import Link from "next/link";
import type { VendorVerification } from "@repo/types";
import { Badge, cn, formatDate } from "@repo/ui";

/** Where the verification steps live. */
export const VERIFICATION_HREF = "/partner/onboarding";

/**
 * Where a vendor stands, in the terms they need.
 *
 * Two questions, answered from the record rather than the status alone: are
 * they receiving leads, and is there something for them to do? A vendor whose
 * The first-step online agreement and required identity documents are the
 * completion rule. Paper copies can still be collected in the portal, but they
 * do not block the verified badge or lead eligibility.
 */
type Standing =
  | { kind: "verified" }
  | { kind: "closed"; status: "suspended" | "blacklisted" }
  /** Not receiving leads yet, something to do. */
  | { kind: "action"; steps: string[]; waiting: string[] }
  /** Not receiving leads yet, everything is with our team. */
  | { kind: "waiting"; waiting: string[] }
  /** Retained for backwards-compatible rendering of old API responses. */
  | { kind: "due"; dueBy: string; steps: string[] }
  /** Retained for backwards-compatible rendering of old API responses. */
  | { kind: "paused"; dueBy: string | null; steps: string[] }
  /** Retained for backwards-compatible rendering of old API responses. */
  | { kind: "active"; steps: string[]; waiting: string[] }
  | { kind: "ready" }
  /** Retained for backwards-compatible rendering of old API responses. */
  | { kind: "paperwork"; steps: string[] };

export function standingOf(verification: VendorVerification): Standing {
  const { agreement, terms } = verification;

  if (verification.verificationStatus === "suspended" || verification.verificationStatus === "blacklisted") {
    return { kind: "closed", status: verification.verificationStatus };
  }

  const steps: string[] = [];
  const waiting: string[] = [];
  const documentSteps: string[] = [];

  if (agreement?.status !== "signed" || agreement.termsVersion !== terms.version) {
    steps.push("accept the partner terms");
  }

  for (const slot of verification.documents) {
    if (!slot.required) continue;
    const label = slot.label.charAt(0).toLowerCase() + slot.label.slice(1);
    switch (slot.document?.status) {
      case "accepted":
        break;
      case "submitted":
        waiting.push(`our team is checking your ${label}`);
        break;
      case "rejected": {
        const step = `upload your ${label} again, as it was sent back`;
        steps.push(step);
        documentSteps.push(step);
        break;
      }
      default: {
        const step = `upload your ${label}`;
        steps.push(step);
        documentSteps.push(step);
      }
    }
  }

  if (verification.verificationStatus === "verified") {
    return steps.length > 0 ? { kind: "paperwork", steps } : { kind: "verified" };
  }

  if (steps.length > 0) return { kind: "action", steps, waiting };
  if (waiting.length > 0) return { kind: "waiting", waiting };
  return { kind: "ready" };
}

/** The account's status, in the header of every portal screen. */
export function VerificationPill({ verification }: { verification: VendorVerification }) {
  const standing = standingOf(verification);
  const pill =
    standing.kind === "verified" || standing.kind === "paperwork"
      ? ({ label: "Verified", tone: "positive" } as const)
      : standing.kind === "closed"
        ? ({ label: standing.status === "blacklisted" ? "Deactivated" : "Suspended", tone: "danger" } as const)
        : standing.kind === "paused"
          ? ({ label: "Leads paused", tone: "danger" } as const)
          : standing.kind === "due" || standing.kind === "active" || standing.kind === "ready"
            ? ({ label: "Receiving leads", tone: "brand" } as const)
            : ({ label: "Verification pending", tone: "warning" } as const);

  return (
    <Link href={VERIFICATION_HREF} className="shrink-0" title="Your verification status">
      <Badge tone={pill.tone}>{pill.label}</Badge>
    </Link>
  );
}

/**
 * What a vendor sees across the top of every portal screen until they are
 * verified.
 *
 * Every screen, because the one a vendor lands on is Home and the one they
 * return to is Leads, and a status that lived only on the setup page was a
 * status nobody saw.
 */
export function VerificationBanner({ verification }: { verification: VendorVerification }) {
  const standing = standingOf(verification);
  if (standing.kind === "verified") return null;

  const content = describe(standing);

  return (
    <div className={cn("border-b px-4 py-3", content.frame)}>
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className={cn("text-[13.5px] font-semibold", content.accent)}>{content.title}</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{content.body}</p>
        </div>
        {content.cta ? (
          <Link
            href={VERIFICATION_HREF}
            className="shrink-0 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
          >
            {content.cta}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function more(count: number, noun: string): string {
  return count > 0 ? ` After that, ${count} more ${count === 1 ? noun : `${noun}s`}.` : "";
}

function describe(standing: Exclude<Standing, { kind: "verified" }>): {
  title: string;
  body: string;
  cta: string | null;
  frame: string;
  accent: string;
} {
  switch (standing.kind) {
    case "closed":
      return {
        title:
          standing.status === "blacklisted"
            ? "Your account has been deactivated"
            : "Your account is suspended",
        body: "You are not receiving leads. Please contact our team if you think this is a mistake.",
        cta: null,
        frame: "border-danger/30 bg-danger-soft",
        accent: "text-danger",
      };

    case "action":
      return {
        title: "You are not receiving leads yet",
        body: `Leads start after verification. Next, ${standing.steps[0]}.${more(
          standing.steps.length - 1,
          "step",
        )}`,
        cta: "Complete verification",
        frame: "border-warning/30 bg-warning-soft",
        accent: "text-warning",
      };

    case "waiting": {
      const first = standing.waiting[0]!;
      return {
        title: "Nothing for you to do right now",
        body: `${first.charAt(0).toUpperCase()}${first.slice(1)}. Leads start after all required documents are submitted.`,
        cta: "See progress",
        frame: "border-brand-line bg-brand-soft",
        accent: "text-brand",
      };
    }

    case "due":
      return {
        title: `You are receiving leads. Send your ID documents by ${formatDate(standing.dueBy)}`,
        body: `Next, ${standing.steps[0] ?? "upload your documents"}.${more(
          standing.steps.length - 1,
          "document",
        )} If they are not all sent by then, new leads pause until they are.`,
        cta: "Upload documents",
        frame: "border-warning/30 bg-warning-soft",
        accent: "text-warning",
      };

    case "paused":
      return {
        title: "New leads are paused: your ID documents are overdue",
        body: `${
          standing.dueBy ? `They were due ${formatDate(standing.dueBy)}. ` : ""
        }Next, ${standing.steps[0] ?? "upload your documents"}. Leads resume as soon as they are all sent, and your current jobs are not affected.`,
        cta: "Upload documents",
        frame: "border-danger/30 bg-danger-soft",
        accent: "text-danger",
      };

    case "active":
      return {
        title: "Verification in progress",
        body:
          standing.steps.length > 0
            ? `Next, ${standing.steps[0]}.`
            : `${standing.waiting[0]!.charAt(0).toUpperCase()}${standing.waiting[0]!.slice(1)}.`,
        cta: "Complete verification",
        frame: "border-warning/30 bg-warning-soft",
        accent: "text-warning",
      };

    case "ready":
      return {
        title: "Your paperwork is complete",
        body: "Everything has been accepted, so your account is verified. Refresh the page if this has not updated.",
        cta: "See details",
        frame: "border-positive/25 bg-positive-soft",
        accent: "text-positive",
      };

    case "paperwork":
      return {
        title: "Please finish your required documents",
        body: `Your account is verified, but some paperwork is still outstanding. Next, ${standing.steps[0]}.`,
        cta: "Send documents",
        frame: "border-clay-line bg-clay-soft",
        accent: "text-clay",
      };
  }
}
