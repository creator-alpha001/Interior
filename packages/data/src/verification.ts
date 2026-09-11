/**
 * Vendor verification, from the apps' side of the seam.
 *
 * The vendor's "getting verified" checklist and the reviewer's panel are the
 * same record seen from two ends, so both live here — splitting them is how the
 * two ends come to disagree about what "outstanding" means.
 *
 * As everywhere in this package: with a backend configured these are HTTP
 * calls, and without one they resolve against the seed store. The API is the
 * authority on what counts as complete; the seed branch mirrors it so a local
 * walkthrough teaches the same rules.
 */
import type {
  HardcopyMethod,
  MediaAsset,
  PartnerAgreement,
  PartnerTerms,
  VendorDocumentKind,
  VendorDocumentSlot,
  VendorVerification,
} from "@repo/types";
import { partnerTerms } from "@repo/mock";
import { api, nullWhenMissing } from "./client";
import { callingApiAsUser, currentProfessionalId, currentStaffUserId } from "./session";
import { delay, nextId, nowIso, store } from "./store";

export type VerificationDecision = "accept" | "reject";

export interface SignedCopyInput {
  /** Already uploaded with purpose `vendor_document`. */
  files: MediaAsset[];
  stampCertificateNumber?: string | null;
}

export interface HardcopyReport {
  method: HardcopyMethod;
  courier?: string | null;
  trackingNumber?: string | null;
  note?: string | null;
}

export interface VendorDocumentInput {
  kind: VendorDocumentKind;
  documentNumber?: string | null;
  files: MediaAsset[];
}

export interface HardcopyReceipt {
  method: HardcopyMethod;
  /** YYYY-MM-DD. */
  receivedOn: string;
  note?: string | null;
}

export interface PartnerTermsInput {
  /** An uploaded `agreement_template`; null removes the current one. */
  documentMediaId?: string | null;
  /** Only used without a backend, where there is no storage to resolve an id against. */
  previewUrl?: string;
  hardcopyInstructions?: string;
}

/* ------------------------------------------------------------------ *
 * The vendor's side
 * ------------------------------------------------------------------ */

export async function getMyVerification(): Promise<VendorVerification> {
  if (await callingApiAsUser()) return api<VendorVerification>("/vendor/verification");
  return delay(buildVerification(await currentProfessionalId()));
}

export async function submitSignedCopy(input: SignedCopyInput): Promise<VendorVerification> {
  if (await callingApiAsUser()) {
    return api<VendorVerification>("/vendor/verification/signed-copy", {
      method: "POST",
      body: {
        files: input.files.map((file) => file.id),
        stampCertificateNumber: input.stampCertificateNumber ?? null,
      },
    });
  }

  const professionalId = await currentProfessionalId();
  const agreement = liveAgreement(professionalId);

  if (!agreement || agreement.status !== "signed") {
    throw new Error("Accept the partner terms online before uploading the signed copy");
  }
  if (agreement.signedCopyStatus === "accepted") {
    throw new Error("Your signed agreement has already been accepted");
  }
  if (input.files.length === 0) throw new Error("Upload every signed page");

  store.verificationFiles[agreement.id] = input.files;
  Object.assign(agreement, {
    signedCopyStatus: "submitted",
    signedCopySubmittedAt: nowIso(),
    stampCertificateNumber: input.stampCertificateNumber?.trim() || null,
    signedCopyReviewedAt: null,
    signedCopyReviewedByUserId: null,
    signedCopyReviewNote: null,
    updatedAt: nowIso(),
  } satisfies Partial<PartnerAgreement>);

  return delay(buildVerification(professionalId));
}

export async function reportHardcopySent(input: HardcopyReport): Promise<VendorVerification> {
  if (await callingApiAsUser()) {
    return api<VendorVerification>("/vendor/verification/hardcopy", {
      method: "POST",
      body: input,
    });
  }

  const courier = input.courier?.trim() || null;
  const trackingNumber = input.trackingNumber?.trim() || null;
  if (input.method === "courier" && (!courier || !trackingNumber)) {
    throw new Error("Give the courier's name and the tracking number");
  }

  const professionalId = await currentProfessionalId();
  const agreement = liveAgreement(professionalId);
  if (!agreement || agreement.status !== "signed") {
    throw new Error("Accept the partner terms online first");
  }
  if (agreement.hardcopyStatus === "received") {
    throw new Error("We have already received your signed original");
  }

  Object.assign(agreement, {
    hardcopyMethod: input.method,
    hardcopyStatus: "dispatched",
    hardcopyCourier: input.method === "courier" ? courier : null,
    hardcopyTrackingNumber: input.method === "courier" ? trackingNumber : null,
    hardcopyNote: input.note?.trim() || null,
    hardcopyDispatchedAt: nowIso(),
    updatedAt: nowIso(),
  } satisfies Partial<PartnerAgreement>);

  return delay(buildVerification(professionalId));
}

export async function submitVendorDocument(input: VendorDocumentInput): Promise<VendorVerification> {
  if (await callingApiAsUser()) {
    return api<VendorVerification>("/vendor/verification/documents", {
      method: "POST",
      body: {
        kind: input.kind,
        documentNumber: input.documentNumber ?? null,
        files: input.files.map((file) => file.id),
      },
    });
  }

  const professionalId = await currentProfessionalId();
  if (input.files.length === 0) throw new Error("Attach the document");

  const number = input.documentNumber?.replace(/\s/g, "").toUpperCase() || null;
  if (input.kind === "pan" && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(number ?? "")) {
    throw new Error("Enter the PAN exactly as printed on the card");
  }
  if (
    input.kind === "gst_certificate" &&
    !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(number ?? "")
  ) {
    throw new Error("Enter the 15-character GSTIN from the certificate");
  }

  const existing = store.vendorDocuments.find(
    (d) => d.professionalId === professionalId && d.kind === input.kind && d.deletedAt === null,
  );
  if (existing?.status === "accepted") {
    throw new Error("This document has already been accepted. Ask our team if it needs replacing.");
  }
  if (existing) existing.deletedAt = nowIso();

  const id = nextId("vdoc");
  store.vendorDocuments.push({
    id,
    professionalId,
    kind: input.kind,
    documentNumber:
      input.kind === "pan" || input.kind === "gst_certificate"
        ? number
        : input.documentNumber?.trim() || null,
    status: "submitted",
    submittedAt: nowIso(),
    reviewedAt: null,
    reviewedByUserId: null,
    reviewNote: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    deletedAt: null,
  });
  store.verificationFiles[id] = input.files;

  return delay(buildVerification(professionalId));
}

/* ------------------------------------------------------------------ *
 * The reviewer's side
 * ------------------------------------------------------------------ */

export async function getVendorVerificationFor(
  professionalId: string,
): Promise<VendorVerification | null> {
  if (await callingApiAsUser()) {
    return nullWhenMissing(
      api<VendorVerification>(`/ops/vendors/${encodeURIComponent(professionalId)}/verification`),
    );
  }

  const exists = store.professionals.some((p) => p.id === professionalId);
  return delay(exists ? buildVerification(professionalId) : null);
}

export async function reviewSignedCopy(
  professionalId: string,
  decision: VerificationDecision,
  note: string | null,
): Promise<VendorVerification> {
  if (await callingApiAsUser()) {
    return api<VendorVerification>(
      `/ops/vendors/${encodeURIComponent(professionalId)}/verification/signed-copy`,
      { method: "POST", body: { decision, note } },
    );
  }

  const reason = requireReason(decision, note);
  const agreement = liveAgreement(professionalId);
  if (!agreement || agreement.signedCopyStatus !== "submitted") {
    throw new Error("There is no signed copy waiting for review");
  }

  Object.assign(agreement, {
    signedCopyStatus: decision === "accept" ? "accepted" : "rejected",
    signedCopyReviewedAt: nowIso(),
    signedCopyReviewedByUserId: await currentStaffUserId(),
    signedCopyReviewNote: reason,
    updatedAt: nowIso(),
  } satisfies Partial<PartnerAgreement>);

  return delay(buildVerification(professionalId));
}

export async function receiveHardcopy(
  professionalId: string,
  input: HardcopyReceipt,
): Promise<VendorVerification> {
  if (await callingApiAsUser()) {
    return api<VendorVerification>(
      `/ops/vendors/${encodeURIComponent(professionalId)}/verification/hardcopy`,
      { method: "POST", body: input },
    );
  }

  const agreement = liveAgreement(professionalId);
  if (!agreement) throw new Error("This vendor has no partner agreement yet");

  Object.assign(agreement, {
    hardcopyMethod: input.method,
    hardcopyStatus: "received",
    hardcopyReceivedAt: new Date(`${input.receivedOn}T12:00:00+05:30`).toISOString(),
    hardcopyReceivedByUserId: await currentStaffUserId(),
    hardcopyNote: input.note?.trim() || agreement.hardcopyNote,
    updatedAt: nowIso(),
  } satisfies Partial<PartnerAgreement>);

  return delay(buildVerification(professionalId));
}

export async function reviewVendorDocument(
  professionalId: string,
  documentId: string,
  decision: VerificationDecision,
  note: string | null,
): Promise<VendorVerification> {
  if (await callingApiAsUser()) {
    return api<VendorVerification>(
      `/ops/vendors/${encodeURIComponent(professionalId)}/verification/documents/${encodeURIComponent(documentId)}`,
      { method: "POST", body: { decision, note } },
    );
  }

  const reason = requireReason(decision, note);
  const document = store.vendorDocuments.find(
    (d) => d.id === documentId && d.professionalId === professionalId && d.deletedAt === null,
  );
  if (!document) throw new Error("That document could not be found");
  if (document.status !== "submitted") throw new Error("That document has already been reviewed");

  Object.assign(document, {
    status: decision === "accept" ? "accepted" : "rejected",
    reviewedAt: nowIso(),
    reviewedByUserId: await currentStaffUserId(),
    reviewNote: reason,
    updatedAt: nowIso(),
  });

  return delay(buildVerification(professionalId));
}

export async function getPartnerTermsForOps(): Promise<PartnerTerms> {
  if (await callingApiAsUser()) return api<PartnerTerms>("/ops/partner-terms");
  return delay(partnerTerms);
}

export async function updatePartnerTerms(input: PartnerTermsInput): Promise<PartnerTerms> {
  if (await callingApiAsUser()) {
    return api<PartnerTerms>("/ops/partner-terms", {
      method: "PATCH",
      body: {
        documentMediaId: input.documentMediaId,
        hardcopyInstructions: input.hardcopyInstructions,
      },
    });
  }

  if (input.hardcopyInstructions !== undefined) {
    partnerTerms.hardcopyInstructions = input.hardcopyInstructions;
  }
  if (input.documentMediaId === null) partnerTerms.documentUrl = null;
  else if (input.previewUrl) partnerTerms.documentUrl = input.previewUrl;

  return delay(partnerTerms);
}

/** What stands between a seeded vendor and the verified tag. For the seed branch of `setVendorStatus`. */
export function verificationGapsFor(professionalId: string): string[] {
  return buildVerification(professionalId).outstanding;
}

/* ------------------------------------------------------------------ *
 * Seed-store plumbing, mirroring modules/vendor/verification.ts
 * ------------------------------------------------------------------ */

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
    description: "The business's PAN, or the proprietor's own PAN for a sole proprietorship.",
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

function liveAgreement(professionalId: string): PartnerAgreement | undefined {
  return store.partnerAgreements.find(
    (a) => a.professionalId === professionalId && a.status !== "superseded",
  );
}

function buildVerification(professionalId: string): VendorVerification {
  const pro = store.professionals.find((p) => p.id === professionalId);
  if (!pro) throw new Error("Unknown professional");

  const agreement = liveAgreement(professionalId) ?? null;
  const gstRegistered = Boolean(pro.gstNumber);

  const documents: VendorDocumentSlot[] = SLOTS.map((slot) => {
    const document =
      store.vendorDocuments.find(
        (d) => d.professionalId === professionalId && d.kind === slot.kind && d.deletedAt === null,
      ) ?? null;
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
      files: document ? (store.verificationFiles[document.id] ?? []) : [],
    };
  });

  const outstanding: string[] = [];

  if (!agreement || agreement.status !== "signed" || agreement.termsVersion !== partnerTerms.version) {
    outstanding.push(`Accept version ${partnerTerms.version} of the partner terms online`);
  }
  if (agreement?.signedCopyStatus !== "accepted") {
    outstanding.push(
      agreement?.signedCopyStatus === "submitted"
        ? "The signed agreement is waiting for our review"
        : agreement?.signedCopyStatus === "rejected"
          ? "The signed agreement was sent back and needs uploading again"
          : "Upload the signed agreement",
    );
  }
  if (agreement?.hardcopyStatus !== "received") {
    outstanding.push(
      agreement?.hardcopyStatus === "dispatched"
        ? "The signed original has not reached us yet"
        : "Send us the signed original",
    );
  }
  for (const slot of documents) {
    if (!slot.required || slot.document?.status === "accepted") continue;
    const status = slot.document?.status;
    outstanding.push(
      status === "submitted"
        ? `${slot.label}: waiting for our review`
        : status === "rejected"
          ? `${slot.label}: sent back, upload it again`
          : `Upload your ${slot.label.charAt(0).toLowerCase()}${slot.label.slice(1)}`,
    );
  }

  return {
    professionalId,
    verificationStatus: pro.verificationStatus,
    canBeVerified: outstanding.length === 0,
    outstanding,
    terms: partnerTerms,
    agreement,
    signedCopy: agreement ? (store.verificationFiles[agreement.id] ?? []) : [],
    documents,
  };
}

function requireReason(decision: VerificationDecision, note: string | null): string | null {
  const trimmed = note?.trim() || null;
  if (decision === "reject" && (!trimmed || trimmed.length < 10)) {
    throw new Error("Say what is wrong — the vendor is shown this");
  }
  return trimmed;
}
