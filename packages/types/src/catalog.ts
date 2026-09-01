import type { BaseRecord, ID, MediaAsset, Rupees } from "./common";

/**
 * Different trades price differently, so the unit is part of the product,
 * not an assumption baked into the UI.
 */
export type PriceUnit =
  | "per_piece"
  | "per_sqft"
  | "per_running_ft"
  | "per_kg"
  | "per_room"
  | "per_project";

export interface ProductCategory extends BaseRecord {
  id: ID;
  domainId: ID;
  parentId: ID | null;
  name: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

/**
 * A catalogue item the customer can browse and select. Selecting one does not
 * place an order — it starts a lead pre-loaded with that selection, and the
 * vendor then makes the exact piece for the customer.
 */
export interface Product extends BaseRecord {
  id: ID;
  domainId: ID;
  categoryId: ID;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  media: MediaAsset[];
  /** Indicative starting price. Final price always comes from the vendor quote. */
  basePrice: Rupees;
  priceUnit: PriceUnit;
  leadTimeDays: number;
  isCustomisable: boolean;
  /** Key/value spec sheet, e.g. { Material: "Solid sheesham", Finish: "Matte PU" } */
  specs: Record<string, string>;
  options: ProductOption[];
  tags: string[];
  isFeatured: boolean;
  isActive: boolean;
  rating: number;
  ratingCount: number;
}

/** A customisation axis: Size, Material, Finish, Colour... */
export interface ProductOption {
  id: ID;
  name: string;
  values: ProductOptionValue[];
}

export interface ProductOptionValue {
  id: ID;
  label: string;
  /** Added to (or subtracted from) the base price when chosen. */
  priceDelta: Rupees;
}

/** City-wise price overrides — labour and material rates are not uniform. */
export interface ProductCityPrice extends BaseRecord {
  id: ID;
  productId: ID;
  cityId: ID;
  price: Rupees;
}

/**
 * A bundle sold as one proposition, e.g. "2BHK Essential Interior Package"
 * or "Full Home Repainting — 3BHK".
 */
export interface ServicePackage extends BaseRecord {
  id: ID;
  domainId: ID;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  media: MediaAsset[];
  price: Rupees;
  /** What the price is anchored to, e.g. "per 2BHK", "per 1000 sq.ft". */
  priceBasis: string;
  durationDays: number;
  inclusions: string[];
  exclusions: string[];
  isFeatured: boolean;
  isActive: boolean;
  badge: string | null;
}

export interface PackageItem extends BaseRecord {
  id: ID;
  packageId: ID;
  productId: ID | null;
  /** Used when the line is not a catalogue product, e.g. "Site supervision". */
  label: string;
  quantity: number;
}

/** Saved/wishlisted catalogue items for a logged-in client. */
export interface SavedItem extends BaseRecord {
  id: ID;
  clientId: ID;
  productId: ID | null;
  packageId: ID | null;
}
