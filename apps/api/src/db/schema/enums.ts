/**
 * Every union type in @repo/types that is stored, as a Postgres enum.
 *
 * Enums rather than text + CHECK because the frontend already treats these as
 * closed sets — `leadDomainStatus[d.leadDomain.status]` in @repo/ui indexes a
 * lookup object by them, so a value the UI has no label for is a rendering bug.
 * The database should refuse it.
 */
import { pgEnum } from "drizzle-orm/pg-core";

/* ---- identity ---- */
export const userRole = pgEnum("user_role", ["client", "professional", "sales_agent", "admin"]);
export const userStatus = pgEnum("user_status", ["active", "inactive", "blocked"]);
export const verificationStatus = pgEnum("verification_status", [
  "pending",
  "verified",
  "suspended",
  "blacklisted",
]);
export const referralRewardStatus = pgEnum("referral_reward_status", [
  "pending",
  "earned",
  "paid",
  "expired",
]);
export const devicePlatform = pgEnum("device_platform", ["android", "ios", "web"]);

/* ---- domains ---- */
export const domainApprovalStatus = pgEnum("domain_approval_status", [
  "pending",
  "approved",
  "rejected",
]);
export const moderationStatus = pgEnum("moderation_status", ["pending", "approved", "rejected"]);

/* ---- catalogue ---- */
export const priceUnit = pgEnum("price_unit", [
  "per_piece",
  "per_sqft",
  "per_running_ft",
  "per_kg",
  "per_room",
  "per_project",
]);

/* ---- content ---- */
export const postStatus = pgEnum("post_status", ["draft", "scheduled", "published", "archived"]);

/* ---- leads ---- */
export const urgency = pgEnum("urgency", ["immediate", "within_month", "exploring"]);
export const leadSource = pgEnum("lead_source", [
  "app",
  "website",
  "referral",
  "sales_call",
  "catalogue",
]);
export const leadStatus = pgEnum("lead_status", [
  "new",
  "verified",
  "in_progress",
  "closed",
  "archived",
]);
export const materialSource = pgEnum("material_source", [
  "vendor_supplied",
  "customer_supplied",
  "undecided",
]);
export const leadDomainStatus = pgEnum("lead_domain_status", [
  "pending_assignment",
  "assigned",
  "quoted",
  "vendor_selected",
  "in_progress",
  "completed",
  "cancelled",
]);
export const assignmentResponse = pgEnum("assignment_response", [
  "pending",
  "accepted",
  "rejected",
]);
export const callStatus = pgEnum("call_status", [
  "connected",
  "not_reachable",
  "busy",
  "callback_requested",
  "not_interested",
]);

/* ---- flow ---- */
export const meetingStatus = pgEnum("meeting_status", [
  "scheduled",
  "confirmed",
  "completed",
  "rescheduled",
  "no_show",
]);
export const meetingType = pgEnum("meeting_type", [
  "consultation",
  "site_visit",
  "measurement",
  "handover",
]);
export const quoteStatus = pgEnum("quote_status", [
  "draft",
  "submitted",
  "revised",
  "approved",
  "rejected",
  "selected",
]);
export const messageChannel = pgEnum("message_channel", ["client_platform", "platform_vendor"]);
export const messageSenderRole = pgEnum("message_sender_role", [
  "client",
  "platform",
  "professional",
]);

/* ---- agreements ---- */
export const agreementStatus = pgEnum("agreement_status", [
  "draft",
  "sent",
  "signed",
  "active",
  "completed",
  "cancelled",
]);
export const partnerAgreementStatus = pgEnum("partner_agreement_status", [
  "pending",
  "signed",
  "superseded",
  "withdrawn",
]);

/* ---- execution ---- */
export const projectStatus = pgEnum("project_status", [
  "not_started",
  "ongoing",
  "on_hold",
  "completed",
  "cancelled",
]);
export const milestoneVerification = pgEnum("milestone_verification", [
  "not_started",
  "submitted",
  "approved",
  "rejected",
]);
export const invoiceStatus = pgEnum("invoice_status", [
  "pending",
  "paid",
  "overdue",
  "waived",
  "cancelled",
]);
export const refundStatus = pgEnum("refund_status", [
  "requested",
  "approved",
  "rejected",
  "processed",
]);
export const ticketCategory = pgEnum("ticket_category", [
  "complaint",
  "escalation",
  "refund",
  "query",
  "technical",
]);
export const ticketPriority = pgEnum("ticket_priority", ["low", "medium", "high", "urgent"]);
export const ticketStatus = pgEnum("ticket_status", [
  "open",
  "in_progress",
  "resolved",
  "closed",
]);
export const ticketAuthorRole = pgEnum("ticket_author_role", ["client", "platform"]);

/* ---- notifications ---- */
export const notificationType = pgEnum("notification_type", [
  "professional_assigned",
  "meeting_confirmed",
  "quote_uploaded",
  "agreement_ready",
  "agreement_signed",
  "project_started",
  "project_completed",
  "new_lead",
  "commission_due",
  "message_received",
  "review_received",
]);
export const notificationEntity = pgEnum("notification_entity", [
  "lead",
  "lead_domain",
  "quote",
  "meeting",
  "agreement",
  "project",
  "invoice",
  "message",
]);

/* ---- media ---- */
export const mediaType = pgEnum("media_type", ["photo", "video", "document"]);
export const uploadPurpose = pgEnum("upload_purpose", [
  "requirement_photo",
  "milestone_proof",
  "portfolio_item",
  "vendor_document",
  "catalogue_image",
  "blog_image",
]);
