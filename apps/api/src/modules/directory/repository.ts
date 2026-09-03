/**
 * The public vendor directory.
 *
 * What a visitor may see about a professional, and nothing more. Contact
 * details are never part of a public response — the platform coordinates every
 * conversation, so there is no shape here that could carry a phone number even
 * by accident.
 */
import { and, asc, count, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { Paginated, PortfolioItem, ProfessionalProfile, ProfessionalSummary } from "@repo/types";
import { db } from "../../db/client";
import * as t from "../../db/schema";
import { groupMediaByOwner, type MediaRow } from "../../lib/media";
import { fromX10, toDomain, toPortfolioItem, toProfessionalSummary } from "../../lib/mappers";
import { decodeCursor, page } from "../../lib/pagination";

export interface ProfessionalQuery {
  domain?: string;
  city?: string;
  search?: string;
  verifiedOnly?: boolean;
  limit: number;
  cursor?: string;
}

/**
 * Loads the trades each of these vendors is approved for, in one query.
 *
 * Every card shows them, so fetching per vendor would be one query per row.
 */
async function domainsByProfessional(professionalIds: string[]) {
  if (professionalIds.length === 0) return new Map<string, Array<typeof t.domains.$inferSelect>>();

  const rows = await db
    .select({ professionalId: t.professionalDomains.professionalId, domain: t.domains })
    .from(t.professionalDomains)
    .innerJoin(t.domains, eq(t.domains.id, t.professionalDomains.domainId))
    .where(
      and(
        inArray(t.professionalDomains.professionalId, professionalIds),
        eq(t.professionalDomains.verificationStatus, "approved"),
        isNull(t.professionalDomains.deletedAt),
      ),
    );

  const byProfessional = new Map<string, Array<typeof t.domains.$inferSelect>>();
  for (const row of rows) {
    const list = byProfessional.get(row.professionalId);
    if (list) list.push(row.domain);
    else byProfessional.set(row.professionalId, [row.domain]);
  }
  return byProfessional;
}

export async function listProfessionals(
  query: ProfessionalQuery,
): Promise<Paginated<ProfessionalSummary>> {
  const offset = decodeCursor(query.cursor);

  const conditions = [isNull(t.professionals.deletedAt)];
  if (query.verifiedOnly) conditions.push(eq(t.professionals.verificationStatus, "verified"));

  if (query.search) {
    const term = `%${query.search.toLowerCase()}%`;
    conditions.push(
      or(
        sql`lower(${t.professionals.companyName}) LIKE ${term}`,
        sql`lower(${t.users.name}) LIKE ${term}`,
      )!,
    );
  }

  // A vendor qualifies for a trade filter only if they are *approved* for it,
  // and for a city filter only if they actually serve it. Both are EXISTS
  // rather than joins, so a vendor covering four cities is not returned four
  // times.
  if (query.domain) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM ${t.professionalDomains} pd
      JOIN ${t.domains} d ON d.id = pd.domain_id
      WHERE pd.professional_id = ${t.professionals.id}
        AND pd.verification_status = 'approved'
        AND d.slug = ${query.domain}
    )`);
  }

  if (query.city) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM ${t.professionalServiceAreas} sa
      WHERE sa.professional_id = ${t.professionals.id}
        AND sa.city_id = ${query.city}
    )`);
  }

  const where = and(...conditions);

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        professional: t.professionals,
        user: t.users,
        city: t.cities,
        domainLink: t.professionalDomains,
      })
      .from(t.professionals)
      .innerJoin(t.users, eq(t.users.id, t.professionals.userId))
      .innerJoin(t.cities, eq(t.cities.id, t.users.cityId))
      // When a trade is in context, its per-trade rating is what should rank
      // and display — a painter's carpentry average is not the answer to
      // "who should paint my flat".
      .leftJoin(
        t.professionalDomains,
        query.domain
          ? and(
              eq(t.professionalDomains.professionalId, t.professionals.id),
              sql`${t.professionalDomains.domainId} = (SELECT id FROM ${t.domains} WHERE slug = ${query.domain})`,
            )
          : sql`false`,
      )
      .where(where)
      .orderBy(
        desc(sql`COALESCE(${t.professionalDomains.avgRatingX10}, ${t.professionals.avgRatingX10})`),
        desc(t.professionals.completedProjects),
        asc(t.professionals.id),
      )
      .limit(query.limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(t.professionals)
      .innerJoin(t.users, eq(t.users.id, t.professionals.userId))
      .where(where),
  ]);

  const domains = await domainsByProfessional(rows.map((r) => r.professional.id));

  const summaries = rows.map((r) =>
    toProfessionalSummary({
      professional: r.professional,
      user: r.user,
      city: r.city,
      domains: domains.get(r.professional.id) ?? [],
      domainLink: r.domainLink,
    }),
  );

  return page(summaries, totals?.value ?? 0, offset, query.limit);
}

export async function getProfessional(id: string): Promise<ProfessionalProfile | null> {
  const [row] = await db
    .select({ professional: t.professionals, user: t.users, city: t.cities })
    .from(t.professionals)
    .innerJoin(t.users, eq(t.users.id, t.professionals.userId))
    .innerJoin(t.cities, eq(t.cities.id, t.users.cityId))
    .where(and(eq(t.professionals.id, id), isNull(t.professionals.deletedAt)))
    .limit(1);

  if (!row) return null;

  const [domainLinks, serviceCities, portfolioRows, reviewRows] = await Promise.all([
    db
      .select({ link: t.professionalDomains, domain: t.domains })
      .from(t.professionalDomains)
      .innerJoin(t.domains, eq(t.domains.id, t.professionalDomains.domainId))
      .where(
        and(
          eq(t.professionalDomains.professionalId, id),
          isNull(t.professionalDomains.deletedAt),
        ),
      ),
    db
      .select({ city: t.cities })
      .from(t.professionalServiceAreas)
      .innerJoin(t.cities, eq(t.cities.id, t.professionalServiceAreas.cityId))
      .where(eq(t.professionalServiceAreas.professionalId, id)),
    // Only moderated work reaches a public profile.
    db
      .select()
      .from(t.portfolioItems)
      .where(
        and(
          eq(t.portfolioItems.professionalId, id),
          eq(t.portfolioItems.moderationStatus, "approved"),
          isNull(t.portfolioItems.deletedAt),
        ),
      ),
    db
      .select({
        review: t.reviews,
        domain: t.domains,
        reviewerName: t.users.name,
        projectReference: t.projects.reference,
      })
      .from(t.reviews)
      .innerJoin(t.domains, eq(t.domains.id, t.reviews.domainId))
      .innerJoin(t.projects, eq(t.projects.id, t.reviews.projectId))
      .innerJoin(t.clients, eq(t.clients.id, t.reviews.clientId))
      .innerJoin(t.users, eq(t.users.id, t.clients.userId))
      .where(and(eq(t.reviews.professionalId, id), isNull(t.reviews.deletedAt)))
      .orderBy(desc(t.reviews.createdAt)),
  ]);

  const portfolioMedia = await mediaForPortfolio(portfolioRows.map((p) => p.id));

  const approvedDomains = domainLinks
    .filter((l) => l.link.verificationStatus === "approved")
    .map((l) => l.domain);

  return {
    ...toProfessionalSummary({
      professional: row.professional,
      user: row.user,
      city: row.city,
      domains: approvedDomains,
    }),
    professional: {
      id: row.professional.id,
      userId: row.professional.userId,
      companyName: row.professional.companyName,
      gstNumber: row.professional.gstNumber,
      experienceYears: row.professional.experienceYears,
      bio: row.professional.bio,
      avgRating: fromX10(row.professional.avgRatingX10),
      ratingCount: row.professional.ratingCount,
      completedProjects: row.professional.completedProjects,
      languages: row.professional.languages,
      verificationStatus: row.professional.verificationStatus,
      avgResponseHours: row.professional.avgResponseHours,
      createdAt: row.professional.createdAt,
      updatedAt: row.professional.updatedAt,
      deletedAt: row.professional.deletedAt,
    },
    user: {
      id: row.user.id,
      name: row.user.name,
      // A public profile carries no way to contact this person directly. The
      // columns exist on the row; they stop here.
      mobile: "",
      email: null,
      role: row.user.role,
      cityId: row.user.cityId,
      status: row.user.status,
      avatarUrl: row.user.avatarUrl,
      createdAt: row.user.createdAt,
      updatedAt: row.user.updatedAt,
      deletedAt: row.user.deletedAt,
    },
    bio: row.professional.bio,
    domainStats: domainLinks.map((l) => ({
      id: l.link.id,
      professionalId: l.link.professionalId,
      domainId: l.link.domainId,
      verificationStatus: l.link.verificationStatus,
      commissionPercentOverride: l.link.commissionPercentOverride,
      avgRating: fromX10(l.link.avgRatingX10),
      ratingCount: l.link.ratingCount,
      completedProjects: l.link.completedProjects,
      createdAt: l.link.createdAt,
      updatedAt: l.link.updatedAt,
      deletedAt: l.link.deletedAt,
    })),
    serviceCities: serviceCities.map((c) => ({
      id: c.city.id,
      name: c.city.name,
      slug: c.city.slug,
      state: c.city.state,
      isActive: c.city.isActive,
    })),
    portfolio: portfolioRows.map((p) => toPortfolioItem(p, portfolioMedia.get(p.id) ?? [])),
    reviews: reviewRows.map((r) => ({
      review: {
        id: r.review.id,
        projectId: r.review.projectId,
        clientId: r.review.clientId,
        professionalId: r.review.professionalId,
        domainId: r.review.domainId,
        rating: r.review.rating as 1 | 2 | 3 | 4 | 5,
        comment: r.review.comment,
        qualityRating: r.review.qualityRating,
        timelinessRating: r.review.timelinessRating,
        professionalismRating: r.review.professionalismRating,
        createdAt: r.review.createdAt,
        updatedAt: r.review.updatedAt,
        deletedAt: r.review.deletedAt,
      },
      // First name only. A public review should not put a customer's full name
      // next to their home city and the value of work done at their address.
      clientName: r.reviewerName.split(" ")[0] ?? "Customer",
      domain: toDomain(r.domain),
      projectTitle: r.projectReference,
    })),
  };
}

async function mediaForPortfolio(ids: string[]) {
  if (ids.length === 0) return new Map<string, ReturnType<typeof groupMediaByOwner> extends Map<string, infer V> ? V : never>();

  const rows = await db
    .select({
      id: t.mediaAssets.id,
      type: t.mediaAssets.type,
      storageKey: t.mediaAssets.storageKey,
      caption: t.mediaAssets.caption,
      ownerType: t.mediaAssets.ownerType,
      ownerId: t.mediaAssets.ownerId,
      sortOrder: t.mediaAssets.sortOrder,
    })
    .from(t.mediaAssets)
    .where(
      and(
        eq(t.mediaAssets.ownerType, "portfolio_item"),
        inArray(t.mediaAssets.ownerId, ids),
        isNull(t.mediaAssets.deletedAt),
      ),
    )
    .orderBy(asc(t.mediaAssets.sortOrder));

  return groupMediaByOwner(rows as MediaRow[]);
}

export async function listPortfolio(domainSlug?: string, limit = 60): Promise<PortfolioItem[]> {
  const conditions = [
    eq(t.portfolioItems.moderationStatus, "approved"),
    isNull(t.portfolioItems.deletedAt),
  ];
  if (domainSlug) conditions.push(eq(t.domains.slug, domainSlug));

  const rows = await db
    .select({ item: t.portfolioItems })
    .from(t.portfolioItems)
    .innerJoin(t.domains, eq(t.domains.id, t.portfolioItems.domainId))
    .where(and(...conditions))
    .orderBy(desc(t.portfolioItems.createdAt))
    .limit(limit);

  const media = await mediaForPortfolio(rows.map((r) => r.item.id));
  return rows.map((r) => toPortfolioItem(r.item, media.get(r.item.id) ?? []));
}

export async function getPlatformStats() {
  const [row] = await db
    .select({
      professionals: count(),
      projects: sql<number>`COALESCE(SUM(${t.professionals.completedProjects}), 0)`,
      // A straight average of averages would weight a vendor with one review
      // the same as one with two hundred, so it is weighted by review count.
      ratingSum: sql<number>`COALESCE(SUM(${t.professionals.avgRatingX10} * ${t.professionals.ratingCount}), 0)`,
      ratingCount: sql<number>`COALESCE(SUM(${t.professionals.ratingCount}), 0)`,
    })
    .from(t.professionals)
    .where(
      and(eq(t.professionals.verificationStatus, "verified"), isNull(t.professionals.deletedAt)),
    );

  const [cityRow] = await db
    .select({ value: count() })
    .from(t.cities)
    .where(eq(t.cities.isActive, true));

  const ratingCount = Number(row?.ratingCount ?? 0);
  const avgRating = ratingCount > 0 ? Number(row?.ratingSum ?? 0) / ratingCount / 10 : 0;

  return {
    professionals: row?.professionals ?? 0,
    projects: Number(row?.projects ?? 0),
    cities: cityRow?.value ?? 0,
    avgRating: Math.round(avgRating * 10) / 10,
  };
}
