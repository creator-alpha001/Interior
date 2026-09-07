import { z } from "zod";
import { baseRecordSchema, idSchema, timestampSchema } from "./common";

export const blogCategorySchema = baseRecordSchema.extend({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
  description: z.string(),
});

export const blogTagSchema = baseRecordSchema.extend({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
});

/**
 * The blog is a marketing asset that has to rank, which is why the public site
 * is server-rendered. SEO fields are first-class, not an afterthought.
 */
export const blogPostSchema = baseRecordSchema.extend({
  id: idSchema,
  title: z.string(),
  slug: z.string(),
  excerpt: z.string(),
  /** Markdown body. */
  body: z.string(),
  coverImageUrl: z.string(),
  authorName: z.string(),
  authorRole: z.string(),
  categoryId: idSchema,
  tagIds: z.array(idSchema),
  /** Optional: ties a post to a service vertical for cross-linking. */
  domainId: idSchema.nullable(),
  status: z.enum(["draft", "scheduled", "published", "archived"]),
  publishedAt: timestampSchema.nullable(),
  readingMinutes: z.number(),
  seoTitle: z.string(),
  seoDescription: z.string(),
  ogImageUrl: z.string().nullable(),
  isFeatured: z.boolean(),
});

/** Home-screen promotional banners, targetable per domain and city. */
export const bannerSchema = baseRecordSchema.extend({
  id: idSchema,
  title: z.string(),
  subtitle: z.string(),
  imageUrl: z.string(),
  ctaLabel: z.string(),
  ctaHref: z.string(),
  domainId: idSchema.nullable(),
  cityIds: z.array(idSchema),
  isActive: z.boolean(),
  sortOrder: z.number(),
});

export const testimonialSchema = baseRecordSchema.extend({
  id: idSchema,
  clientName: z.string(),
  cityName: z.string(),
  domainId: idSchema,
  rating: z.number(),
  quote: z.string(),
  avatarUrl: z.string().nullable(),
});
