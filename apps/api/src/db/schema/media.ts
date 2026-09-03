/**
 * Uploaded files, as rows rather than URLs embedded in their owners.
 *
 * The frontend types carry `MediaAsset[]` inline, and the mappers hydrate this
 * table back into that shape. It is a table because uploads now go through a
 * ticket flow: a file exists before the form that references it is submitted,
 * needs an access rule of its own, and has to be sweepable when nothing ends up
 * pointing at it.
 */
import { index, integer, pgTable, text, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { fk, primaryId, timestamps, ts } from "./_shared";
import { users } from "./identity";
import { mediaType, uploadPurpose } from "./enums";

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: primaryId(),
    purpose: uploadPurpose("purpose").notNull(),
    type: mediaType("type").notNull(),
    /** Key within the bucket. The public URL is derived, never stored. */
    storageKey: text("storage_key").notNull(),
    contentType: varchar("content_type", { length: 100 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    caption: text("caption"),
    uploadedByUserId: fk("uploaded_by_user_id").references(() => users.id),
    /**
     * Null until the browser confirms the PUT succeeded. An unconfirmed row is
     * a ticket that was issued and possibly never used — the orphan sweep
     * removes those.
     */
    confirmedAt: ts("confirmed_at"),
    /**
     * What this file belongs to, once a form referencing it is submitted.
     * Polymorphic because five unrelated entities own media and none of them
     * owns enough of it to justify five join tables.
     */
    ownerType: varchar("owner_type", { length: 40 }),
    ownerId: fk("owner_id"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("uq_media_storage_key").on(t.storageKey),
    index("ix_media_owner").on(t.ownerType, t.ownerId, t.sortOrder),
    index("ix_media_orphans").on(t.confirmedAt, t.ownerId),
  ],
);
