/**
 * Cities are a table, not a free-text field.
 *
 * They drive vendor matching, catalogue pricing and every report, so
 * "Bengaluru" and "Bangalore" must not be able to diverge.
 */
import { boolean, pgTable, text, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { primaryId } from "./_shared";

export const cities = pgTable(
  "cities",
  {
    id: primaryId(),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    state: text("state").notNull(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [uniqueIndex("uq_cities_slug").on(t.slug)],
);
