"use server";

import { revalidatePath } from "next/cache";
import {
  assignProfessionals,
  createDomain,
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
  setVendorDomainStatus,
  setVendorStatus,
  updateDomain,
} from "@repo/data";
import type { CallLogInput, DomainInput, ScheduleVisitInput } from "@repo/data";
import type {
  DomainApprovalStatus,
  InvoiceStatus,
  LeadDomainStatus,
  VerificationStatus,
} from "@repo/types";
import { CURRENT_ADMIN_USER_ID, CURRENT_AGENT_ID } from "@/lib/session";

/* ---------------- Relay ---------------- */

/**
 * Answering the client. Kept separate from the relay-out action because they
 * are different acts: one is a reply, the other puts a question to every
 * assigned vendor at once.
 */
export async function replyToClientAction(leadDomainId: string, body: string, leadId: string) {
  await replyToClient(leadDomainId, CURRENT_AGENT_ID, body);
  revalidatePath(`/leads/${leadId}`);
}

export async function relayToVendorsAction(leadDomainId: string, body: string, leadId: string) {
  await relayToVendors(leadDomainId, CURRENT_AGENT_ID, body);
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
  await logCall({ ...input, salesAgentId: CURRENT_AGENT_ID });
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
  await scheduleVisit({ ...input, coordinatorId: CURRENT_AGENT_ID });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/visits");
  revalidatePath("/my-day");
}

/* ---------------- Vendors ---------------- */

export async function setVendorStatusAction(
  professionalId: string,
  status: VerificationStatus,
) {
  await setVendorStatus(professionalId, status);
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${professionalId}`);
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
  await replyToTicketAsAdmin(ticketId, "Neha (Aangan support)", body);
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
  await reviewMilestoneProof(projectId, milestoneId, approve, note, CURRENT_ADMIN_USER_ID);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/my-day");
  revalidatePath("/");
}
