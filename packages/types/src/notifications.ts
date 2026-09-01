import type { BaseRecord, ID } from "./common";

export type NotificationType =
  | "professional_assigned"
  | "meeting_confirmed"
  | "quote_uploaded"
  | "agreement_ready"
  | "agreement_signed"
  | "project_started"
  | "project_completed"
  | "new_lead"
  | "commission_due"
  | "message_received"
  | "review_received";

/**
 * `entityType` + `entityId` give every notification a deep link target, so a
 * push can open the exact quote or agreement rather than a generic list.
 */
export interface Notification extends BaseRecord {
  id: ID;
  userId: ID;
  type: NotificationType;
  title: string;
  body: string;
  entityType:
    | "lead"
    | "lead_domain"
    | "quote"
    | "meeting"
    | "agreement"
    | "project"
    | "invoice"
    | "message"
    | null;
  entityId: ID | null;
  isRead: boolean;
}
