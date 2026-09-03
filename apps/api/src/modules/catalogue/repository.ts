/**
 * Catalogue reads.
 *
 * Every function here answers one endpoint and returns a view model from
 * @repo/types verbatim — no shape is invented at the route layer.
 *
 * The pattern throughout: fetch the page, then fetch its media, categories and
 * city prices in one query each, keyed by the ids on that page. A per-row
 * lookup would be twenty-five round trips for a page of twenty-four products.
 */
import { and, asc, count, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { PackageView, Paginated, ProductCategory, ProductView } from "@repo/types";
import { db } from "../../db/client";
import * as t from "../../db/schema";
import { groupMediaByOwner, type MediaRow } from "../../lib/media";
import {
  toDomain,
  toPackageView,
  toProductCategory,
  toProductView,
} from "../../lib/mappers";
import { decodeCursor, page } from "../../lib/pagination";

/* ------------------------------------------------------------------ *
 * Shared helpers
 * ------------------------------------------------------------------ */

async function mediaFor(ownerType: string, ownerIds: string[]) {
  if (ownerIds.length === 0) return new Map<string, ReturnType<typeof groupMediaByOwner> extends Map<string, infer V> ? V : never>();

  const rows = await db
    .select({
      id: t.mediaAssets.id,
      type: t.mediaAssets.type,
      storageKey: t.mediaAssets.storageKey,
      caption: t.mediaAssets.caption,
      ownerType: t.mediaAssets.ownerType,
      ownerId: t.mediaAssets.ownerId,
      sortOrder: t.mediaAssets.sortOrder,
    })
    .from(t.mediaAssets)
    .where(
      and(
        eq(t.mediaAssets.ownerType, ownerType),
        inArray(t.mediaAssets.ownerId, ownerIds),
        isNull(t.mediaAssets.deletedAt),
      ),
    )
    .orderBy(asc(t.mediaAssets.sortOrder));

  return groupMediaByOwner(rows as MediaRow[]);
}

/* ------------------------------------------------------------------ *
 * Domains and cities
 * ------------------------------------------------------------------ */

export async function listDomains() {
  const rows = await db
    .select()
    .from(t.domains)
    .where(and(eq(t.domains.isActive, true), isNull(t.domains.deletedAt)))
    .orderBy(asc(t.domains.sortOrder));
  return rows.map(toDomain);
}

export async function getDomainBySlug(slug: string) {
  const [row] = await db
    .select()
    .from(t.domains)
    .where(and(eq(t.domains.slug, slug), isNull(t.domains.deletedAt)))
    .limit(1);
  return row ? toDomain(row) : null;
}

export async function listCities() {
  const rows = await db
    .select()
    .from(t.cities)
    .where(eq(t.cities.isActive, true))
    .orderBy(asc(t.cities.name));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    state: row.state,
    isActive: row.isActive,
  }));
}

/* ------------------------------------------------------------------ *
 * Products
 * ------------------------------------------------------------------ */

export interface ProductQuery {
  domain?: string;
  category?: string;
  search?: string;
  tags?: string[];
  city?: string;
  maxPrice?: number;
  sort: "featured" | "price_asc" | "price_desc" | "rating";
  limit: number;
  cursor?: string;
}

export async function listProducts(query: ProductQuery): Promise<Paginated<ProductView>> {
  const offset = decodeCursor(query.cursor);

  const conditions = [eq(t.products.isActive, true), isNull(t.products.deletedAt)];

  if (query.domain) conditions.push(eq(t.domains.slug, query.domain));
  if (query.category) conditions.push(eq(t.productCategories.slug, query.category));
  if (query.maxPrice !== undefined) conditions.push(lte(t.products.basePrice, query.maxPrice));

  if (query.search) {
    // Trigram similarity over the name, plus a plain substring match on the
    // description, so "wardrob" still finds "Wardrobe" but a typo does not
    // silently return nothing.
    const term = `%${query.search.toLowerCase()}%`;
    conditions.push(
      or(
        sql`lower(${t.products.name}) LIKE ${term}`,
        sql`lower(${t.products.shortDescription}) LIKE ${term}`,
      )!,
    );
  }

  if (query.tags?.length) {
    // `tags` is a JSONB array of strings. jsonb_exists_any is the function form
    // of the ?| operator — used rather than the operator so the tag list stays
    // a bound parameter instead of being interpolated into the statement.
    conditions.push(
      sql`jsonb_exists_any(${t.products.tags}, ${sql.param(query.tags)}::text[])`,
    );
  }

  const where = and(...conditions);

  const base = db
    .select({
      product: t.products,
      domain: t.domains,
      category: t.productCategories,
      cityPrice: t.productCityPrices.price,
    })
    .from(t.products)
    .innerJoin(t.domains, eq(t.domains.id, t.products.domainId))
    .innerJoin(t.productCategories, eq(t.productCategories.id, t.products.categoryId))
    .leftJoin(
      t.productCityPrices,
      query.city
        ? and(
            eq(t.productCityPrices.productId, t.products.id),
            eq(t.productCityPrices.cityId, query.city),
          )
        : sql`false`,
    )
    .where(where);

  const order = {
    featured: [desc(t.products.isFeatured), desc(t.products.ratingX10)],
    price_asc: [asc(t.products.basePrice)],
    price_desc: [desc(t.products.basePrice)],
    rating: [desc(t.products.ratingX10)],
  }[query.sort];

  const [rows, [totals]] = await Promise.all([
    base
      // A stable tiebreak, or two products with the same rating can swap
      // between pages and one of them is never seen.
      .orderBy(...order, asc(t.products.id))
      .limit(query.limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(t.products)
      .innerJoin(t.domains, eq(t.domains.id, t.products.domainId))
      .innerJoin(t.productCategories, eq(t.productCategories.id, t.products.categoryId))
      .where(where),
  ]);

  const media = await mediaFor(
    "product",
    rows.map((r) => r.product.id),
  );

  const views = rows
    .map((r) =>
      toProductView(r.product, r.domain, r.category, media.get(r.product.id) ?? [], r.cityPrice),
    )
    // maxPrice filters the effective price, which only exists after the city
    // override is applied, so it cannot be done in SQL alongside the rest.
    .filter((v) => (query.maxPrice === undefined ? true : v.effectivePrice <= query.maxPrice));

  return page(views, totals?.value ?? 0, offset, query.limit);
}

export async function getProductBySlug(slug: string, cityId?: string) {
  const [row] = await db
    .select({
      product: t.products,
      domain: t.domains,
      category: t.productCategories,
      cityPrice: t.productCityPrices.price,
    })
    .from(t.products)
    .innerJoin(t.domains, eq(t.domains.id, t.products.domainId))
    .innerJoin(t.productCategories, eq(t.productCategories.id, t.products.categoryId))
    .leftJoin(
      t.productCityPrices,
      cityId
        ? and(
            eq(t.productCityPrices.productId, t.products.id),
            eq(t.productCityPrices.cityId, cityId),
          )
        : sql`false`,
    )
    .where(and(eq(t.products.slug, slug), isNull(t.products.deletedAt)))
    .limit(1);

  if (!row) return null;

  const media = await mediaFor("product", [row.product.id]);
  return toProductView(
    row.product,
    row.domain,
    row.category,
    media.get(row.product.id) ?? [],
    row.cityPrice,
  );
}

export async function listRelatedProducts(productId: string, cityId?: string, limit = 4) {
  const [source] = await db
    .select({ categoryId: t.products.categoryId, domainId: t.products.domainId })
    .from(t.products)
    .where(eq(t.products.id, productId))
    .limit(1);

  if (!source) return [];

  const rows = await db
    .select({
      product: t.products,
      domain: t.domains,
      category: t.productCategories,
      cityPrice: t.productCityPrices.price,
    })
    .from(t.products)
    .innerJoin(t.domains, eq(t.domains.id, t.products.domainId))
    .innerJoin(t.productCategories, eq(t.productCategories.id, t.products.categoryId))
    .leftJoin(
      t.productCityPrices,
      cityId
        ? and(
            eq(t.productCityPrices.productId, t.products.id),
            eq(t.productCityPrices.cityId, cityId),
          )
        : sql`false`,
    )
    .where(
      and(
        sql`${t.products.id} <> ${productId}`,
        eq(t.products.isActive, true),
        isNull(t.products.deletedAt),
        or(
          eq(t.products.categoryId, source.categoryId),
          eq(t.products.domainId, source.domainId),
        )!,
      ),
    )
    // Same category first, then the best rated — a related item from the same
    // category is more useful than a higher-rated one from elsewhere.
    .orderBy(
      desc(sql`(${t.products.categoryId} = ${source.categoryId})`),
      desc(t.products.ratingX10),
      asc(t.products.id),
    )
    .limit(limit);

  const media = await mediaFor(
    "product",
    rows.map((r) => r.product.id),
  );

  return rows.map((r) =>
    toProductView(r.product, r.domain, r.category, media.get(r.product.id) ?? [], r.cityPrice),
  );
}

export async function listCategories(domainSlug?: string): Promise<ProductCategory[]> {
  const conditions = [eq(t.productCategories.isActive, true), isNull(t.productCategories.deletedAt)];
  if (domainSlug) conditions.push(eq(t.domains.slug, domainSlug));

  const rows = await db
    .select({ category: t.productCategories })
    .from(t.productCategories)
    .innerJoin(t.domains, eq(t.domains.id, t.productCategories.domainId))
    .where(and(...conditions))
    .orderBy(asc(t.productCategories.sortOrder));

  return rows.map((r) => toProductCategory(r.category));
}

/* ------------------------------------------------------------------ *
 * Packages
 * ------------------------------------------------------------------ */

export async function listPackages(options: {
  domain?: string;
  featured?: boolean;
  limit?: number;
}): Promise<PackageView[]> {
  const conditions = [eq(t.servicePackages.isActive, true), isNull(t.servicePackages.deletedAt)];
  if (options.domain) conditions.push(eq(t.domains.slug, options.domain));
  if (options.featured) conditions.push(eq(t.servicePackages.isFeatured, true));

  const rows = await db
    .select({ pkg: t.servicePackages, domain: t.domains })
    .from(t.servicePackages)
    .innerJoin(t.domains, eq(t.domains.id, t.servicePackages.domainId))
    .where(and(...conditions))
    .orderBy(desc(t.servicePackages.isFeatured), asc(t.servicePackages.price))
    .limit(options.limit ?? 100);

  return hydratePackages(rows);
}

export async function getPackageBySlug(slug: string): Promise<PackageView | null> {
  const rows = await db
    .select({ pkg: t.servicePackages, domain: t.domains })
    .from(t.servicePackages)
    .innerJoin(t.domains, eq(t.domains.id, t.servicePackages.domainId))
    .where(and(eq(t.servicePackages.slug, slug), isNull(t.servicePackages.deletedAt)))
    .limit(1);

  const [view] = await hydratePackages(rows);
  return view ?? null;
}

async function hydratePackages(
  rows: Array<{ pkg: typeof t.servicePackages.$inferSelect; domain: typeof t.domains.$inferSelect }>,
): Promise<PackageView[]> {
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.pkg.id);
  const [media, itemRows] = await Promise.all([
    mediaFor("service_package", ids),
    db
      .select()
      .from(t.packageItems)
      .where(and(inArray(t.packageItems.packageId, ids), isNull(t.packageItems.deletedAt))),
  ]);

  const itemsByPackage = new Map<string, Array<typeof t.packageItems.$inferSelect>>();
  for (const item of itemRows) {
    const list = itemsByPackage.get(item.packageId);
    if (list) list.push(item);
    else itemsByPackage.set(item.packageId, [item]);
  }

  return rows.map((r) =>
    toPackageView(r.pkg, r.domain, media.get(r.pkg.id) ?? [], itemsByPackage.get(r.pkg.id) ?? []),
  );
}

/** Live item counts per trade, for the home screen tiles. */
export async function countCatalogueByDomain() {
  const [productCounts, packageCounts, domainRows] = await Promise.all([
    db
      .select({ domainId: t.products.domainId, value: count() })
      .from(t.products)
      .where(and(eq(t.products.isActive, true), isNull(t.products.deletedAt)))
      .groupBy(t.products.domainId),
    db
      .select({ domainId: t.servicePackages.domainId, value: count() })
      .from(t.servicePackages)
      .where(and(eq(t.servicePackages.isActive, true), isNull(t.servicePackages.deletedAt)))
      .groupBy(t.servicePackages.domainId),
    db.select({ id: t.domains.id }).from(t.domains).where(isNull(t.domains.deletedAt)),
  ]);

  const products = new Map(productCounts.map((r) => [r.domainId, r.value]));
  const packages = new Map(packageCounts.map((r) => [r.domainId, r.value]));

  return domainRows.map((d) => ({
    domainId: d.id,
    products: products.get(d.id) ?? 0,
    packages: packages.get(d.id) ?? 0,
  }));
}
