/**
 * What customers browse.
 *
 * Selecting a catalogue item does not place an order — it starts a lead
 * pre-loaded with that selection, and a vendor then makes the exact piece. So
 * prices here are indicative starting rates, and the real number always comes
 * from a quote.
 */
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
import type { ProductOption } from "@repo/types";
import { fk, primaryId, timestamps } from "./_shared";
import { cities } from "./geo";
import { clients } from "./identity";
import { domains } from "./domains";
import { priceUnit } from "./enums";

export const productCategories = pgTable(
  "product_categories",
  {
    id: primaryId(),
    domainId: fk("domain_id")
      .notNull()
      .references(() => domains.id),
    parentId: fk("parent_id"),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    description: text("description").notNull().default(""),
    imageUrl: text("image_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("uq_product_category_slug").on(t.slug),
    index("ix_product_category_domain").on(t.domainId, t.isActive),
  ],
);

export const products = pgTable(
  "products",
  {
    id: primaryId(),
    domainId: fk("domain_id")
      .notNull()
      .references(() => domains.id),
    categoryId: fk("category_id")
      .notNull()
      .references(() => productCategories.id),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    shortDescription: text("short_description").notNull().default(""),
    description: text("description").notNull().default(""),
    /** Indicative starting price. The final price always comes from a quote. */
    basePrice: integer("base_price").notNull(),
    priceUnit: priceUnit("price_unit").notNull(),
    leadTimeDays: integer("lead_time_days").notNull().default(0),
    isCustomisable: boolean("is_customisable").notNull().default(true),
    /** Spec sheet and customisation axes: edited whole, never queried into. */
    specs: jsonb("specs").$type<Record<string, string>>().notNull().default({}),
    options: jsonb("options").$type<ProductOption[]>().notNull().default([]),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    isFeatured: boolean("is_featured").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    ratingX10: integer("rating_x10").notNull().default(0),
    ratingCount: integer("rating_count").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("uq_product_slug").on(t.slug),
    index("ix_product_domain").on(t.domainId, t.isActive),
    index("ix_product_category").on(t.categoryId, t.isActive),
    index("ix_product_featured").on(t.isFeatured, t.ratingX10),
  ],
);

/** City-wise overrides — labour and material rates are not uniform. */
export const productCityPrices = pgTable(
  "product_city_prices",
  {
    id: primaryId(),
    productId: fk("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    cityId: fk("city_id")
      .notNull()
      .references(() => cities.id),
    price: integer("price").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("uq_product_city_price").on(t.productId, t.cityId)],
);

export const servicePackages = pgTable(
  "service_packages",
  {
    id: primaryId(),
    domainId: fk("domain_id")
      .notNull()
      .references(() => domains.id),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    shortDescription: text("short_description").notNull().default(""),
    description: text("description").notNull().default(""),
    price: integer("price").notNull(),
    /** What the price is anchored to, e.g. "per 2BHK", "per 1000 sq.ft". */
    priceBasis: text("price_basis").notNull(),
    durationDays: integer("duration_days").notNull().default(0),
    inclusions: jsonb("inclusions").$type<string[]>().notNull().default([]),
    exclusions: jsonb("exclusions").$type<string[]>().notNull().default([]),
    isFeatured: boolean("is_featured").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    badge: text("badge"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("uq_package_slug").on(t.slug),
    index("ix_package_domain").on(t.domainId, t.isActive),
  ],
);

export const packageItems = pgTable(
  "package_items",
  {
    id: primaryId(),
    packageId: fk("package_id")
      .notNull()
      .references(() => servicePackages.id, { onDelete: "cascade" }),
    productId: fk("product_id").references(() => products.id),
    /** Used when the line is not a catalogue product, e.g. "Site supervision". */
    label: text("label").notNull(),
    quantity: integer("quantity").notNull().default(1),
    ...timestamps,
  },
  (t) => [index("ix_package_item_package").on(t.packageId)],
);

export const savedItems = pgTable(
  "saved_items",
  {
    id: primaryId(),
    clientId: fk("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    productId: fk("product_id").references(() => products.id),
    packageId: fk("package_id").references(() => servicePackages.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("uq_saved_product").on(t.clientId, t.productId),
    uniqueIndex("uq_saved_package").on(t.clientId, t.packageId),
  ],
);
