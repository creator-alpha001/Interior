import type { PriceUnit, Product } from "@repo/types";
import { phSet, rec } from "../helpers";

/**
 * Compact seed shape so the catalogue stays readable and easy to extend —
 * adding an item is a handful of lines, not a 40-line object literal.
 */
export interface ProductSeed {
  slug: string;
  name: string;
  categoryId: string;
  short: string;
  description: string;
  price: number;
  unit: PriceUnit;
  leadTimeDays: number;
  specs: Record<string, string>;
  /** Option name -> [label, priceDelta][] */
  options?: Record<string, Array<[string, number]>>;
  tags?: string[];
  featured?: boolean;
  rating?: number;
  ratingCount?: number;
  customisable?: boolean;
  images?: number;
}

export function buildProducts(domainId: string, seeds: ProductSeed[]): Product[] {
  const domainSlug = domainId.replace("dom-", "");
  return seeds.map((s, i) => ({
    ...rec(300 - i, 12),
    id: `prod-${s.slug}`,
    domainId,
    categoryId: s.categoryId,
    name: s.name,
    slug: s.slug,
    shortDescription: s.short,
    description: s.description,
    media: phSet(domainSlug, s.slug, s.images ?? 3),
    basePrice: s.price,
    priceUnit: s.unit,
    leadTimeDays: s.leadTimeDays,
    isCustomisable: s.customisable ?? true,
    specs: s.specs,
    options: Object.entries(s.options ?? {}).map(([name, values], oi) => ({
      id: `opt-${s.slug}-${oi}`,
      name,
      values: values.map(([label, priceDelta], vi) => ({
        id: `optv-${s.slug}-${oi}-${vi}`,
        label,
        priceDelta,
      })),
    })),
    tags: s.tags ?? [],
    isFeatured: s.featured ?? false,
    isActive: true,
    rating: s.rating ?? 4.5,
    ratingCount: s.ratingCount ?? 24,
  }));
}

/** Human label for a price unit, used everywhere a price is shown. */
export const priceUnitLabel: Record<PriceUnit, string> = {
  per_piece: "per piece",
  per_sqft: "per sq.ft",
  per_running_ft: "per running ft",
  per_kg: "per kg",
  per_room: "per room",
  per_project: "per project",
};
