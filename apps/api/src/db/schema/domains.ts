/**
 * Service verticals, and which vendors are allowed to work in them.
 *
 * Nothing on the platform is hardcoded to four trades. Adding "Electrical Work"
 * is an insert here plus an admin approving vendors for it — not a release.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import type { DomainLabels } from "@repo/types";
import { fk, primaryId, timestamps, ts } from "./_shared";
import { cities } from "./geo";
import { professionals, users } from "./identity";
import { domainApprovalStatus, moderationStatus } from "./enums";

export const domains = pgTable(
  "domains",
  {
    id: primaryId(),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    tagline: text("tagline").notNull().default(""),
    description: text("description").notNull().default(""),
    iconKey: varchar("icon_key", { length: 40 }).notNull(),
    bannerUrl: text("banner_url"),
    defaultCommissionPercent: integer("default_commission_percent").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    /**
     * Column captions that let one compare-quotes component speak each trade's
     * language. Read and written whole, never queried into, so JSONB.
     */
    labels: jsonb("labels").$type<DomainLabels>().notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("uq_domains_slug").on(t.slug)],
);

/**
 * Which trades a vendor is approved for.
 *
 * Approval is per trade and is an admin decision, not self-service — a good
 * carpenter is not automatically a good painter.
 */
export const professionalDomains = pgTable(
  "professional_domains",
  {
    id: primaryId(),
    professionalId: fk("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    domainId: fk("domain_id")
      .notNull()
      .references(() => domains.id),
    verificationStatus: domainApprovalStatus("verification_status").notNull().default("pending"),
    /** Null falls back to domains.default_commission_percent. */
    commissionPercentOverride: integer("commission_percent_override"),
    /** Per-trade rating: the same vendor can be 5* at painting and 4* at carpentry. */
    avgRatingX10: integer("avg_rating_x10").notNull().default(0),
    ratingCount: integer("rating_count").notNull().default(0),
    completedProjects: integer("completed_projects").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("uq_professional_domain").on(t.professionalId, t.domainId),
    index("ix_professional_domain_lookup").on(t.domainId, t.verificationStatus),
  ],
);

/** A vendor can serve several cities, and localities within them. */
export const professionalServiceAreas = pgTable(
  "professional_service_areas",
  {
    id: primaryId(),
    professionalId: fk("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    cityId: fk("city_id")
      .notNull()
      .references(() => cities.id),
    /** Optional narrowing inside a city; empty means the whole city. */
    localities: jsonb("localities").$type<string[]>().notNull().default([]),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("uq_service_area").on(t.professionalId, t.cityId),
    index("ix_service_area_city").on(t.cityId),
  ],
);

export const portfolioItems = pgTable(
  "portfolio_items",
  {
    id: primaryId(),
    professionalId: fk("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    domainId: fk("domain_id")
      .notNull()
      .references(() => domains.id),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    /** Short lines a customer skims: materials, size, how long it took. */
    highlights: text("highlights").array().notNull().default(sql`'{}'`),
    /** The long description, as sanitised HTML. See `lib/html.ts`. */
    details: text("details").notNull().default(""),

    /**
     * **Published on posting, not on approval.**
     *
     * This defaulted to `pending`, and a vendor who photographed a finished
     * kitchen saw nothing on their profile until somebody at Decora Shine
     * looked — which made the feature feel broken and the profiles look
     * empty. Ops keep the lever, in the other direction: `rejected` takes
     * something down, with a note the vendor reads.
     */
    moderationStatus: moderationStatus("moderation_status").notNull().default("approved"),
    /** Where the job was, when the vendor says. */
    cityId: fk("city_id").references(() => cities.id),
    /** Written for the vendor. Required when work is sent back or taken down. */
    reviewNote: text("review_note"),
    reviewedAt: ts("reviewed_at"),
    reviewedByUserId: fk("reviewed_by_user_id").references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index("ix_portfolio_professional").on(t.professionalId),
    index("ix_portfolio_public").on(t.domainId, t.moderationStatus),
  ],
);
