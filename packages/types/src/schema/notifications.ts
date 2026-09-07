import { z } from "zod";
import { baseRecordSchema, idSchema } from "./common";

export const notificationTypeSchema = z.enum([
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

/**
 * `entityType` + `entityId` give every notification a deep link target, so a
 * push can open the exact quote or agreement rather than a generic list.
 */
export const notificationSchema = baseRecordSchema.extend({
  id: idSchema,
  userId: idSchema,
  type: notificationTypeSchema,
  title: z.string(),
  body: z.string(),
  entityType: z
    .enum([
      "lead",
      "lead_domain",
      "quote",
      "meeting",
      "agreement",
      "project",
      "invoice",
      "message",
    ])
    .nullable(),
  entityId: idSchema.nullable(),
  isRead: z.boolean(),
});
