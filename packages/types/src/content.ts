/** Editorial and marketing surfaces: the blog, banners and testimonials. */
import type { z } from "zod";
import type {
  bannerSchema,
  blogCategorySchema,
  blogPostSchema,
  blogTagSchema,
  testimonialSchema,
} from "./schema/content";

export type BlogCategory = z.infer<typeof blogCategorySchema>;

export type BlogTag = z.infer<typeof blogTagSchema>;

/**
 * The blog is a marketing asset that has to rank, which is why the public site
 * is server-rendered. SEO fields are first-class, not an afterthought.
 */
export type BlogPost = z.infer<typeof blogPostSchema>;

/** Home-screen promotional banners, targetable per domain and city. */
export type Banner = z.infer<typeof bannerSchema>;

export type Testimonial = z.infer<typeof testimonialSchema>;
