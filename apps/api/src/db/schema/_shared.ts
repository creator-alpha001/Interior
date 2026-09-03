/**
 * Column patterns every table repeats.
 *
 * `BaseRecord` in @repo/types says every persisted record carries createdAt,
 * updatedAt and a soft-delete marker. Rather than restate that on forty tables,
 * it lives here once.
 */
import { sql } from "drizzle-orm";
import { timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * UUIDv7 primary key.
 *
 * v7 rather than v4 because it is time-ordered: inserts land at the right-hand
 * edge of the index instead of scattering across it, which matters for the
 * tables that only ever grow (messages, notifications, audit_logs).
 */
export const primaryId = () =>
  uuid("id").primaryKey().default(sql`uuid_generate_v7()`);

/** A foreign key column, without the reference — callers add `.references()`. */
export const fk = (name: string) => uuid(name);

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
  /**
   * Soft delete. Nothing on this platform is hard-deleted — support has to be
   * able to reconstruct what a customer saw when they complain about it.
   */
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
};

/** Timestamp column helper for the many nullable event times in the model. */
export const ts = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "string" });
