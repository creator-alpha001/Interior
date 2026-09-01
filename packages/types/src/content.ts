import type { BaseRecord, ID, Timestamp } from "./common";

export interface BlogCategory extends BaseRecord {
  id: ID;
  name: string;
  slug: string;
  description: string;
}

export interface BlogTag extends BaseRecord {
  id: ID;
  name: string;
  slug: string;
}

/**
 * The blog is a marketing asset that has to rank, which is why the public site
 * is server-rendered. SEO fields are first-class, not an afterthought.
 */
export interface BlogPost extends BaseRecord {
  id: ID;
  title: string;
  slug: string;
  excerpt: string;
  /** Markdown body. */
  body: string;
  coverImageUrl: string;
  authorName: string;
  authorRole: string;
  categoryId: ID;
  tagIds: ID[];
  /** Optional: ties a post to a service vertical for cross-linking. */
  domainId: ID | null;
  status: "draft" | "scheduled" | "published" | "archived";
  publishedAt: Timestamp | null;
  readingMinutes: number;
  seoTitle: string;
  seoDescription: string;
  ogImageUrl: string | null;
  isFeatured: boolean;
}

/** Home-screen promotional banners, targetable per domain and city. */
export interface Banner extends BaseRecord {
  id: ID;
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaLabel: string;
  ctaHref: string;
  domainId: ID | null;
  cityIds: ID[];
  isActive: boolean;
  sortOrder: number;
}

export interface Testimonial extends BaseRecord {
  id: ID;
  clientName: string;
  cityName: string;
  domainId: ID;
  rating: number;
  quote: string;
  avatarUrl: string | null;
}
