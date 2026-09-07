/**
 * In-app notifications, which double as the outbox for SMS and push.
 *
 * `entityType` plus `entityId` give every row a deep-link target, so a push can
 * open the exact quote rather than a generic list. `dispatchedAt` is what the
 * delivery job claims — writing the row and sending the message are separate
 * steps so that a rolled-back transaction cannot have already sent an SMS.
 */
import { sql } from "drizzle-orm";
import { boolean, index, pgTable, text } from "drizzle-orm/pg-core";
import { fk, primaryId, timestamps, ts } from "./_shared";
import { users } from "./identity";
import { notificationEntity, notificationType } from "./enums";

export const notifications = pgTable(
  "notifications",
  {
    id: primaryId(),
    userId: fk("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationType("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    entityType: notificationEntity("entity_type"),
    entityId: fk("entity_id"),
    isRead: boolean("is_read").notNull().default(false),
    /**
     * Set by the dispatch job once it has *tried*, whether or not anything
     * went. A row is claimed exactly once either way — retrying forever is how
     * one bad phone number stops every other notification behind it.
     */
    dispatchedAt: ts("dispatched_at"),
    /**
     * What actually happened, so somebody can answer "did they hear about
     * this?" without reading logs.
     *
     * `deliveryChannel` is what got through — "push", "sms", "push+sms", or
     * "none". `deliveryNote` is why, when the answer is none: an unconfigured
     * provider, a dead handset, a rejected number.
     */
    deliveryChannel: text("delivery_channel"),
    deliveryNote: text("delivery_note"),
    ...timestamps,
  },
  (t) => [
    index("ix_notification_user").on(t.userId, t.isRead, t.createdAt),
    // The dispatch job's claim query: undelivered rows, oldest first.
    index("ix_notification_pending")
      .on(t.createdAt)
      .where(sql`${t.dispatchedAt} IS NULL`),
  ],
);
