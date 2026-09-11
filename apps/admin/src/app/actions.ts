"use server";

import { revalidatePath } from "next/cache";
import {
  ApiError,
  assignProfessionals,
  createCatalogueProduct,
  createCategory,
  createDomain,
  createPackage,
  logCall,
  relayToVendors,
  replyToClient,
  replyToTicketAsAdmin,
  recordVisitOutcome,
  reviewMilestoneProof,
  scheduleVisit,
  setCommissionOverride,
  setInvoiceStatus,
  setLeadDomainStatus,
  setTicketStatus,
  decideProfessionalApplication,
  setVendorDomainStatus,
  setVendorStatus,
  updateCatalogueProduct,
  updateCategory,
  updateDomain,
  updatePackage,
  receiveHardcopy,
  reviewSignedCopy,
  reviewVendorDocument,
  updatePartnerTerms,
  requestUploadTicket,
  reviewAchievement,
  reviewPortfolioItem,
} from "@repo/data";
import type {
  TicketRequest,
  UploadTicketResult,
  HardcopyReceipt,
  PartnerTermsInput,
  VerificationDecision,
  ApplicationDecision,
  CallLogInput,
  CatalogueProductInput,
  CategoryInput,
  DomainInput,
  PackageInput,
  ScheduleVisitInput,
} from "@repo/data";
import type {
  DomainApprovalStatus,
  InvoiceStatus,
  LeadDomainStatus,
  VerificationStatus,
} from "@repo/types";

/* ---------------- Relay ---------------- */

/**
 * Answering the client. Kept separate from the relay-out action because they
 * are different acts: one is a reply, the other puts a question to every
 * assigned vendor at once.
 */
export async function replyToClientAction(leadDomainId: string, body: string, leadId: string) {
  await replyToClient(leadDomainId, body);
  revalidatePath(`/leads/${leadId}`);
}

export async function relayToVendorsAction(leadDomainId: string, body: string, leadId: string) {
  await relayToVendors(leadDomainId, body);
  revalidatePath(`/leads/${leadId}`);
}

/* ---------------- Assignment ---------------- */

export async function assignProfessionalsAction(
  leadDomainId: string,
  professionalIds: string[],
  leadId: string,
) {
  await assignProfessionals(leadDomainId, professionalIds);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/");
}

export async function setLeadDomainStatusAction(
  leadDomainId: string,
  status: LeadDomainStatus,
  leadId: string,
) {
  await setLeadDomainStatus(leadDomainId, status);
  revalidatePath(`/leads/${leadId}`);
}

/* ---------------- Calls and visits ---------------- */

export async function logCallAction(input: Omit<CallLogInput, "salesAgentId">) {
  await logCall(input);
  revalidatePath(`/leads/${input.leadId}`);
  revalidatePath("/leads");
}

/**
 * Optional write-up of what a visit established. Flagging a scope change
 * revalidates the lead so the quotes shown to ops reflect the new reality.
 */
export async function recordVisitOutcomeAction(
  meetingId: string,
  outcome: string,
  changedScope: boolean,
  leadId: string,
) {
  await recordVisitOutcome(meetingId, outcome, changedScope);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/visits");
  revalidatePath("/my-day");
}

export async function scheduleVisitAction(
  input: Omit<ScheduleVisitInput, "coordinatorId">,
  leadId: string,
) {
  await scheduleVisit(input);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/visits");
  revalidatePath("/my-day");
}

/* ---------------- Vendors ---------------- */

/**
 * Returns `{ error }` rather than throwing, because "Verified" is now refused
 * until the paperwork is complete, and the reviewer needs to read why rather
 * than land on an error page.
 */
export async function setVendorStatusAction(
  professionalId: string,
  status: VerificationStatus,
): Promise<ActionResult> {
  try {
    await setVendorStatus(professionalId, status);
  } catch (error) {
    return explain(error, "That status could not be changed.");
  }
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${professionalId}`);
  return {};
}

/* ---------------- Vendor work and achievements ---------------- */

export async function reviewPortfolioItemAction(
  professionalId: string,
  id: string,
  decision: VerificationDecision,
  note: string | null,
): Promise<ActionResult> {
  try {
    await reviewPortfolioItem(id, decision, note);
  } catch (error) {
    return explain(error, "That decision could not be recorded.");
  }
  revalidateVendor(professionalId);
  revalidatePath("/");
  return {};
}

export async function reviewAchievementAction(
  professionalId: string,
  id: string,
  decision: VerificationDecision,
  note: string | null,
): Promise<ActionResult> {
  try {
    await reviewAchievement(id, decision, note);
  } catch (error) {
    return explain(error, "That decision could not be recorded.");
  }
  revalidateVendor(professionalId);
  revalidatePath("/");
  return {};
}

/* ---------------- Uploads ---------------- */

/**
 * An upload ticket, asked for by this server with the staff session.
 *
 * The browser cannot ask the API itself: the session cookie belongs to
 * admin.decorashine.com, so a direct request arrives as nobody and is refused.
 * See `requestUploadTicket`.
 */
export async function issueUploadTicketAction(request: TicketRequest): Promise<UploadTicketResult> {
  return requestUploadTicket(request);
}

/* ---------------- Vendor verification ---------------- */

function revalidateVendor(professionalId: string) {
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${professionalId}`);
}

export async function reviewSignedCopyAction(
  professionalId: string,
  decision: VerificationDecision,
  note: string | null,
): Promise<ActionResult> {
  try {
    await reviewSignedCopy(professionalId, decision, note);
  } catch (error) {
    return explain(error, "That decision could not be recorded.");
  }
  revalidateVendor(professionalId);
  return {};
}

export async function receiveHardcopyAction(
  professionalId: string,
  input: HardcopyReceipt,
): Promise<ActionResult> {
  try {
    await receiveHardcopy(professionalId, input);
  } catch (error) {
    return explain(error, "That could not be recorded.");
  }
  revalidateVendor(professionalId);
  return {};
}

export async function reviewVendorDocumentAction(
  professionalId: string,
  documentId: string,
  decision: VerificationDecision,
  note: string | null,
): Promise<ActionResult> {
  try {
    await reviewVendorDocument(professionalId, documentId, decision, note);
  } catch (error) {
    return explain(error, "That decision could not be recorded.");
  }
  revalidateVendor(professionalId);
  return {};
}

export async function updatePartnerTermsAction(input: PartnerTermsInput): Promise<ActionResult> {
  try {
    await updatePartnerTerms(input);
  } catch (error) {
    return explain(error, "The agreement could not be saved.");
  }
  revalidatePath("/agreements");
  return {};
}

/** A client error's message, or a seed-store refusal's, for the form to show. */
function explain(error: unknown, fallback: string): ActionResult {
  if (error instanceof ApiError) return error.isClientError ? { error: error.message } : { error: fallback };
  if (error instanceof Error) return { error: error.message };
  return { error: fallback };
}

export async function setVendorDomainStatusAction(
  professionalId: string,
  domainId: string,
  status: DomainApprovalStatus,
) {
  await setVendorDomainStatus(professionalId, domainId, status);
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${professionalId}`);
}

export async function setCommissionOverrideAction(
  professionalId: string,
  domainId: string,
  percent: number | null,
) {
  await setCommissionOverride(professionalId, domainId, percent);
  revalidatePath(`/vendors/${professionalId}`);
}

/* ---------------- Commission ---------------- */

export async function setInvoiceStatusAction(
  invoiceId: string,
  status: InvoiceStatus,
  note?: string,
) {
  await setInvoiceStatus(invoiceId, status, note);
  revalidatePath("/commission");
  revalidatePath("/");
}

/* ---------------- Domains ---------------- */

export async function createDomainAction(input: DomainInput) {
  await createDomain(input);
  revalidatePath("/domains");
  revalidatePath("/");
}

export async function updateDomainAction(
  domainId: string,
  patch: Partial<DomainInput> & { isActive?: boolean },
) {
  await updateDomain(domainId, patch);
  revalidatePath("/domains");
}

/* ---------------- Support ---------------- */

export async function replyToTicketAction(ticketId: string, body: string) {
  await replyToTicketAsAdmin(ticketId, "Neha (Decora Shine support)", body);
  revalidatePath("/support");
}

export async function setTicketStatusAction(
  ticketId: string,
  status: "open" | "in_progress" | "resolved" | "closed",
) {
  await setTicketStatus(ticketId, status);
  revalidatePath("/support");
}

/* ---------------- Stage evidence ---------------- */

/**
 * Approving a stage is what moves the customer's progress bar. Sending it back
 * requires a reason, because the vendor has to know what to redo.
 */
export async function reviewStageAction(
  projectId: string,
  milestoneId: string,
  approve: boolean,
  note: string | null,
  leadId: string,
) {
  await reviewMilestoneProof(projectId, milestoneId, approve, note);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/my-day");
  revalidatePath("/");
}

/* ---------------- Catalogue ---------------- */

/**
 * Every one of these returns `{ error }` rather than throwing.
 *
 * The actions above predate the catalogue and throw, which surfaces as Next's
 * error page — acceptable for a status change with one field, and not for a
 * form somebody has spent five minutes filling in, where an unhandled throw
 * loses the lot. These hand the message back so the form can keep its state and
 * show what went wrong.
 */
type ActionResult = { error?: string };

function failed(error: unknown, fallback: string): ActionResult {
  // The API writes messages meant for the person who caused them — "That
  // category belongs to a different service" — so pass those through.
  if (error instanceof ApiError && error.isClientError) return { error: error.message };
  return { error: fallback };
}

/* ---------------- Applications to become a vendor ---------------- */

/**
 * One action for every decision, matching the endpoint behind it.
 *
 * Approving is the branch that matters: it creates the professional record, its
 * approved trades and its service areas, and moves the applicant's account over
 * — so the vendor screens are revalidated too, because a new vendor has just
 * appeared on them.
 */
export async function decideApplicationAction(
  applicationId: string,
  decision: ApplicationDecision,
): Promise<ActionResult> {
  try {
    await decideProfessionalApplication(applicationId, decision);
  } catch (error) {
    return failed(error, "That decision could not be recorded.");
  }

  revalidatePath("/applications");
  revalidatePath(`/applications/${applicationId}`);
  if (decision.action === "approve") {
    revalidatePath("/vendors");
    revalidatePath("/");
  }
  return {};
}

export async function createCategoryAction(input: CategoryInput): Promise<ActionResult> {
  try {
    await createCategory(input);
  } catch (error) {
    return failed(error, "That category could not be saved.");
  }
  revalidatePath("/catalogue");
  return {};
}

export async function updateCategoryAction(
  categoryId: string,
  patch: Partial<CategoryInput> & { isActive?: boolean },
): Promise<ActionResult> {
  try {
    await updateCategory(categoryId, patch);
  } catch (error) {
    return failed(error, "That category could not be saved.");
  }
  revalidatePath("/catalogue");
  return {};
}

export async function createPackageAction(input: PackageInput): Promise<ActionResult> {
  try {
    await createPackage(input);
  } catch (error) {
    return failed(error, "That package could not be saved.");
  }
  revalidatePath("/catalogue");
  return {};
}

export async function updatePackageAction(
  packageId: string,
  patch: Partial<PackageInput> & { isActive?: boolean },
): Promise<ActionResult> {
  try {
    await updatePackage(packageId, patch);
  } catch (error) {
    return failed(error, "That package could not be saved.");
  }
  revalidatePath("/catalogue");
  return {};
}

export async function createProductAction(input: CatalogueProductInput): Promise<ActionResult> {
  try {
    await createCatalogueProduct(input);
  } catch (error) {
    return failed(error, "That product could not be saved.");
  }
  revalidatePath("/catalogue");
  return {};
}

export async function updateProductAction(
  productId: string,
  patch: Partial<CatalogueProductInput> & { isActive?: boolean },
): Promise<ActionResult> {
  try {
    await updateCatalogueProduct(productId, patch);
  } catch (error) {
    return failed(error, "That product could not be saved.");
  }
  revalidatePath("/catalogue");
  return {};
}
