import type {
  Banner,
  BlogCategory,
  BlogPostView,
  BlogTag,
  City,
  Domain,
  Testimonial,
} from "@repo/types";
import { domainById } from "./mappers";
import { delay, store } from "./store";

export async function listDomains(): Promise<Domain[]> {
  return delay(store.domains.filter((d) => d.isActive).sort((a, b) => a.sortOrder - b.sortOrder));
}

export async function getDomainBySlug(slug: string): Promise<Domain | null> {
  return delay(store.domains.find((d) => d.slug === slug) ?? null);
}

export async function listCities(): Promise<City[]> {
  return delay(store.cities.filter((c) => c.isActive));
}

export async function listBanners(): Promise<Banner[]> {
  return delay(
    store.banners.filter((b) => b.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
  );
}

export async function listTestimonials(): Promise<Testimonial[]> {
  return delay(store.testimonials);
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
}

export async function listPosts(query: PostQuery = {}): Promise<BlogPostView[]> {
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

  return delay(query.limit ? views.slice(0, query.limit) : views);
}

export async function getPostBySlug(slug: string): Promise<BlogPostView | null> {
  const post = store.blogPosts.find((p) => p.slug === slug && p.status === "published");
  return delay(post ? toPostView(post.id) : null);
}

export async function listRelatedPosts(postId: string, limit = 3): Promise<BlogPostView[]> {
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
  return delay(store.blogCategories);
}

export async function listBlogTags(): Promise<BlogTag[]> {
  return delay(store.blogTags);
}
