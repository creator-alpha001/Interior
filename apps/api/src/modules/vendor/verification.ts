/**
 * Vendor verification: the paperwork between "approved" and "verified".
 *
 * Approval says a person may work here. Verification says we hold what makes
 * that enforceable: the standard agreement signed on paper, the original in our
 * hands, and documents identifying the business that signed it. A vendor is in
 * no lead pool until verified — `eligible_vendors` already requires
 * `verification_status = 'verified'` — so this module now stands between an
 * approved vendor and their first lead.
 *
 * `outstandingFor` is the one definition of "complete". The vendor's checklist,
 * the reviewer's checklist and the refusal to verify somebody early all read it,
 * so the three cannot disagree about what is missing.
 */
import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import type {
  HardcopyMethod,
  PartnerAgreement,
  PartnerTerms,
  VendorDocumentKind,
  VendorDocumentSlot,
  VendorVerification,
} from "@repo/types";
import { gstinMatchesPan, gstinSchema, panSchema } from "@repo/contract";
import { db, transaction, unscopedDb } from "../../db/client";
import * as t from "../../db/schema";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors";
import { groupMediaByOwner } from "../../lib/media";
import { publicUrlFor } from "../../lib/storage";
import { attachMedia } from "../uploads/repository";
import { getCurrentTerms } from "./onboarding";

/** `media_assets.owner_type` for the photographed pages of a signed agreement. */
const SIGNED_COPY_OWNER = "partner_agreement_copy";
/** `media_assets.owner_type` for a business document's files. */
const DOCUMENT_OWNER = "vendor_document";

type AgreementRow = typeof t.partnerAgreements.$inferSelect;
type Decision = "accept" | "reject";

/**
 * What a vendor is asked for, in the order they are asked.
 *
 * GST is conditional on purpose: a small business under the registration
 * threshold has no certificate to send, and refusing them would refuse the
 * vendors the platform most needs.
 */
const SLOTS: Array<{
  kind: VendorDocumentKind;
  label: string;
  description: string;
  numberLabel: string | null;
  onlyWhenGstRegistered?: true;
}> = [
  {
    kind: "pan",
    label: "PAN card",
    description:
      "The business's PAN, or the proprietor's own PAN for a sole proprietorship.",
    numberLabel: "PAN",
  },
  {
    kind: "gst_certificate",
    label: "GST registration certificate",
    description: "Form GST REG-06, for the GSTIN on your profile.",
    numberLabel: "GSTIN",
    onlyWhenGstRegistered: true,
  },
  {
    kind: "business_registration",
    label: "Business registration proof",
    description:
      "Udyam certificate, Shop and Establishment licence, partnership deed or certificate of incorporation.",
    numberLabel: "Registration number",
  },
  {
    kind: "signatory_id",
    label: "ID of the person signing",
    description:
      "Passport, voter ID, driving licence, or Aadhaar with only the last four digits visible.",
    numberLabel: "ID number (last 4 digits only for Aadhaar)",
  },
  {
    kind: "address_proof",
    label: "Business address proof",
    description:
      "A recent electricity bill, rent agreement or property tax receipt for the premises you work from.",
    numberLabel: null,
  },
];

/* ------------------------------------------------------------------ *
 * Reading
 * ------------------------------------------------------------------ */

export async function getVerification(professionalId: string): Promise<VendorVerification> {
  const pro = await professionalRow(professionalId);

  const [terms, agreementRows, documentRows] = await Promise.all([
    getCurrentTerms(),
    db
      .select()
      .from(t.partnerAgreements)
      .where(
        and(
          eq(t.partnerAgreements.professionalId, professionalId),
          ne(t.partnerAgreements.status, "superseded"),
        ),
      )
      .limit(1),
    db
      .select()
      .from(t.vendorDocuments)
      .where(
        and(
          eq(t.vendorDocuments.professionalId, professionalId),
          isNull(t.vendorDocuments.deletedAt),
        ),
      ),
  ]);

  const agreement = agreementRows[0] ?? null;

  const [copyMedia, documentMedia] = await Promise.all([
    mediaOwnedBy(SIGNED_COPY_OWNER, agreement ? [agreement.id] : []),
    mediaOwnedBy(
      DOCUMENT_OWNER,
      documentRows.map((d) => d.id),
    ),
  ]);

  const gstRegistered = Boolean(pro.gstNumber);

  const documents: VendorDocumentSlot[] = SLOTS.map((slot) => {
    const document = documentRows.find((d) => d.kind === slot.kind) ?? null;
    const required = !slot.onlyWhenGstRegistered || gstRegistered;
    return {
      kind: slot.kind,
      label: slot.label,
      description: required
        ? slot.description
        : "Only if you are registered for GST. Leave this if you are not.",
      required,
      numberLabel: slot.numberLabel,
      document,
      files: document ? (documentMedia.get(document.id) ?? []) : [],
    };
  });

  const outstanding = outstandingFor(terms, agreement, documents);

  return {
    professionalId,
    verificationStatus: pro.verificationStatus,
    canBeVerified: outstanding.length === 0,
    outstanding,
    terms,
    agreement: agreement as PartnerAgreement | null,
    signedCopy: agreement ? (copyMedia.get(agreement.id) ?? []) : [],
    documents,
  };
}

/** What still stands between this vendor and the verified tag. Empty when nothing does. */
export async function verificationGaps(professionalId: string): Promise<string[]> {
  return (await getVerification(professionalId)).outstanding;
}

/**
 * Verifies a pending vendor the moment nothing is outstanding.
 *
 * Every item has already been accepted by a person by the time this can pass —
 * the signed copy and each document are reviewed, and the original is marked
 * received by hand — so a further "now press Verified" is a step that only
 * ever delays a vendor who has done everything asked of them. Called after each
 * action that can complete the set, including the vendor accepting the terms,
 * which may be the last thing done.
 *
 * Only from pending. A suspended or blacklisted vendor whose paperwork is in
 * order stays where ops put them.
 *
 * On the unscoped pool: this can run inside a vendor's own request, and a
 * vendor's row-level-security scope is not the authority that grants the tag.
 */
export async function verifyIfComplete(professionalId: string): Promise<boolean> {
  const { outstanding, verificationStatus } = await getVerification(professionalId);
  if (verificationStatus !== "pending" || outstanding.length > 0) return false;

  const updated = await unscopedDb
    .update(t.professionals)
    .set({ verificationStatus: "verified", updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(t.professionals.id, professionalId),
        eq(t.professionals.verificationStatus, "pending"),
      ),
    )
    .returning({ id: t.professionals.id });

  return updated.length > 0;
}

/**
 * The one definition of complete.
 *
 * Written as sentences rather than codes because both the vendor and the
 * reviewer read them as they are, and a list of what is missing is only useful
 * if it says what to do.
 */
function outstandingFor(
  terms: PartnerTerms,
  agreement: AgreementRow | null,
  documents: VendorDocumentSlot[],
): string[] {
  const gaps: string[] = [];

  if (!agreement || agreement.status !== "signed" || agreement.termsVersion !== terms.version) {
    gaps.push(`Accept version ${terms.version} of the partner terms online`);
  }

  switch (agreement?.signedCopyStatus) {
    case "accepted":
      break;
    case "submitted":
      gaps.push("The signed agreement is waiting for our review");
      break;
    case "rejected":
      gaps.push("The signed agreement was sent back and needs uploading again");
      break;
    default:
      gaps.push("Upload the signed agreement");
  }

  if (agreement?.hardcopyStatus !== "received") {
    gaps.push(
      agreement?.hardcopyStatus === "dispatched"
        ? "The signed original has not reached us yet"
        : "Send us the signed original",
    );
  }

  for (const slot of documents) {
    if (!slot.required || slot.document?.status === "accepted") continue;
    const status = slot.document?.status;
    gaps.push(
      status === "submitted"
        ? `${slot.label}: waiting for our review`
        : status === "rejected"
          ? `${slot.label}: sent back, upload it again`
          : `Upload your ${slot.label.charAt(0).toLowerCase()}${slot.label.slice(1)}`,
    );
  }

  return gaps;
}

/* ------------------------------------------------------------------ *
 * What the vendor does
 * ------------------------------------------------------------------ */

export async function submitSignedCopy(
  professionalId: string,
  input: { files: string[]; stampCertificateNumber?: string | null },
): Promise<VendorVerification> {
  const pro = await professionalRow(professionalId);
  const agreement = await liveAgreement(professionalId);

  if (!agreement || agreement.status !== "signed") {
    throw new ConflictError("Accept the partner terms online before uploading the signed copy");
  }
  if (agreement.signedCopyStatus === "accepted") {
    throw new ConflictError("Your signed agreement has already been accepted");
  }

  await transaction(async (tx) => {
    const now = new Date().toISOString();

    // A resubmission replaces the pages rather than adding to them: the
    // reviewer should be looking at one complete copy, not every attempt.
    await tx
      .update(t.mediaAssets)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(t.mediaAssets.ownerType, SIGNED_COPY_OWNER),
          eq(t.mediaAssets.ownerId, agreement.id),
          isNull(t.mediaAssets.deletedAt),
        ),
      );

    await attachMedia(tx, input.files, SIGNED_COPY_OWNER, agreement.id, "vendor_document", pro.userId);

    await tx
      .update(t.partnerAgreements)
      .set({
        signedCopyStatus: "submitted",
        signedCopySubmittedAt: now,
        stampCertificateNumber: input.stampCertificateNumber?.trim() || null,
        signedCopyReviewedAt: null,
        signedCopyReviewedByUserId: null,
        signedCopyReviewNote: null,
        updatedAt: now,
      })
      .where(eq(t.partnerAgreements.id, agreement.id));
  });

  return getVerification(professionalId);
}

export async function reportHardcopy(
  professionalId: string,
  input: {
    method: HardcopyMethod;
    courier?: string | null;
    trackingNumber?: string | null;
    note?: string | null;
  },
): Promise<VendorVerification> {
  const courier = input.courier?.trim() || null;
  const trackingNumber = input.trackingNumber?.trim() || null;

  if (input.method === "courier" && (!courier || !trackingNumber)) {
    throw new ValidationError("Give the courier's name and the tracking number");
  }

  const agreement = await liveAgreement(professionalId);
  if (!agreement || agreement.status !== "signed") {
    throw new ConflictError("Accept the partner terms online first");
  }
  if (agreement.hardcopyStatus === "received") {
    throw new ConflictError("We have already received your signed original");
  }

  const now = new Date().toISOString();
  await db
    .update(t.partnerAgreements)
    .set({
      hardcopyMethod: input.method,
      hardcopyStatus: "dispatched",
      hardcopyCourier: input.method === "courier" ? courier : null,
      hardcopyTrackingNumber: input.method === "courier" ? trackingNumber : null,
      hardcopyNote: input.note?.trim() || null,
      hardcopyDispatchedAt: now,
      updatedAt: now,
    })
    .where(eq(t.partnerAgreements.id, agreement.id));

  return getVerification(professionalId);
}

export async function submitDocument(
  professionalId: string,
  input: { kind: VendorDocumentKind; documentNumber?: string | null; files: string[] },
): Promise<VendorVerification> {
  const pro = await professionalRow(professionalId);

  const live = await db
    .select()
    .from(t.vendorDocuments)
    .where(
      and(eq(t.vendorDocuments.professionalId, professionalId), isNull(t.vendorDocuments.deletedAt)),
    );

  const documentNumber = checkedNumber(input.kind, input.documentNumber, {
    profileGstin: pro.gstNumber,
    pan: live.find((d) => d.kind === "pan")?.documentNumber ?? null,
    gstin: live.find((d) => d.kind === "gst_certificate")?.documentNumber ?? null,
  });

  const existing = live.find((d) => d.kind === input.kind);
  if (existing?.status === "accepted") {
    throw new ConflictError(
      "This document has already been accepted. Ask our team if it needs replacing.",
    );
  }

  await transaction(async (tx) => {
    const now = new Date().toISOString();

    if (existing) {
      await tx
        .update(t.vendorDocuments)
        .set({ deletedAt: now, updatedAt: now })
        .where(eq(t.vendorDocuments.id, existing.id));
    }

    const [row] = await tx
      .insert(t.vendorDocuments)
      .values({ professionalId, kind: input.kind, documentNumber, submittedAt: now })
      .returning({ id: t.vendorDocuments.id });

    await attachMedia(tx, input.files, DOCUMENT_OWNER, row!.id, "vendor_document", pro.userId);
  });

  return getVerification(professionalId);
}

/**
 * The number a document carries, checked for what can be checked here.
 *
 * Format, and consistency between documents: a GSTIN carries the PAN it was
 * issued against, so a PAN and a GSTIN that disagree mean one of them belongs to
 * a different business. Whether either was genuinely issued is what the human
 * review is for.
 */
function checkedNumber(
  kind: VendorDocumentKind,
  raw: string | null | undefined,
  context: { profileGstin: string | null; pan: string | null; gstin: string | null },
): string | null {
  const value = raw?.trim() || null;

  switch (kind) {
    case "pan": {
      const pan = panSchema.safeParse(value ?? "");
      if (!pan.success) throw new ValidationError("Enter the PAN exactly as printed on the card");
      if (context.gstin && !gstinMatchesPan(context.gstin, pan.data)) {
        throw new ValidationError("That PAN is not the one inside the GSTIN you sent");
      }
      return pan.data;
    }
    case "gst_certificate": {
      const gstin = gstinSchema.safeParse(value ?? "");
      if (!gstin.success) throw new ValidationError("Enter the 15-character GSTIN from the certificate");
      if (context.profileGstin && context.profileGstin.toUpperCase() !== gstin.data) {
        throw new ValidationError(
          `That GSTIN is not the one on your profile (${context.profileGstin.toUpperCase()})`,
        );
      }
      if (context.pan && !gstinMatchesPan(gstin.data, context.pan)) {
        throw new ValidationError("That GSTIN was not issued against the PAN you sent");
      }
      return gstin.data;
    }
    case "business_registration":
      if (!value || value.length < 3) {
        throw new ValidationError("Enter the registration number on the certificate");
      }
      return value;
    case "signatory_id":
      // Storing a full Aadhaar number is restricted by the Aadhaar Act, and
      // there is no reason for this platform to hold one.
      if (value && /^\d{4}\s?\d{4}\s?\d{4}$/.test(value)) {
        throw new ValidationError("For Aadhaar, enter only the last 4 digits");
      }
      return value;
    case "address_proof":
      return null;
  }
}

/* ------------------------------------------------------------------ *
 * What our team does
 * ------------------------------------------------------------------ */

export async function reviewSignedCopy(
  staffUserId: string,
  professionalId: string,
  decision: Decision,
  note: string | null,
): Promise<VendorVerification> {
  const reason = requireReason(decision, note);
  const agreement = await liveAgreement(professionalId);

  if (!agreement || agreement.signedCopyStatus !== "submitted") {
    throw new ConflictError("There is no signed copy waiting for review");
  }

  const now = new Date().toISOString();
  await db
    .update(t.partnerAgreements)
    .set({
      signedCopyStatus: decision === "accept" ? "accepted" : "rejected",
      signedCopyReviewedAt: now,
      signedCopyReviewedByUserId: staffUserId,
      signedCopyReviewNote: reason,
      updatedAt: now,
    })
    .where(eq(t.partnerAgreements.id, agreement.id));

  await verifyIfComplete(professionalId);
  return getVerification(professionalId);
}

export async function receiveHardcopy(
  staffUserId: string,
  professionalId: string,
  input: { method: HardcopyMethod; receivedOn: string; note?: string | null },
): Promise<VendorVerification> {
  const today = new Date().toISOString().slice(0, 10);
  if (input.receivedOn > today) {
    throw new ValidationError("The date received cannot be in the future");
  }

  const agreement = await liveAgreement(professionalId);
  if (!agreement) throw new ConflictError("This vendor has no partner agreement yet");

  const now = new Date().toISOString();
  await db
    .update(t.partnerAgreements)
    .set({
      hardcopyMethod: input.method,
      hardcopyStatus: "received",
      // Midday in India, so the date shown back is the date that was entered
      // whichever timezone renders it.
      hardcopyReceivedAt: new Date(`${input.receivedOn}T12:00:00+05:30`).toISOString(),
      hardcopyReceivedByUserId: staffUserId,
      hardcopyNote: input.note?.trim() || agreement.hardcopyNote,
      updatedAt: now,
    })
    .where(eq(t.partnerAgreements.id, agreement.id));

  await verifyIfComplete(professionalId);
  return getVerification(professionalId);
}

export async function reviewDocument(
  staffUserId: string,
  professionalId: string,
  documentId: string,
  decision: Decision,
  note: string | null,
): Promise<VendorVerification> {
  const reason = requireReason(decision, note);

  const [document] = await db
    .select()
    .from(t.vendorDocuments)
    .where(
      and(
        eq(t.vendorDocuments.id, documentId),
        eq(t.vendorDocuments.professionalId, professionalId),
        isNull(t.vendorDocuments.deletedAt),
      ),
    )
    .limit(1);

  if (!document) throw new NotFoundError("That document");
  if (document.status !== "submitted") {
    throw new ConflictError("That document has already been reviewed");
  }

  const now = new Date().toISOString();
  await db
    .update(t.vendorDocuments)
    .set({
      status: decision === "accept" ? "accepted" : "rejected",
      reviewedAt: now,
      reviewedByUserId: staffUserId,
      reviewNote: reason,
      updatedAt: now,
    })
    .where(eq(t.vendorDocuments.id, document.id));

  await verifyIfComplete(professionalId);
  return getVerification(professionalId);
}

/** The current terms, as ops edit them. */
export async function getPartnerTermsForOps(): Promise<PartnerTerms> {
  return getCurrentTerms();
}

export async function updatePartnerTerms(
  staffUserId: string,
  input: { documentMediaId?: string | null; hardcopyInstructions?: string },
): Promise<PartnerTerms> {
  const [current] = await db
    .select({ version: t.partnerTerms.version })
    .from(t.partnerTerms)
    .where(eq(t.partnerTerms.isCurrent, true))
    .limit(1);

  if (!current) throw new ConflictError("No partner terms are published");

  await transaction(async (tx) => {
    const now = new Date().toISOString();
    const patch: Partial<typeof t.partnerTerms.$inferInsert> = { updatedAt: now };

    if (input.hardcopyInstructions !== undefined) {
      patch.hardcopyInstructions = input.hardcopyInstructions;
    }

    if (input.documentMediaId === null) {
      patch.documentMediaId = null;
      patch.documentUrl = null;
    } else if (input.documentMediaId) {
      /*
       * Owned by itself. `partner_terms` is keyed by its version string, which
       * the uuid owner column cannot hold — and an asset with no owner is what
       * the orphan sweep deletes, which would take the agreement down with it.
       */
      await attachMedia(
        tx,
        [input.documentMediaId],
        "partner_terms_document",
        input.documentMediaId,
        "agreement_template",
        staffUserId,
      );

      const [asset] = await tx
        .select({ storageKey: t.mediaAssets.storageKey })
        .from(t.mediaAssets)
        .where(eq(t.mediaAssets.id, input.documentMediaId))
        .limit(1);

      if (!asset) throw new ValidationError("That file is no longer available");
      patch.documentMediaId = input.documentMediaId;
      patch.documentUrl = publicUrlFor(asset.storageKey);
    }

    await tx.update(t.partnerTerms).set(patch).where(eq(t.partnerTerms.version, current.version));
  });

  return getCurrentTerms();
}

/* ------------------------------------------------------------------ *
 * Plumbing
 * ------------------------------------------------------------------ */

async function professionalRow(professionalId: string) {
  const [row] = await db
    .select({
      userId: t.professionals.userId,
      gstNumber: t.professionals.gstNumber,
      verificationStatus: t.professionals.verificationStatus,
    })
    .from(t.professionals)
    .where(and(eq(t.professionals.id, professionalId), isNull(t.professionals.deletedAt)))
    .limit(1);

  if (!row) throw new NotFoundError("That professional");
  return row;
}

async function liveAgreement(professionalId: string): Promise<AgreementRow | null> {
  const [row] = await db
    .select()
    .from(t.partnerAgreements)
    .where(
      and(
        eq(t.partnerAgreements.professionalId, professionalId),
        ne(t.partnerAgreements.status, "superseded"),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function mediaOwnedBy(ownerType: string, ownerIds: string[]) {
  if (ownerIds.length === 0) return new Map<string, never[]>();

  const rows = await db
    .select()
    .from(t.mediaAssets)
    .where(
      and(
        eq(t.mediaAssets.ownerType, ownerType),
        inArray(t.mediaAssets.ownerId, ownerIds),
        isNull(t.mediaAssets.deletedAt),
      ),
    )
    .orderBy(asc(t.mediaAssets.sortOrder));

  return groupMediaByOwner(rows);
}

/** A refusal is read by the vendor, so it has to tell them something. */
function requireReason(decision: Decision, note: string | null): string | null {
  const trimmed = note?.trim() || null;
  if (decision === "reject" && (!trimmed || trimmed.length < 10)) {
    throw new ValidationError("Say what is wrong — the vendor is shown this");
  }
  return trimmed;
}
