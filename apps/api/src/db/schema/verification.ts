/**
 * The documents behind a vendor's verified tag.
 *
 * The signed agreement itself lives on `partner_agreements`; this is everything
 * else that identifies the business signing it. Files are `media_assets` owned
 * by the row (`owner_type = 'vendor_document'`), under the private storage
 * prefix, so they are only ever read through links that expire.
 */
import { sql } from "drizzle-orm";
import { index, pgTable, text, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { fk, primaryId, timestamps, ts } from "./_shared";
import { vendorDocumentKind, vendorDocumentStatus } from "./enums";
import { professionals, users } from "./identity";

export const vendorDocuments = pgTable(
  "vendor_documents",
  {
    id: primaryId(),
    professionalId: fk("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    kind: vendorDocumentKind("kind").notNull(),
    /** PAN, GSTIN or registration number. Never a full Aadhaar number. */
    documentNumber: varchar("document_number", { length: 40 }),
    status: vendorDocumentStatus("status").notNull().default("submitted"),
    submittedAt: ts("submitted_at").notNull().defaultNow(),
    reviewedAt: ts("reviewed_at"),
    reviewedByUserId: fk("reviewed_by_user_id").references(() => users.id),
    /** Written for the vendor to read. Required on a rejection. */
    reviewNote: text("review_note"),
    ...timestamps,
  },
  (t) => [
    // One live document of each kind. A replacement soft-deletes the one before.
    uniqueIndex("uq_vendor_documents_live")
      .on(t.professionalId, t.kind)
      .where(sql`${t.deletedAt} IS NULL`),
    index("ix_vendor_documents_review").on(t.status, t.submittedAt),
  ],
);
