/**
 * Blog, banners and testimonials.
 *
 * The blog is a marketing asset that has to rank, which is why the public site
 * server-renders it and why only published posts ever leave this module — a
 * draft reachable by URL is a draft that gets indexed.
 */
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { Banner, BlogPostView, Paginated, Testimonial } from "@repo/types";
import { db } from "../../db/client";
import * as t from "../../db/schema";
import { toBlogCategory, toBlogPostView, toBlogTag } from "../../lib/mappers";
import { decodeCursor, page } from "../../lib/pagination";

export interface PostQuery {
  category?: string;
  tag?: string;
  domain?: string;
  search?: string;
  limit: number;
  cursor?: string;
}

/** Published only, and only once the publish date has actually arrived. */
const publishedOnly = () =>
  and(
    eq(t.blogPosts.status, "published"),
    isNotNull(t.blogPosts.publishedAt),
    sql`${t.blogPosts.publishedAt} <= now()`,
    isNull(t.blogPosts.deletedAt),
  );

async function tagsForPosts(postIds: string[]) {
  if (postIds.length === 0) return new Map<string, Array<typeof t.blogTags.$inferSelect>>();

  const rows = await db
    .select({ postId: t.blogPostTags.postId, tag: t.blogTags })
    .from(t.blogPostTags)
    .innerJoin(t.blogTags, eq(t.blogTags.id, t.blogPostTags.tagId))
    .where(inArray(t.blogPostTags.postId, postIds));

  const byPost = new Map<string, Array<typeof t.blogTags.$inferSelect>>();
  for (const row of rows) {
    const list = byPost.get(row.postId);
    if (list) list.push(row.tag);
    else byPost.set(row.postId, [row.tag]);
  }
  return byPost;
}

export async function listPosts(query: PostQuery): Promise<Paginated<BlogPostView>> {
  const offset = decodeCursor(query.cursor);

  const conditions = [publishedOnly()];
  if (query.category) conditions.push(eq(t.blogCategories.slug, query.category));
  if (query.domain) conditions.push(eq(t.domains.slug, query.domain));

  if (query.search) {
    const term = `%${query.search.toLowerCase()}%`;
    conditions.push(
      or(
        sql`lower(${t.blogPosts.title}) LIKE ${term}`,
        sql`lower(${t.blogPosts.excerpt}) LIKE ${term}`,
      )!,
    );
  }

  if (query.tag) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM ${t.blogPostTags} bpt
      JOIN ${t.blogTags} bt ON bt.id = bpt.tag_id
      WHERE bpt.post_id = ${t.blogPosts.id} AND bt.slug = ${query.tag}
    )`);
  }

  const where = and(...conditions);

  const [rows, [totals]] = await Promise.all([
    db
      .select({ post: t.blogPosts, category: t.blogCategories, domain: t.domains })
      .from(t.blogPosts)
      .innerJoin(t.blogCategories, eq(t.blogCategories.id, t.blogPosts.categoryId))
      .leftJoin(t.domains, eq(t.domains.id, t.blogPosts.domainId))
      .where(where)
      .orderBy(desc(t.blogPosts.publishedAt), asc(t.blogPosts.id))
      .limit(query.limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(t.blogPosts)
      .innerJoin(t.blogCategories, eq(t.blogCategories.id, t.blogPosts.categoryId))
      .leftJoin(t.domains, eq(t.domains.id, t.blogPosts.domainId))
      .where(where),
  ]);

  const tags = await tagsForPosts(rows.map((r) => r.post.id));

  const views = rows.map((r) =>
    toBlogPostView({
      post: r.post,
      category: r.category,
      domain: r.domain,
      tags: tags.get(r.post.id) ?? [],
    }),
  );

  return page(views, totals?.value ?? 0, offset, query.limit);
}

export async function getPostBySlug(slug: string): Promise<BlogPostView | null> {
  const [row] = await db
    .select({ post: t.blogPosts, category: t.blogCategories, domain: t.domains })
    .from(t.blogPosts)
    .innerJoin(t.blogCategories, eq(t.blogCategories.id, t.blogPosts.categoryId))
    .leftJoin(t.domains, eq(t.domains.id, t.blogPosts.domainId))
    .where(and(eq(t.blogPosts.slug, slug), publishedOnly()))
    .limit(1);

  if (!row) return null;

  const tags = await tagsForPosts([row.post.id]);
  return toBlogPostView({
    post: row.post,
    category: row.category,
    domain: row.domain,
    tags: tags.get(row.post.id) ?? [],
  });
}

export async function listRelatedPosts(postId: string, limit = 3): Promise<BlogPostView[]> {
  const [source] = await db
    .select({ domainId: t.blogPosts.domainId, categoryId: t.blogPosts.categoryId })
    .from(t.blogPosts)
    .where(eq(t.blogPosts.id, postId))
    .limit(1);

  if (!source) return [];

  const rows = await db
    .select({ post: t.blogPosts, category: t.blogCategories, domain: t.domains })
    .from(t.blogPosts)
    .innerJoin(t.blogCategories, eq(t.blogCategories.id, t.blogPosts.categoryId))
    .leftJoin(t.domains, eq(t.domains.id, t.blogPosts.domainId))
    .where(and(sql`${t.blogPosts.id} <> ${postId}`, publishedOnly()))
    // Same trade first, then same category — a reader on a painting article is
    // more likely to want another painting article than the newest post.
    .orderBy(
      desc(sql`(${t.blogPosts.domainId} IS NOT DISTINCT FROM ${source.domainId})`),
      desc(sql`(${t.blogPosts.categoryId} = ${source.categoryId})`),
      desc(t.blogPosts.publishedAt),
    )
    .limit(limit);

  const tags = await tagsForPosts(rows.map((r) => r.post.id));

  return rows.map((r) =>
    toBlogPostView({
      post: r.post,
      category: r.category,
      domain: r.domain,
      tags: tags.get(r.post.id) ?? [],
    }),
  );
}

export async function listBlogCategories() {
  const rows = await db
    .select()
    .from(t.blogCategories)
    .where(isNull(t.blogCategories.deletedAt))
    .orderBy(asc(t.blogCategories.name));
  return rows.map(toBlogCategory);
}

export async function listBlogTags() {
  const rows = await db
    .select()
    .from(t.blogTags)
    .where(isNull(t.blogTags.deletedAt))
    .orderBy(asc(t.blogTags.name));
  return rows.map(toBlogTag);
}

export async function listBanners(): Promise<Banner[]> {
  const rows = await db
    .select()
    .from(t.banners)
    .where(and(eq(t.banners.isActive, true), isNull(t.banners.deletedAt)))
    .orderBy(asc(t.banners.sortOrder));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    imageUrl: row.imageUrl,
    ctaLabel: row.ctaLabel,
    ctaHref: row.ctaHref,
    domainId: row.domainId,
    cityIds: row.cityIds,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  }));
}

export async function listTestimonials(): Promise<Testimonial[]> {
  const rows = await db
    .select()
    .from(t.testimonials)
    .where(isNull(t.testimonials.deletedAt))
    .orderBy(desc(t.testimonials.createdAt));

  return rows.map((row) => ({
    id: row.id,
    clientName: row.clientName,
    cityName: row.cityName,
    domainId: row.domainId,
    rating: row.rating,
    quote: row.quote,
    avatarUrl: row.avatarUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  }));
}
