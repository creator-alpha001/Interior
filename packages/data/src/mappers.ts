import type {
  AgreementView,
  City,
  ClientSummary,
  Domain,
  LeadDomainView,
  LeadView,
  PackageView,
  ProductView,
  ProfessionalProfile,
  MaskedClientSummary,
  ProfessionalSummary,
  ProjectView,
  QuoteView,
  ReviewView,
} from "@repo/types";
import { seedRow, store } from "./store";

/* ---- lookups ---- */

export const cityById = (id: string): City =>
  store.cities.find((c) => c.id === id) ?? store.cities[0];

export const domainById = (id: string): Domain =>
  store.domains.find((d) => d.id === id) ?? store.domains[0];

export const domainBySlug = (slug: string): Domain | undefined =>
  store.domains.find((d) => d.slug === slug);

/* ---- professionals ---- */

export function toProfessionalSummary(
  professionalId: string,
  contextDomainId?: string,
): ProfessionalSummary {
  const pro = seedRow(
    store.professionals.find((p) => p.id === professionalId),
    "professional",
    professionalId,
  );
  const user = store.users.find((u) => u.id === pro.userId)!;
  const links = store.professionalDomains.filter((pd) => pd.professionalId === pro.id);
  const contextLink = contextDomainId
    ? links.find((l) => l.domainId === contextDomainId)
    : undefined;

  return {
    id: pro.id,
    name: user.name,
    companyName: pro.companyName,
    avatarUrl: user.avatarUrl,
    city: cityById(user.cityId),
    experienceYears: pro.experienceYears,
    completedProjects: contextLink?.completedProjects ?? pro.completedProjects,
    avgRating: pro.avgRating,
    ratingCount: pro.ratingCount,
    languages: pro.languages,
    isVerified: pro.verificationStatus === "verified",
    avgResponseHours: pro.avgResponseHours,
    domains: links.map((l) => domainById(l.domainId)),
    domainRating: contextLink
      ? {
          domainId: contextLink.domainId,
          avgRating: contextLink.avgRating,
          ratingCount: contextLink.ratingCount,
        }
      : undefined,
  };
}

export function toProfessionalProfile(professionalId: string): ProfessionalProfile {
  const pro = seedRow(
    store.professionals.find((p) => p.id === professionalId),
    "professional",
    professionalId,
  );
  const user = store.users.find((u) => u.id === pro.userId)!;
  const summary = toProfessionalSummary(professionalId);

  const reviews: ReviewView[] = store.reviews
    .filter((r) => r.professionalId === professionalId)
    .map((review) => {
      const client = store.clients.find((c) => c.id === review.clientId);
      const clientUser = store.users.find((u) => u.id === client?.userId);
      const project = store.projects.find((p) => p.id === review.projectId);
      return {
        review,
        clientName: clientUser?.name ?? "Verified customer",
        domain: domainById(review.domainId),
        projectTitle: project?.reference ?? "",
      };
    });

  return {
    ...summary,
    professional: pro,
    user,
    bio: pro.bio,
    domainStats: store.professionalDomains.filter((pd) => pd.professionalId === pro.id),
    serviceCities: store.professionalServiceAreas
      .filter((a) => a.professionalId === pro.id)
      .map((a) => cityById(a.cityId)),
    portfolio: store.portfolioItems.filter(
      (p) => p.professionalId === pro.id && p.moderationStatus === "approved",
    ),
    reviews,
  };
}

/* ---- clients ---- */

export function toClientSummary(clientId: string): ClientSummary {
  const client = seedRow(store.clients.find((c) => c.id === clientId), "client", clientId);
  const user = store.users.find((u) => u.id === client.userId)!;
  return {
    id: client.id,
    userId: user.id,
    name: user.name,
    mobile: user.mobile,
    email: user.email,
    city: cityById(user.cityId),
    address: client.address,
  };
}

/**
 * What the vendor panel is allowed to see about a client.
 *
 * The mobile number is never included — there is no code path that puts it in
 * a vendor-facing payload. The full address is released only once a site visit
 * has been confirmed for that lead-domain; until then the vendor sees the
 * locality, which is enough to judge travel and price the job.
 */
export function toMaskedClientSummary(
  clientId: string,
  leadDomainId?: string,
): MaskedClientSummary {
  const client = seedRow(store.clients.find((c) => c.id === clientId), "client", clientId);
  const user = store.users.find((u) => u.id === client.userId)!;

  const parts = (client.address ?? "").split(",").map((p) => p.trim());
  const locality = parts.length >= 2 ? parts[parts.length - 2] : (parts[0] ?? "");

  const addressReleased = leadDomainId
    ? store.meetings.some(
        (m) =>
          m.leadDomainId === leadDomainId &&
          m.addressReleasedAt !== null &&
          (m.status === "confirmed" || m.status === "completed"),
      )
    : false;

  const [first, ...restName] = user.name.split(" ");

  return {
    displayName: restName.length ? `${first} ${restName[restName.length - 1].charAt(0)}.` : first,
    city: cityById(user.cityId),
    locality,
    address: addressReleased ? client.address : null,
    contactReleased: false,
  };
}

/* ---- catalogue ---- */

export function toProductView(productId: string, cityId?: string): ProductView {
  const product = store.products.find((p) => p.id === productId)!;
  const override = cityId
    ? store.productCityPrices.find((p) => p.productId === productId && p.cityId === cityId)
    : undefined;
  return {
    product,
    domain: domainById(product.domainId),
    category: store.productCategories.find((c) => c.id === product.categoryId)!,
    effectivePrice: override?.price ?? product.basePrice,
  };
}

export function toPackageView(packageId: string): PackageView {
  const servicePackage = store.servicePackages.find((p) => p.id === packageId)!;
  return {
    servicePackage,
    domain: domainById(servicePackage.domainId),
    items: store.packageItems
      .filter((i) => i.packageId === packageId)
      .map((i) => ({ label: i.label, quantity: i.quantity, productId: i.productId })),
  };
}

/* ---- leads ---- */

export function toQuoteView(quoteId: string): QuoteView {
  const quote = store.quotes.find((q) => q.id === quoteId)!;
  const leadDomain = store.leadDomains.find((ld) => ld.id === quote.leadDomainId)!;
  return {
    quote,
    professional: toProfessionalSummary(quote.professionalId, leadDomain.domainId),
    domain: domainById(leadDomain.domainId),
  };
}

export function toLeadDomainView(leadDomainId: string): LeadDomainView {
  const leadDomain = store.leadDomains.find((ld) => ld.id === leadDomainId)!;
  const domain = domainById(leadDomain.domainId);

  return {
    leadDomain,
    domain,
    assignments: store.leadDomainAssignments
      .filter((a) => a.leadDomainId === leadDomainId)
      .map((assignment) => ({
        assignment,
        professional: toProfessionalSummary(assignment.professionalId, domain.id),
      })),
    quotes: store.quotes
      .filter((q) => q.leadDomainId === leadDomainId)
      .sort((a, b) => a.total - b.total)
      .map((q) => toQuoteView(q.id)),
    meetings: store.meetings
      .filter((m) => m.leadDomainId === leadDomainId)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
      .map((meeting) => ({
        meeting,
        professional: toProfessionalSummary(meeting.professionalId, domain.id),
      })),
    items: store.leadDomainItems.filter((i) => i.leadDomainId === leadDomainId),
    selectedProfessional: leadDomain.selectedProfessionalId
      ? toProfessionalSummary(leadDomain.selectedProfessionalId, domain.id)
      : null,
    unreadMessages: store.messages.filter(
      (m) =>
        m.leadDomainId === leadDomainId &&
        m.channel === "client_platform" &&
        m.senderRole === "platform" &&
        m.readAt === null,
    ).length,
  };
}

export function toLeadView(leadId: string): LeadView {
  const lead = store.leads.find((l) => l.id === leadId)!;
  const domainViews = store.leadDomains
    .filter((ld) => ld.leadId === leadId)
    .map((ld) => toLeadDomainView(ld.id));

  return {
    lead,
    client: toClientSummary(lead.clientId),
    city: cityById(lead.cityId),
    domains: domainViews,
    domainNames: domainViews.map((d) => d.domain.name),
    isMultiDomain: domainViews.length > 1,
  };
}

/* ---- agreements & projects ---- */

export function toProjectView(projectId: string): ProjectView {
  const project = store.projects.find((p) => p.id === projectId)!;
  const leadDomain = store.leadDomains.find((ld) => ld.id === project.leadDomainId)!;
  return {
    project,
    domain: domainById(leadDomain.domainId),
    professional: toProfessionalSummary(project.professionalId, leadDomain.domainId),
    client: toClientSummary(project.clientId),
    review: store.reviews.find((r) => r.projectId === projectId) ?? null,
  };
}

export function toAgreementView(agreementId: string): AgreementView {
  const agreement = store.agreements.find((a) => a.id === agreementId)!;
  const links = store.agreementLeadDomains.filter((l) => l.agreementId === agreementId);

  return {
    agreement,
    professional: toProfessionalSummary(agreement.professionalId),
    client: toClientSummary(agreement.clientId),
    lines: links.map((link) => {
      const leadDomain = store.leadDomains.find((ld) => ld.id === link.leadDomainId)!;
      return {
        link,
        domain: domainById(leadDomain.domainId),
        quote: store.quotes.find((q) => q.id === link.quoteId)!,
      };
    }),
    isCombined: links.length > 1,
    projects: store.projects
      .filter((p) => p.agreementId === agreementId)
      .map((p) => toProjectView(p.id)),
    invoice: store.commissionInvoices.find((i) => i.agreementId === agreementId) ?? null,
  };
}
