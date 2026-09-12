/**
 * Where the platform works: states, and the districts inside them.
 *
 * A table rather than free text, because these drive vendor matching,
 * catalogue pricing and every report — "Bengaluru" and "Bangalore" must not be
 * able to diverge.
 *
 * **The `cities` table holds districts.** The product says district and the
 * screens say District; the table and its columns still say city, because the
 * name reaches 558 places across the web, the API and the phone, and renaming
 * them is a mechanical change worth doing on its own rather than smuggled into
 * a feature. The row is the same row either way: one place we serve, with one
 * set of prices and one pool of vendors.
 */
import { boolean, pgTable, text, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { fk, primaryId } from "./_shared";

export const states = pgTable(
  "states",
  {
    id: primaryId(),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    /**
     * Off hides the state and everything under it from every customer-facing
     * picker. Nothing is deleted: a state is referenced by districts, which are
     * referenced by customers, requirements, posted work and prices.
     */
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [uniqueIndex("uq_states_slug").on(t.slug)],
);

/** A district. See the note above about the name. */
export const cities = pgTable(
  "cities",
  {
    id: primaryId(),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),

    /**
     * The state's name, kept in step with `stateId`.
     *
     * Redundant on purpose, for now: `City.state` is read by the web, the app
     * and the ops panel, and dropping it would be that rename in disguise.
     * Every write sets both, so they cannot drift.
     */
    state: text("state").notNull(),
    stateId: fk("state_id")
      .notNull()
      .references(() => states.id),

    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [uniqueIndex("uq_cities_slug").on(t.slug)],
);
