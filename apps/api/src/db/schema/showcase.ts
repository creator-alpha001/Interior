/**
 * What a vendor shows off beyond photographs of work: awards, certifications,
 * memberships, press.
 *
 * Moderated exactly like portfolio items — nothing reaches a public profile
 * until our team approves it — because a certificate a vendor did not earn is
 * worse on the profile than no certificate at all. An optional photograph of it
 * is a `media_assets` row owned by the achievement.
 */
import { sql } from "drizzle-orm";
import { index, integer, pgTable, text } from "drizzle-orm/pg-core";
import { fk, primaryId, timestamps, ts } from "./_shared";
import { moderationStatus, vendorAchievementKind } from "./enums";
import { professionals, users } from "./identity";

export const vendorAchievements = pgTable(
  "vendor_achievements",
  {
    id: primaryId(),
    professionalId: fk("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    kind: vendorAchievementKind("kind").notNull(),
    title: text("title").notNull(),
    /** Who awarded or issued it. */
    issuer: text("issuer").notNull().default(""),
    year: integer("year"),
    description: text("description").notNull().default(""),
    moderationStatus: moderationStatus("moderation_status").notNull().default("pending"),
    reviewNote: text("review_note"),
    reviewedAt: ts("reviewed_at"),
    reviewedByUserId: fk("reviewed_by_user_id").references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index("ix_vendor_achievements_professional").on(t.professionalId),
    index("ix_vendor_achievements_review")
      .on(t.moderationStatus, t.createdAt)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);
