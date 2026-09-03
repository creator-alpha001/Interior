/**
 * The marketing surface: blog, home banners, testimonials.
 *
 * The blog has to rank, which is why the public site is server-rendered and why
 * the SEO fields here are columns rather than an afterthought.
 */
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { fk, primaryId, timestamps, ts } from "./_shared";
import { domains } from "./domains";
import { postStatus } from "./enums";

export const blogCategories = pgTable(
  "blog_categories",
  {
    id: primaryId(),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    description: text("description").notNull().default(""),
    ...timestamps,
  },
  (t) => [uniqueIndex("uq_blog_category_slug").on(t.slug)],
);

export const blogTags = pgTable(
  "blog_tags",
  {
    id: primaryId(),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("uq_blog_tag_slug").on(t.slug)],
);

export const blogPosts = pgTable(
  "blog_posts",
  {
    id: primaryId(),
    title: text("title").notNull(),
    slug: varchar("slug", { length: 200 }).notNull(),
    excerpt: text("excerpt").notNull().default(""),
    /** Markdown. */
    body: text("body").notNull(),
    coverImageUrl: text("cover_image_url").notNull().default(""),
    authorName: text("author_name").notNull(),
    authorRole: text("author_role").notNull().default(""),
    categoryId: fk("category_id")
      .notNull()
      .references(() => blogCategories.id),
    /** Optional: ties a post to a trade for cross-linking to that catalogue. */
    domainId: fk("domain_id").references(() => domains.id),
    status: postStatus("status").notNull().default("draft"),
    publishedAt: ts("published_at"),
    readingMinutes: integer("reading_minutes").notNull().default(1),
    seoTitle: text("seo_title").notNull(),
    seoDescription: text("seo_description").notNull(),
    ogImageUrl: text("og_image_url"),
    isFeatured: boolean("is_featured").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("uq_blog_post_slug").on(t.slug),
    index("ix_blog_post_published").on(t.status, t.publishedAt),
    index("ix_blog_post_domain").on(t.domainId),
  ],
);

/**
 * Many-to-many rather than a tag id array on the post, so "everything tagged
 * modular-kitchen" is an index scan instead of a sequential scan over a JSONB
 * column.
 */
export const blogPostTags = pgTable(
  "blog_post_tags",
  {
    postId: fk("post_id")
      .notNull()
      .references(() => blogPosts.id, { onDelete: "cascade" }),
    tagId: fk("tag_id")
      .notNull()
      .references(() => blogTags.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("uq_blog_post_tag").on(t.postId, t.tagId),
    index("ix_blog_post_tag_tag").on(t.tagId),
  ],
);

export const banners = pgTable(
  "banners",
  {
    id: primaryId(),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull().default(""),
    imageUrl: text("image_url").notNull().default(""),
    ctaLabel: text("cta_label").notNull().default(""),
    ctaHref: text("cta_href").notNull().default(""),
    domainId: fk("domain_id").references(() => domains.id),
    /** Empty means every city. Read whole with the banner, so JSONB. */
    cityIds: jsonb("city_ids").$type<string[]>().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("ix_banner_active").on(t.isActive, t.sortOrder)],
);

export const testimonials = pgTable("testimonials", {
  id: primaryId(),
  clientName: text("client_name").notNull(),
  cityName: text("city_name").notNull().default(""),
  domainId: fk("domain_id")
    .notNull()
    .references(() => domains.id),
  rating: integer("rating").notNull().default(5),
  quote: text("quote").notNull(),
  avatarUrl: text("avatar_url"),
  ...timestamps,
});
