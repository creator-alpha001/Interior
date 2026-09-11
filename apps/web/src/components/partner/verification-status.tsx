"use client";

import Link from "next/link";
import type { VendorVerification } from "@repo/types";
import { Badge, cn } from "@repo/ui";

/** Where the verification steps live. */
export const VERIFICATION_HREF = "/partner/onboarding";

/**
 * Where a vendor stands, in the terms they need: is there something for them
 * to do, or are they waiting on us?
 *
 * The distinction is the whole point. "Pending" alone reads the same whether the
 * vendor has not started or has sent everything and is waiting for our review,
 * and those people need opposite advice — one should act, the other should stop
 * worrying. So it is worked out from the record itself, not from the status.
 */
type Standing =
  | { kind: "verified" }
  | { kind: "closed"; status: "suspended" | "blacklisted" }
  | { kind: "action"; steps: string[]; waiting: string[] }
  | { kind: "waiting"; waiting: string[] }
  | { kind: "ready" }
  /** Verified before paperwork was required, and still owing some. */
  | { kind: "paperwork"; steps: string[] };

export function standingOf(verification: VendorVerification): Standing {
  const { agreement, terms } = verification;

  if (verification.verificationStatus === "suspended" || verification.verificationStatus === "blacklisted") {
    return { kind: "closed", status: verification.verificationStatus };
  }

  const steps: string[] = [];
  const waiting: string[] = [];

  if (agreement?.status !== "signed" || agreement.termsVersion !== terms.version) {
    steps.push("accept the partner terms");
  }

  switch (agreement?.signedCopyStatus) {
    case "accepted":
      break;
    case "submitted":
      waiting.push("our team is checking your signed agreement");
      break;
    case "rejected":
      steps.push("upload the signed agreement again, as our team sent it back");
      break;
    default:
      // Nothing to sign until our team has uploaded the document, and that is
      // not the vendor's to fix.
      if (terms.documentUrl) steps.push("download, sign and upload the agreement");
      else waiting.push("our team is preparing the agreement document for you to sign");
  }

  switch (agreement?.hardcopyStatus) {
    case "received":
      break;
    case "dispatched":
      waiting.push("your signed original is on its way to us");
      break;
    default:
      steps.push("send us the signed original");
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
      case "rejected":
        steps.push(`upload your ${label} again, as it was sent back`);
        break;
      default:
        steps.push(`upload your ${label}`);
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
        : ({ label: "Verification pending", tone: "warning" } as const);

  return (
    <Link href={VERIFICATION_HREF} className="shrink-0" title="Your verification status">
      <Badge tone={pill.tone}>{pill.label}</Badge>
    </Link>
  );
}

/**
 * What an unverified vendor sees across the top of every portal screen.
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

    case "action": {
      const more = standing.steps.length - 1;
      return {
        title: "You are not verified yet, so you will not receive leads",
        body: `Next, ${standing.steps[0]}.${
          more > 0 ? ` After that, ${more} more ${more === 1 ? "step" : "steps"}.` : ""
        }${standing.waiting.length > 0 ? " Some of it is already with our team." : ""}`,
        cta: "Complete verification",
        frame: "border-warning/30 bg-warning-soft",
        accent: "text-warning",
      };
    }

    case "waiting": {
      const more = standing.waiting.length - 1;
      const first = standing.waiting[0]!;
      return {
        title: "Verification in progress. Nothing for you to do right now",
        body: `${first.charAt(0).toUpperCase()}${first.slice(1)}${
          more > 0 ? `, and ${more} more ${more === 1 ? "item" : "items"} are with us` : ""
        }. We will start sending you leads once you are verified.`,
        cta: "See progress",
        frame: "border-brand-line bg-brand-soft",
        accent: "text-brand",
      };
    }

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
        title: "Please send us your signed agreement and documents",
        body: `Your account is verified, but we do not hold your paperwork yet. Next, ${standing.steps[0]}.`,
        cta: "Send paperwork",
        frame: "border-clay-line bg-clay-soft",
        accent: "text-clay",
      };
  }
}
