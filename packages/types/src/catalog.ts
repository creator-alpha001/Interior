/** The browsable catalogue: products, options, packages and saved items. */
import type { z } from "zod";
import type {
  packageItemSchema,
  priceUnitSchema,
  productCategorySchema,
  productCityPriceSchema,
  productOptionSchema,
  productOptionValueSchema,
  productSchema,
  savedItemSchema,
  servicePackageSchema,
} from "./schema/catalog";

/**
 * Different trades price differently, so the unit is part of the product,
 * not an assumption baked into the UI.
 */
export type PriceUnit = z.infer<typeof priceUnitSchema>;

export type ProductCategory = z.infer<typeof productCategorySchema>;

/**
 * A catalogue item the customer can browse and select. Selecting one does not
 * place an order — it starts a lead pre-loaded with that selection, and the
 * vendor then makes the exact piece for the customer.
 */
export type Product = z.infer<typeof productSchema>;

/** A customisation axis: Size, Material, Finish, Colour... */
export type ProductOption = z.infer<typeof productOptionSchema>;

export type ProductOptionValue = z.infer<typeof productOptionValueSchema>;

/** City-wise price overrides — labour and material rates are not uniform. */
export type ProductCityPrice = z.infer<typeof productCityPriceSchema>;

/**
 * A bundle sold as one proposition, e.g. "2BHK Essential Interior Package"
 * or "Full Home Repainting — 3BHK".
 */
export type ServicePackage = z.infer<typeof servicePackageSchema>;

export type PackageItem = z.infer<typeof packageItemSchema>;

/** Saved/wishlisted catalogue items for a logged-in client. */
export type SavedItem = z.infer<typeof savedItemSchema>;
