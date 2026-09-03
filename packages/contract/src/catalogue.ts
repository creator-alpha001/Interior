/**
 * The public read surface: catalogue, packages, blog, directory, search.
 *
 * These are the endpoints `@repo/data` already calls when NEXT_PUBLIC_API_URL is
 * set, so the paths and query names here are not a proposal — they are what the
 * frontend sends today. Changing one changes a live caller.
 */
import { z } from "zod";
import { boolQuerySchema, csvSchema, paginationSchema, slugSchema } from "./common";
import { route } from "./http";

export const productQuerySchema = paginationSchema.extend({
  domain: slugSchema.optional(),
  category: slugSchema.optional(),
  search: z.string().trim().max(120).optional(),
  tags: csvSchema,
  city: z.string().uuid().optional(),
  maxPrice: z.coerce.number().int().positive().optional(),
  sort: z.enum(["featured", "price_asc", "price_desc", "rating"]).default("featured"),
});

export const professionalQuerySchema = paginationSchema.extend({
  domain: slugSchema.optional(),
  city: z.string().uuid().optional(),
  search: z.string().trim().max(120).optional(),
  verifiedOnly: boolQuerySchema,
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
  }),
  getDomain: route({
    method: "GET",
    path: "/domains/:slug",
    audience: "public",
    params: slugParam,
    tags: ["domains"],
  }),
  listCities: route({
    method: "GET",
    path: "/cities",
    audience: "public",
    query: z.object({}),
    tags: ["cities"],
  }),

  listProducts: route({
    method: "GET",
    path: "/products",
    audience: "public",
    query: productQuerySchema,
    tags: ["products"],
  }),
  getProduct: route({
    method: "GET",
    path: "/products/:slug",
    audience: "public",
    params: slugParam,
    query: z.object({ city: z.string().uuid().optional() }),
    tags: ["products"],
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
  }),
  listCategories: route({
    method: "GET",
    path: "/categories",
    audience: "public",
    query: z.object({ domain: slugSchema.optional() }),
    tags: ["categories"],
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
  }),
  getPackage: route({
    method: "GET",
    path: "/packages/:slug",
    audience: "public",
    params: slugParam,
    tags: ["packages"],
  }),
  catalogueCounts: route({
    method: "GET",
    path: "/catalogue/counts",
    audience: "public",
    query: z.object({}),
    tags: ["products", "packages"],
  }),

  listProfessionals: route({
    method: "GET",
    path: "/professionals",
    audience: "public",
    query: professionalQuerySchema,
    tags: ["professionals"],
  }),
  getProfessional: route({
    method: "GET",
    path: "/professionals/:id",
    audience: "public",
    params: idParam,
    tags: ["professionals"],
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
  }),
  platformStats: route({
    method: "GET",
    path: "/stats",
    audience: "public",
    query: z.object({}),
    tags: ["stats"],
  }),

  listPosts: route({
    method: "GET",
    path: "/posts",
    audience: "public",
    query: postQuerySchema,
    tags: ["posts"],
  }),
  getPost: route({
    method: "GET",
    path: "/posts/:slug",
    audience: "public",
    params: slugParam,
    tags: ["posts"],
  }),
  listRelatedPosts: route({
    method: "GET",
    path: "/posts/:id/related",
    audience: "public",
    params: idParam,
    query: z.object({ limit: z.coerce.number().int().min(1).max(12).default(3) }),
    tags: ["posts"],
  }),
  listPostCategories: route({
    method: "GET",
    path: "/posts/categories",
    audience: "public",
    query: z.object({}),
    tags: ["posts"],
  }),
  listPostTags: route({
    method: "GET",
    path: "/posts/tags",
    audience: "public",
    query: z.object({}),
    tags: ["posts"],
  }),

  listBanners: route({
    method: "GET",
    path: "/banners",
    audience: "public",
    query: z.object({}),
    tags: ["banners"],
  }),
  listTestimonials: route({
    method: "GET",
    path: "/testimonials",
    audience: "public",
    query: z.object({}),
    tags: ["testimonials"],
  }),

  search: route({
    method: "GET",
    path: "/search",
    audience: "public",
    query: z.object({
      q: z.string().trim().max(120),
      city: z.string().uuid().optional(),
    }),
  }),
  searchSuggest: route({
    method: "GET",
    path: "/search/suggest",
    audience: "public",
    query: z.object({ q: z.string().trim().max(120) }),
  }),
} as const;
