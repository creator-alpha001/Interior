import {
  DEFAULT_PAGE_SIZE,
  type Paginated,
  type PortfolioItem,
  type ProfessionalProfile,
  type ProfessionalSummary,
} from "@repo/types";
import { USING_API, api, paginate, readThrough } from "./client";
import { toProfessionalProfile, toProfessionalSummary } from "./mappers";
import { delay, store } from "./store";

export interface ProfessionalQuery {
  domainSlug?: string;
  cityId?: string;
  search?: string;
  verifiedOnly?: boolean;
  limit?: number;
  cursor?: string | null;
}

/**
 * The vendor pool for a domain and city — the same query Admin uses when
 * choosing which three professionals to assign to a lead-domain.
 */
export async function listProfessionals(
  query: ProfessionalQuery = {},
): Promise<Paginated<ProfessionalSummary>> {
  if (USING_API) {
    return api<Paginated<ProfessionalSummary>>("/professionals", {
      tags: ["professionals"],
      query: {
        domain: query.domainSlug,
        city: query.cityId,
        search: query.search,
        verifiedOnly: query.verifiedOnly,
        limit: query.limit ?? DEFAULT_PAGE_SIZE,
        cursor: query.cursor,
      },
    });
  }

  const domain = query.domainSlug
    ? store.domains.find((d) => d.slug === query.domainSlug)
    : undefined;
  const search = query.search?.trim().toLowerCase();

  const eligible = store.professionals.filter((pro) => {
    if (query.verifiedOnly && pro.verificationStatus !== "verified") return false;

    if (domain) {
      const link = store.professionalDomains.find(
        (pd) =>
          pd.professionalId === pro.id &&
          pd.domainId === domain.id &&
          pd.verificationStatus === "approved",
      );
      if (!link) return false;
    }

    if (query.cityId) {
      const serves = store.professionalServiceAreas.some(
        (a) => a.professionalId === pro.id && a.cityId === query.cityId,
      );
      if (!serves) return false;
    }

    if (search) {
      const user = store.users.find((u) => u.id === pro.userId);
      const haystack = `${user?.name ?? ""} ${pro.companyName} ${pro.bio}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });

  const summaries = eligible
    .map((pro) => toProfessionalSummary(pro.id, domain?.id))
    .sort(
      (a, b) =>
        (b.domainRating?.avgRating ?? b.avgRating) - (a.domainRating?.avgRating ?? a.avgRating) ||
        b.completedProjects - a.completedProjects,
    );

  return delay(paginate(summaries, query.limit ?? DEFAULT_PAGE_SIZE, query.cursor));
}

export async function getProfessional(id: string): Promise<ProfessionalProfile | null> {
  return readThrough(`/professionals/${id}`, { tags: ["professionals"] }, () => {
    const exists = store.professionals.some((p) => p.id === id);
    return delay(exists ? toProfessionalProfile(id) : null);
  });
}

/** Portfolio gallery for the public "Browse work" screen, filterable by domain. */
export async function listPortfolio(domainSlug?: string, limit?: number): Promise<PortfolioItem[]> {
  if (USING_API) {
    return api<PortfolioItem[]>("/portfolio", {
      tags: ["portfolio"],
      query: { domain: domainSlug, limit },
    });
  }

  const domain = domainSlug ? store.domains.find((d) => d.slug === domainSlug) : undefined;
  const items = store.portfolioItems
    .filter((p) => p.moderationStatus === "approved")
    .filter((p) => (domain ? p.domainId === domain.id : true));
  return delay(limit ? items.slice(0, limit) : items);
}

export async function getPlatformStats(): Promise<{
  professionals: number;
  projects: number;
  cities: number;
  avgRating: number;
}> {
  if (USING_API) return api("/stats", { tags: ["stats"] });

  const verified = store.professionals.filter((p) => p.verificationStatus === "verified");
  const projects = verified.reduce((sum, p) => sum + p.completedProjects, 0);
  const avg =
    verified.reduce((sum, p) => sum + p.avgRating * p.ratingCount, 0) /
    Math.max(verified.reduce((sum, p) => sum + p.ratingCount, 0), 1);
  return delay({
    professionals: verified.length,
    projects,
    cities: store.cities.filter((c) => c.isActive).length,
    avgRating: Math.round(avg * 10) / 10,
  });
}
