import { z } from "zod";
import { baseRecordSchema, idSchema, mediaAssetSchema, rupeesSchema } from "./common";

/**
 * Different trades price differently, so the unit is part of the product,
 * not an assumption baked into the UI.
 */
export const priceUnitSchema = z.enum([
  "per_piece",
  "per_sqft",
  "per_running_ft",
  "per_kg",
  "per_room",
  "per_project",
]);

export const productCategorySchema = baseRecordSchema.extend({
  id: idSchema,
  domainId: idSchema,
  parentId: idSchema.nullable(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  imageUrl: z.string().nullable(),
  sortOrder: z.number(),
  isActive: z.boolean(),
});

export const productOptionValueSchema = z.object({
  id: idSchema,
  label: z.string(),
  /** Added to (or subtracted from) the base price when chosen. */
  priceDelta: rupeesSchema,
});

/** A customisation axis: Size, Material, Finish, Colour... */
export const productOptionSchema = z.object({
  id: idSchema,
  name: z.string(),
  values: z.array(productOptionValueSchema),
});

/**
 * A catalogue item the customer can browse and select. Selecting one does not
 * place an order — it starts a lead pre-loaded with that selection, and the
 * vendor then makes the exact piece for the customer.
 */
export const productSchema = baseRecordSchema.extend({
  id: idSchema,
  domainId: idSchema,
  categoryId: idSchema,
  name: z.string(),
  slug: z.string(),
  shortDescription: z.string(),
  description: z.string(),
  media: z.array(mediaAssetSchema),
  /** Indicative starting price. Final price always comes from the vendor quote. */
  basePrice: rupeesSchema,
  priceUnit: priceUnitSchema,
  leadTimeDays: z.number(),
  isCustomisable: z.boolean(),
  /** Key/value spec sheet, e.g. { Material: "Solid sheesham", Finish: "Matte PU" } */
  specs: z.record(z.string(), z.string()),
  options: z.array(productOptionSchema),
  tags: z.array(z.string()),
  isFeatured: z.boolean(),
  isActive: z.boolean(),
  rating: z.number(),
  ratingCount: z.number(),
});

/** City-wise price overrides — labour and material rates are not uniform. */
export const productCityPriceSchema = baseRecordSchema.extend({
  id: idSchema,
  productId: idSchema,
  cityId: idSchema,
  price: rupeesSchema,
});

/**
 * A bundle sold as one proposition, e.g. "2BHK Essential Interior Package"
 * or "Full Home Repainting — 3BHK".
 */
export const servicePackageSchema = baseRecordSchema.extend({
  id: idSchema,
  domainId: idSchema,
  name: z.string(),
  slug: z.string(),
  shortDescription: z.string(),
  description: z.string(),
  media: z.array(mediaAssetSchema),
  price: rupeesSchema,
  /** What the price is anchored to, e.g. "per 2BHK", "per 1000 sq.ft". */
  priceBasis: z.string(),
  durationDays: z.number(),
  inclusions: z.array(z.string()),
  exclusions: z.array(z.string()),
  isFeatured: z.boolean(),
  isActive: z.boolean(),
  badge: z.string().nullable(),
});

export const packageItemSchema = baseRecordSchema.extend({
  id: idSchema,
  packageId: idSchema,
  productId: idSchema.nullable(),
  /** Used when the line is not a catalogue product, e.g. "Site supervision". */
  label: z.string(),
  quantity: z.number(),
});

/** Saved/wishlisted catalogue items for a logged-in client. */
export const savedItemSchema = baseRecordSchema.extend({
  id: idSchema,
  clientId: idSchema,
  productId: idSchema.nullable(),
  packageId: idSchema.nullable(),
});
