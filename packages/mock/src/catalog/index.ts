import type { Product } from "@repo/types";
import { fabricationProducts } from "./products.fabrication";
import { furnitureProducts } from "./products.furniture";
import { interiorProducts } from "./products.interior";
import { paintingProducts } from "./products.painting";

export const products: Product[] = [
  ...interiorProducts,
  ...furnitureProducts,
  ...fabricationProducts,
  ...paintingProducts,
];

export { productCategories } from "./categories";
export { packageItems, productCityPrices, servicePackages } from "./packages";
export { priceUnitLabel } from "./product-builder";
