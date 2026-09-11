/**
 * Vendor onboarding.
 *
 * The rule this exists to enforce: an unsigned vendor is in no lead pool.
 * Approving somebody's trade and letting them work are two different decisions,
 * and the signature is what separates them.
 *
 * `canReceiveLeads` used to be computed here *and* as a separate predicate in
 * the vendor pool, and the two could disagree about whether a given vendor was
 * assignable. Both now read the `eligible_vendors` view.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import type { OnboardingStep, PartnerAgreement, PartnerTerms, VendorOnboarding } from "@repo/types";
import { db } from "../../db/client";
import * as t from "../../db/schema";
import { NotFoundError } from "../../lib/errors";

export async function getCurrentTerms(): Promise<PartnerTerms> {
  const [row] = await db
    .select()
    .from(t.partnerTerms)
    .where(eq(t.partnerTerms.isCurrent, true))
    .limit(1);

  if (!row) throw new NotFoundError("The partner terms");

  return {
    version: row.version,
    effectiveFrom: row.effectiveFrom,
    title: row.title,
    summary: row.summary,
    sections: row.sections,
    acknowledgements: row.acknowledgements,
    documentUrl: row.documentUrl,
    hardcopyInstructions: row.hardcopyInstructions,
  };
}

export async function getOnboarding(professionalId: string): Promise<VendorOnboarding> {
  const [pro] = await db
    .select({ professional: t.professionals, user: t.users })
    .from(t.professionals)
    .innerJoin(t.users, eq(t.users.id, t.professionals.userId))
    .where(eq(t.professionals.id, professionalId))
    .limit(1);

  if (!pro) throw new NotFoundError("That account");

  const terms = await getCurrentTerms();

  const [agreementRow, trades, areas, portfolio, eligible] = await Promise.all([
    db
      .select()
      .from(t.partnerAgreements)
      .where(
        and(
          eq(t.partnerAgreements.professionalId, professionalId),
          sql`${t.partnerAgreements.status} <> 'superseded'`,
        ),
      )
      .limit(1),
    db
      .select()
      .from(t.professionalDomains)
      .where(eq(t.professionalDomains.professionalId, professionalId)),
    db
      .select()
      .from(t.professionalServiceAreas)
      .where(eq(t.professionalServiceAreas.professionalId, professionalId)),
    db
      .select({ id: t.portfolioItems.id })
      .from(t.portfolioItems)
      .where(
        and(
          eq(t.portfolioItems.professionalId, professionalId),
          isNull(t.portfolioItems.deletedAt),
        ),
      ),
    // The single source of truth for "may be assigned work".
    db.execute<{ ok: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1 FROM eligible_vendors WHERE professional_id = ${professionalId}
      ) AS ok
    `),
  ]);

  const agreement = (agreementRow[0] ?? null) as PartnerAgreement | null;
  const approvedTrades = trades.filter((tr) => tr.verificationStatus === "approved");
  const signed = agreement?.status === "signed" && agreement.termsVersion === terms.version;

  const steps: OnboardingStep[] = [
    {
      key: "profile",
      label: "Business profile",
      description: "Company name, years of experience and a description of what you do.",
      done: pro.professional.companyName.length > 0 && pro.professional.bio.length > 20,
      blocking: true,
      hint: null,
    },
    {
      key: "identity",
      label: "Verified badge",
      description:
        "Your ID and business documents, checked by our team. Due within 7 days of your signed original reaching us.",
      done: pro.professional.verificationStatus === "verified",
      // Not a condition for leads since 0015 — the signed original is. Late
      // documents pause leads through the eligibility view instead.
      blocking: false,
      hint:
        pro.professional.verificationStatus === "pending"
          ? "Send your ID documents on this page. New leads pause if they are late."
          : null,
    },
    {
      key: "trades",
      label: "Trades approved",
      description: "Each trade is approved separately, so quality is controlled per service.",
      done: approvedTrades.length > 0,
      blocking: true,
      hint: trades.length > approvedTrades.length ? "Some trades are still under review." : null,
    },
    {
      key: "service_areas",
      label: "Service areas",
      description: "The cities and localities you will travel to.",
      done: areas.length > 0,
      blocking: true,
      hint: null,
    },
    {
      key: "portfolio",
      label: "Work photos",
      description: "Completed jobs, so customers can see your work.",
      done: portfolio.length >= 5,
      // Not blocking: a vendor with no photos is harder to sell, but that is a
      // commercial problem, not a reason to withhold work.
      blocking: false,
      hint: portfolio.length > 0 ? `${portfolio.length} added so far.` : null,
    },
    {
      key: "agreement",
      label: "Partner agreement signed and received",
      description: `Version ${terms.version}, accepted online, signed on paper, and the original with our team.`,
      done: signed && agreement?.hardcopyStatus === "received",
      blocking: true,
      hint: !signed
        ? "Accept the terms online first."
        : agreement?.hardcopyStatus === "received"
          ? null
          : "Send us the signed original. Leads start when it arrives.",
    },
  ];

  const blocking = steps.filter((s) => s.blocking && !s.done);
  const canReceiveLeads = Boolean((eligible as unknown as Array<{ ok: boolean }>)[0]?.ok);

  return {
    professionalId,
    steps,
    completedCount: steps.filter((s) => s.done).length,
    totalCount: steps.length,
    canReceiveLeads,
    blockedReason: canReceiveLeads
      ? null
      : blocking[0]
        ? blocking[0].label
        : pro.professional.verificationStatus === "suspended" ||
            pro.professional.verificationStatus === "blacklisted"
          ? "Your account is suspended."
          : // Every blocking step is done, so the eligibility view is holding
            // them back on the one rule the steps do not show: late documents.
            "Your ID documents are overdue, so new leads are paused.",
    agreement,
    terms,
  };
}
