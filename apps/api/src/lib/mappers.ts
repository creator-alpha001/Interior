/**
 * Database rows to the shapes in @repo/types.
 *
 * Two deliberate mismatches are reconciled here, and only here:
 *
 *  - Ratings are stored as integers times ten (`45`), because sorting and
 *    averaging floats makes equal vendors order unstably. The views want `4.5`.
 *  - Media lives in its own table; the views carry it inline on its owner.
 *
 * Everything else is a straight rename from snake_case columns. Keeping the
 * translation in one file means a screen never learns what the schema looks
 * like, which is the whole reason `packages/data` could be swapped without
 * touching a component.
 */
import type {
  BlogCategory,
  BlogPost,
  BlogPostView,
  BlogTag,
  City,
  Domain,
  MediaAsset,
  PackageView,
  PortfolioItem,
  Product,
  ProductCategory,
  ProductView,
  ProfessionalSummary,
  ServicePackage,
} from "@repo/types";
import type * as t from "../db/schema";

type Row<T extends { $inferSelect: unknown }> = T["$inferSelect"];

/** Integer-times-ten back to the one-decimal rating the UI shows. */
export const fromX10 = (value: number): number => Math.round(value) / 10;

export function toCity(row: Row<typeof t.cities>): City {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    state: row.state,
    isActive: row.isActive,
  };
}

export function toDomain(row: Row<typeof t.domains>): Domain {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    tagline: row.tagline,
    description: row.description,
    iconKey: row.iconKey,
    bannerUrl: row.bannerUrl,
    defaultCommissionPercent: row.defaultCommissionPercent,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    labels: row.labels,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export function toProductCategory(row: Row<typeof t.productCategories>): ProductCategory {
  return {
    id: row.id,
    domainId: row.domainId,
    parentId: row.parentId,
    name: row.name,
    slug: row.slug,
    description: row.description,
    imageUrl: row.imageUrl,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export function toProduct(row: Row<typeof t.products>, media: MediaAsset[]): Product {
  return {
    id: row.id,
    domainId: row.domainId,
    categoryId: row.categoryId,
    name: row.name,
    slug: row.slug,
    shortDescription: row.shortDescription,
    description: row.description,
    media,
    basePrice: row.basePrice,
    priceUnit: row.priceUnit,
    leadTimeDays: row.leadTimeDays,
    isCustomisable: row.isCustomisable,
    specs: row.specs,
    options: row.options,
    tags: row.tags,
    isFeatured: row.isFeatured,
    isActive: row.isActive,
    rating: fromX10(row.ratingX10),
    ratingCount: row.ratingCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export function toProductView(
  product: Row<typeof t.products>,
  domain: Row<typeof t.domains>,
  category: Row<typeof t.productCategories>,
  media: MediaAsset[],
  cityPrice?: number | null,
): ProductView {
  return {
    product: toProduct(product, media),
    domain: toDomain(domain),
    category: toProductCategory(category),
    // A city override replaces the base price rather than adjusting it, which
    // is what the estimator and the compare table both assume.
    effectivePrice: cityPrice ?? product.basePrice,
  };
}

export function toServicePackage(
  row: Row<typeof t.servicePackages>,
  media: MediaAsset[],
): ServicePackage {
  return {
    id: row.id,
    domainId: row.domainId,
    name: row.name,
    slug: row.slug,
    shortDescription: row.shortDescription,
    description: row.description,
    media,
    price: row.price,
    priceBasis: row.priceBasis,
    durationDays: row.durationDays,
    inclusions: row.inclusions,
    exclusions: row.exclusions,
    isFeatured: row.isFeatured,
    isActive: row.isActive,
    badge: row.badge,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export function toPackageView(
  servicePackage: Row<typeof t.servicePackages>,
  domain: Row<typeof t.domains>,
  media: MediaAsset[],
  items: Array<Row<typeof t.packageItems>>,
): PackageView {
  return {
    servicePackage: toServicePackage(servicePackage, media),
    domain: toDomain(domain),
    items: items.map((i) => ({
      label: i.label,
      quantity: i.quantity,
      productId: i.productId,
    })),
  };
}

export function toPortfolioItem(
  row: Row<typeof t.portfolioItems>,
  media: MediaAsset[],
): PortfolioItem {
  return {
    id: row.id,
    professionalId: row.professionalId,
    domainId: row.domainId,
    title: row.title,
    description: row.description,
    media,
    moderationStatus: row.moderationStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

/**
 * The public card for a vendor.
 *
 * `domainRating` is filled only when the vendor is being shown in the context
 * of one trade, because that is the number that actually answers the question
 * being asked — somebody browsing painters does not care about a 5-star
 * carpentry average.
 */
export function toProfessionalSummary(input: {
  professional: Row<typeof t.professionals>;
  user: Row<typeof t.users>;
  city: Row<typeof t.cities>;
  domains: Array<Row<typeof t.domains>>;
  domainLink?: Row<typeof t.professionalDomains> | null;
}): ProfessionalSummary {
  const { professional, user, city, domains, domainLink } = input;

  return {
    id: professional.id,
    name: user.name,
    companyName: professional.companyName,
    avatarUrl: user.avatarUrl,
    city: toCity(city),
    experienceYears: professional.experienceYears,
    completedProjects: professional.completedProjects,
    avgRating: fromX10(professional.avgRatingX10),
    ratingCount: professional.ratingCount,
    languages: professional.languages,
    isVerified: professional.verificationStatus === "verified",
    avgResponseHours: professional.avgResponseHours,
    domains: domains.map(toDomain),
    ...(domainLink
      ? {
          domainRating: {
            domainId: domainLink.domainId,
            avgRating: fromX10(domainLink.avgRatingX10),
            ratingCount: domainLink.ratingCount,
          },
        }
      : {}),
  };
}

export function toBlogCategory(row: Row<typeof t.blogCategories>): BlogCategory {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export function toBlogTag(row: Row<typeof t.blogTags>): BlogTag {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export function toBlogPost(row: Row<typeof t.blogPosts>, tagIds: string[]): BlogPost {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    body: row.body,
    coverImageUrl: row.coverImageUrl,
    authorName: row.authorName,
    authorRole: row.authorRole,
    categoryId: row.categoryId,
    tagIds,
    domainId: row.domainId,
    status: row.status,
    publishedAt: row.publishedAt,
    readingMinutes: row.readingMinutes,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    ogImageUrl: row.ogImageUrl,
    isFeatured: row.isFeatured,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export function toBlogPostView(input: {
  post: Row<typeof t.blogPosts>;
  category: Row<typeof t.blogCategories>;
  domain: Row<typeof t.domains> | null;
  tags: Array<Row<typeof t.blogTags>>;
}): BlogPostView {
  return {
    post: toBlogPost(
      input.post,
      input.tags.map((tag) => tag.id),
    ),
    category: toBlogCategory(input.category),
    tags: input.tags.map((tag) => tag.name),
    domain: input.domain ? toDomain(input.domain) : null,
  };
}
