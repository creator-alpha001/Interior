/**
 * The public read surface: catalogue, packages, blog, directory, search.
 *
 * These are the endpoints `@repo/data` already calls when NEXT_PUBLIC_API_URL is
 * set, so the paths and query names here are not a proposal — they are what the
 * frontend sends today. Changing one changes a live caller.
 */
import { z } from "zod";
import {
  bannerSchema,
  blogCategorySchema,
  blogPostViewSchema,
  blogTagSchema,
  citySchema,
  stateSchema,
  domainSchema,
  packageViewSchema,
  portfolioItemSchema,
  productCategorySchema,
  productViewSchema,
  professionalProfileSchema,
  professionalSummarySchema,
  searchResultsSchema,
  testimonialSchema,
} from "@repo/types/schema";
import { boolQuerySchema, csvSchema, paginationSchema, slugSchema } from "./common";
import {
  catalogueCountSchema,
  paginatedSchema,
  platformStatsSchema,
  searchSuggestionSchema,
} from "./responses";
import { route } from "./http";

export const productQuerySchema = paginationSchema.extend({
  domain: slugSchema.optional(),
  category: slugSchema.optional(),
  search: z.string().trim().max(120).optional(),
  tags: csvSchema,
  city: z.string().uuid().optional(),
  /** Both bounds apply to the price for the chosen city, not the base price. */
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().positive().optional(),
  /** Stars, 0 to 5. An item nobody has rated is left out once this is set. */
  minRating: z.coerce.number().min(0).max(5).optional(),
  sort: z.enum(["featured", "price_asc", "price_desc", "rating"]).default("featured"),
});

export const professionalQuerySchema = paginationSchema.extend({
  domain: slugSchema.optional(),
  city: z.string().uuid().optional(),
  search: z.string().trim().max(120).optional(),
  verifiedOnly: boolQuerySchema,
  /** Stars, 0 to 5, against the vendor's overall rating. Unrated vendors are left out once set. */
  minRating: z.coerce.number().min(0).max(5).optional(),
  minExperience: z.coerce.number().int().min(0).max(60).optional(),
  sort: z.enum(["rating", "experience", "projects"]).default("rating"),
});

export const postQuerySchema = paginationSchema.extend({
  category: slugSchema.optional(),
  tag: slugSchema.optional(),
  domain: slugSchema.optional(),
  search: z.string().trim().max(120).optional(),
});

const slugParam = z.object({ slug: slugSchema });
const idParam = z.object({ id: z.string().uuid() });

export const catalogueRoutes = {
  listDomains: route({
    method: "GET",
    path: "/domains",
    audience: "public",
    query: z.object({}),
    tags: ["domains"],
    response: z.array(domainSchema),
  }),
  getDomain: route({
    method: "GET",
    path: "/domains/:slug",
    audience: "public",
    params: slugParam,
    tags: ["domains"],
    response: domainSchema,
  }),
  listCities: route({
    method: "GET",
    path: "/cities",
    audience: "public",
    query: z.object({}),
    tags: ["cities"],
    response: z.array(citySchema),
  }),

  /**
   * The states we serve, for a picker that asks state before district.
   *
   * Active ones only, and only those with an active district in them: a state
   * offered with nothing behind it is a dead end a customer reaches before
   * finding out.
   */
  listStates: route({
    method: "GET",
    path: "/states",
    audience: "public",
    query: z.object({}),
    tags: ["cities"],
    response: z.array(stateSchema),
  }),

  listProducts: route({
    method: "GET",
    path: "/products",
    audience: "public",
    query: productQuerySchema,
    tags: ["products"],
    response: paginatedSchema(productViewSchema),
  }),
  getProduct: route({
    method: "GET",
    path: "/products/:slug",
    audience: "public",
    params: slugParam,
    query: z.object({ city: z.string().uuid().optional() }),
    tags: ["products"],
    response: productViewSchema,
  }),
  listRelatedProducts: route({
    method: "GET",
    path: "/products/:id/related",
    audience: "public",
    params: idParam,
    query: z.object({
      city: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(24).default(4),
    }),
    tags: ["products"],
    response: z.array(productViewSchema),
  }),
  listCategories: route({
    method: "GET",
    path: "/categories",
    audience: "public",
    query: z.object({ domain: slugSchema.optional() }),
    tags: ["categories"],
    response: z.array(productCategorySchema),
  }),

  listPackages: route({
    method: "GET",
    path: "/packages",
    audience: "public",
    query: z.object({
      domain: slugSchema.optional(),
      featured: boolQuerySchema,
      limit: z.coerce.number().int().min(1).max(50).optional(),
    }),
    tags: ["packages"],
    response: z.array(packageViewSchema),
  }),
  getPackage: route({
    method: "GET",
    path: "/packages/:slug",
    audience: "public",
    params: slugParam,
    tags: ["packages"],
    response: packageViewSchema,
  }),
  catalogueCounts: route({
    method: "GET",
    path: "/catalogue/counts",
    audience: "public",
    query: z.object({}),
    tags: ["products", "packages"],
    response: z.array(catalogueCountSchema),
  }),

  listProfessionals: route({
    method: "GET",
    path: "/professionals",
    audience: "public",
    query: professionalQuerySchema,
    tags: ["professionals"],
    response: paginatedSchema(professionalSummarySchema),
  }),
  getProfessional: route({
    method: "GET",
    path: "/professionals/:id",
    audience: "public",
    params: idParam,
    tags: ["professionals"],
    response: professionalProfileSchema,
  }),
  listPortfolio: route({
    method: "GET",
    path: "/portfolio",
    audience: "public",
    query: z.object({
      domain: slugSchema.optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }),
    tags: ["portfolio"],
    response: z.array(portfolioItemSchema),
  }),
  platformStats: route({
    method: "GET",
    path: "/stats",
    audience: "public",
    query: z.object({}),
    tags: ["stats"],
    response: platformStatsSchema,
  }),

  listPosts: route({
    method: "GET",
    path: "/posts",
    audience: "public",
    query: postQuerySchema,
    tags: ["posts"],
    response: paginatedSchema(blogPostViewSchema),
  }),
  getPost: route({
    method: "GET",
    path: "/posts/:slug",
    audience: "public",
    params: slugParam,
    tags: ["posts"],
    response: blogPostViewSchema,
  }),
  listRelatedPosts: route({
    method: "GET",
    path: "/posts/:id/related",
    audience: "public",
    params: idParam,
    query: z.object({ limit: z.coerce.number().int().min(1).max(12).default(3) }),
    tags: ["posts"],
    response: z.array(blogPostViewSchema),
  }),
  listPostCategories: route({
    method: "GET",
    path: "/posts/categories",
    audience: "public",
    query: z.object({}),
    tags: ["posts"],
    response: z.array(blogCategorySchema),
  }),
  listPostTags: route({
    method: "GET",
    path: "/posts/tags",
    audience: "public",
    query: z.object({}),
    tags: ["posts"],
    response: z.array(blogTagSchema),
  }),

  listBanners: route({
    method: "GET",
    path: "/banners",
    audience: "public",
    query: z.object({}),
    tags: ["banners"],
    response: z.array(bannerSchema),
  }),
  listTestimonials: route({
    method: "GET",
    path: "/testimonials",
    audience: "public",
    query: z.object({}),
    tags: ["testimonials"],
    response: z.array(testimonialSchema),
  }),

  search: route({
    method: "GET",
    path: "/search",
    audience: "public",
    query: z.object({
      q: z.string().trim().max(120),
      city: z.string().uuid().optional(),
    }),
    response: searchResultsSchema,
  }),
  searchSuggest: route({
    method: "GET",
    path: "/search/suggest",
    audience: "public",
    query: z.object({ q: z.string().trim().max(120) }),
    response: z.array(searchSuggestionSchema),
  }),
} as const;
