import type {
  AgreementStatus,
  InvoiceStatus,
  LeadDomainStatus,
  MaterialSource,
  MeetingStatus,
  ProjectStatus,
  Urgency,
} from "@repo/types";

type Tone = "neutral" | "brand" | "clay" | "positive" | "warning" | "danger";

export const leadDomainStatus: Record<LeadDomainStatus, { label: string; tone: Tone }> = {
  pending_assignment: { label: "Awaiting professionals", tone: "warning" },
  assigned: { label: "Professionals assigned", tone: "brand" },
  quoted: { label: "Quotes ready", tone: "clay" },
  vendor_selected: { label: "Professional selected", tone: "brand" },
  in_progress: { label: "Work in progress", tone: "brand" },
  completed: { label: "Completed", tone: "positive" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export const agreementStatus: Record<AgreementStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  sent: { label: "Awaiting signature", tone: "warning" },
  signed: { label: "Signed", tone: "brand" },
  active: { label: "Active", tone: "brand" },
  completed: { label: "Completed", tone: "positive" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export const projectStatus: Record<ProjectStatus, { label: string; tone: Tone }> = {
  not_started: { label: "Not started", tone: "neutral" },
  ongoing: { label: "In progress", tone: "brand" },
  on_hold: { label: "On hold", tone: "warning" },
  completed: { label: "Completed", tone: "positive" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export const invoiceStatus: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "warning" },
  paid: { label: "Paid", tone: "positive" },
  overdue: { label: "Overdue", tone: "danger" },
  waived: { label: "Waived", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const meetingStatus: Record<MeetingStatus, { label: string; tone: Tone }> = {
  scheduled: { label: "Scheduled", tone: "neutral" },
  confirmed: { label: "Confirmed", tone: "brand" },
  completed: { label: "Completed", tone: "positive" },
  rescheduled: { label: "Rescheduled", tone: "warning" },
  no_show: { label: "No show", tone: "danger" },
};

export const materialSourceLabel: Record<MaterialSource, string> = {
  vendor_supplied: "Vendor supplies material",
  customer_supplied: "I supply the material",
  undecided: "Material source undecided",
};

export const urgencyLabel: Record<Urgency, string> = {
  immediate: "Immediate",
  within_month: "Within a month",
  exploring: "Just exploring",
};

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
