import {
  DEFAULT_PAGE_SIZE,
  type Banner,
  type BlogCategory,
  type BlogPostView,
  type BlogTag,
  type City,
  type Domain,
  type Paginated,
  type Testimonial,
} from "@repo/types";
import { USING_API, api, paginate, readThrough } from "./client";
import { domainById } from "./mappers";
import { delay, store } from "./store";

export async function listDomains(): Promise<Domain[]> {
  return readThrough("/domains", { tags: ["domains"] }, () =>
    delay(store.domains.filter((d) => d.isActive).sort((a, b) => a.sortOrder - b.sortOrder)),
  );
}

export async function getDomainBySlug(slug: string): Promise<Domain | null> {
  return readThrough(`/domains/${slug}`, { tags: ["domains"] }, () =>
    delay(store.domains.find((d) => d.slug === slug) ?? null),
  );
}

export async function listCities(): Promise<City[]> {
  return readThrough("/cities", { tags: ["cities"] }, () =>
    delay(store.cities.filter((c) => c.isActive)),
  );
}

export async function listBanners(): Promise<Banner[]> {
  return readThrough("/banners", { tags: ["banners"] }, () =>
    delay(store.banners.filter((b) => b.isActive).sort((a, b) => a.sortOrder - b.sortOrder)),
  );
}

export async function listTestimonials(): Promise<Testimonial[]> {
  return readThrough("/testimonials", { tags: ["testimonials"] }, () =>
    delay(store.testimonials),
  );
}

function toPostView(postId: string): BlogPostView {
  const post = store.blogPosts.find((p) => p.id === postId)!;
  return {
    post,
    category: store.blogCategories.find((c) => c.id === post.categoryId)!,
    tags: post.tagIds.map((id) => store.blogTags.find((t) => t.id === id)?.name ?? ""),
    domain: post.domainId ? domainById(post.domainId) : null,
  };
}

export interface PostQuery {
  categorySlug?: string;
  tagSlug?: string;
  domainSlug?: string;
  search?: string;
  limit?: number;
  cursor?: string | null;
}

export async function listPosts(query: PostQuery = {}): Promise<Paginated<BlogPostView>> {
  if (USING_API) {
    return api<Paginated<BlogPostView>>("/posts", {
      tags: ["posts"],
      query: {
        category: query.categorySlug,
        tag: query.tagSlug,
        domain: query.domainSlug,
        search: query.search,
        limit: query.limit ?? DEFAULT_PAGE_SIZE,
        cursor: query.cursor,
      },
    });
  }

  const category = query.categorySlug
    ? store.blogCategories.find((c) => c.slug === query.categorySlug)
    : undefined;
  const tag = query.tagSlug ? store.blogTags.find((t) => t.slug === query.tagSlug) : undefined;
  const domain = query.domainSlug
    ? store.domains.find((d) => d.slug === query.domainSlug)
    : undefined;
  const search = query.search?.trim().toLowerCase();

  const views = store.blogPosts
    .filter((p) => p.status === "published")
    .filter((p) => (category ? p.categoryId === category.id : true))
    .filter((p) => (tag ? p.tagIds.includes(tag.id) : true))
    .filter((p) => (domain ? p.domainId === domain.id : true))
    .filter((p) =>
      search ? `${p.title} ${p.excerpt}`.toLowerCase().includes(search) : true,
    )
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .map((p) => toPostView(p.id));

  return delay(paginate(views, query.limit ?? DEFAULT_PAGE_SIZE, query.cursor));
}

export async function getPostBySlug(slug: string): Promise<BlogPostView | null> {
  return readThrough(`/posts/${slug}`, { tags: ["posts"] }, () => {
    const post = store.blogPosts.find((p) => p.slug === slug && p.status === "published");
    return delay(post ? toPostView(post.id) : null);
  });
}

export async function listRelatedPosts(postId: string, limit = 3): Promise<BlogPostView[]> {
  if (USING_API) {
    return api<BlogPostView[]>(`/posts/${postId}/related`, { tags: ["posts"], query: { limit } });
  }

  const post = store.blogPosts.find((p) => p.id === postId);
  if (!post) return delay([]);
  return delay(
    store.blogPosts
      .filter((p) => p.id !== postId && p.status === "published")
      .sort(
        (a, b) =>
          Number(b.domainId === post.domainId) - Number(a.domainId === post.domainId) ||
          Number(b.categoryId === post.categoryId) - Number(a.categoryId === post.categoryId),
      )
      .slice(0, limit)
      .map((p) => toPostView(p.id)),
  );
}

export async function listBlogCategories(): Promise<BlogCategory[]> {
  return readThrough("/posts/categories", { tags: ["posts"] }, () => delay(store.blogCategories));
}

export async function listBlogTags(): Promise<BlogTag[]> {
  return readThrough("/posts/tags", { tags: ["posts"] }, () => delay(store.blogTags));
}
