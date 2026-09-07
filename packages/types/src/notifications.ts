/** The notification outbox rows, as the client sees them. */
import type { z } from "zod";
import type {
  notificationSchema,
  notificationTypeSchema,
} from "./schema/notifications";

export type NotificationType = z.infer<typeof notificationTypeSchema>;

/**
 * `entityType` + `entityId` give every notification a deep link target, so a
 * push can open the exact quote or agreement rather than a generic list.
 */
export type Notification = z.infer<typeof notificationSchema>;
