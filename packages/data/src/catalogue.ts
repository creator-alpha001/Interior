import type { PackageView, ProductCategory, ProductView } from "@repo/types";
import { toPackageView, toProductView } from "./mappers";
import { delay, store } from "./store";

export interface ProductQuery {
  domainSlug?: string;
  categorySlug?: string;
  search?: string;
  tags?: string[];
  cityId?: string;
  maxPrice?: number;
  sort?: "featured" | "price_asc" | "price_desc" | "rating";
  limit?: number;
}

export async function listProducts(query: ProductQuery = {}): Promise<ProductView[]> {
  const domain = query.domainSlug
    ? store.domains.find((d) => d.slug === query.domainSlug)
    : undefined;
  const category = query.categorySlug
    ? store.productCategories.find((c) => c.slug === query.categorySlug)
    : undefined;
  const search = query.search?.trim().toLowerCase();

  let views = store.products
    .filter((p) => p.isActive)
    .filter((p) => (domain ? p.domainId === domain.id : true))
    .filter((p) => (category ? p.categoryId === category.id : true))
    .filter((p) =>
      query.tags?.length ? query.tags.some((t) => p.tags.includes(t)) : true,
    )
    .filter((p) =>
      search
        ? `${p.name} ${p.shortDescription} ${p.tags.join(" ")}`.toLowerCase().includes(search)
        : true,
    )
    .map((p) => toProductView(p.id, query.cityId));

  if (query.maxPrice) {
    views = views.filter((v) => v.effectivePrice <= query.maxPrice!);
  }

  const sorters: Record<string, (a: ProductView, b: ProductView) => number> = {
    featured: (a, b) =>
      Number(b.product.isFeatured) - Number(a.product.isFeatured) ||
      b.product.rating - a.product.rating,
    price_asc: (a, b) => a.effectivePrice - b.effectivePrice,
    price_desc: (a, b) => b.effectivePrice - a.effectivePrice,
    rating: (a, b) => b.product.rating - a.product.rating,
  };
  views.sort(sorters[query.sort ?? "featured"]);

  return delay(query.limit ? views.slice(0, query.limit) : views);
}

export async function getProductBySlug(
  slug: string,
  cityId?: string,
): Promise<ProductView | null> {
  const product = store.products.find((p) => p.slug === slug);
  return delay(product ? toProductView(product.id, cityId) : null);
}

export async function listRelatedProducts(
  productId: string,
  cityId?: string,
  limit = 4,
): Promise<ProductView[]> {
  const product = store.products.find((p) => p.id === productId);
  if (!product) return delay([]);
  const related = store.products
    .filter((p) => p.id !== productId && p.isActive)
    .filter((p) => p.categoryId === product.categoryId || p.domainId === product.domainId)
    .sort(
      (a, b) =>
        Number(b.categoryId === product.categoryId) - Number(a.categoryId === product.categoryId) ||
        b.rating - a.rating,
    )
    .slice(0, limit);
  return delay(related.map((p) => toProductView(p.id, cityId)));
}

export async function listCategories(domainSlug?: string): Promise<ProductCategory[]> {
  const domain = domainSlug ? store.domains.find((d) => d.slug === domainSlug) : undefined;
  return delay(
    store.productCategories
      .filter((c) => c.isActive)
      .filter((c) => (domain ? c.domainId === domain.id : true))
      .sort((a, b) => a.sortOrder - b.sortOrder),
  );
}

export async function listPackages(domainSlug?: string): Promise<PackageView[]> {
  const domain = domainSlug ? store.domains.find((d) => d.slug === domainSlug) : undefined;
  return delay(
    store.servicePackages
      .filter((p) => p.isActive)
      .filter((p) => (domain ? p.domainId === domain.id : true))
      .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a.price - b.price)
      .map((p) => toPackageView(p.id)),
  );
}

export async function getPackageBySlug(slug: string): Promise<PackageView | null> {
  const pkg = store.servicePackages.find((p) => p.slug === slug);
  return delay(pkg ? toPackageView(pkg.id) : null);
}

export async function listFeaturedPackages(limit = 6): Promise<PackageView[]> {
  return delay(
    store.servicePackages
      .filter((p) => p.isActive && p.isFeatured)
      .slice(0, limit)
      .map((p) => toPackageView(p.id)),
  );
}

/** Count of live catalogue items per domain, used on the home screen tiles. */
export async function countCatalogueByDomain(): Promise<
  Array<{ domainId: string; products: number; packages: number }>
> {
  return delay(
    store.domains.map((d) => ({
      domainId: d.id,
      products: store.products.filter((p) => p.domainId === d.id && p.isActive).length,
      packages: store.servicePackages.filter((p) => p.domainId === d.id && p.isActive).length,
    })),
  );
}
