/**
 * The mock adapter's in-memory store.
 *
 * Every repository function in this package reads from here. When the backend
 * lands, this file is replaced by an HTTP client and nothing above it changes —
 * screens import from `@repo/data`, never from `@repo/mock`.
 */
import * as seed from "@repo/mock";

export const store = {
  cities: [...seed.cities],
  domains: [...seed.domains],

  users: [...seed.users],
  clients: [...seed.clients],
  professionals: [...seed.professionals],
  professionalDomains: [...seed.professionalDomains],
  professionalServiceAreas: [...seed.professionalServiceAreas],
  portfolioItems: [...seed.portfolioItems],
  salesAgents: [...seed.salesAgents],
  adminRoles: [...seed.adminRoles],
  partnerAgreements: [...seed.partnerAgreements],

  productCategories: [...seed.productCategories],
  products: [...seed.products],
  productCityPrices: [...seed.productCityPrices],
  servicePackages: [...seed.servicePackages],
  packageItems: [...seed.packageItems],

  blogPosts: [...seed.blogPosts],
  blogCategories: [...seed.blogCategories],
  blogTags: [...seed.blogTags],
  banners: [...seed.banners],
  testimonials: [...seed.testimonials],

  leads: [...seed.leads],
  leadDomains: [...seed.leadDomains],
  leadDomainAssignments: [...seed.leadDomainAssignments],
  leadDomainItems: [...seed.leadDomainItems],
  leadSalesActivities: [...seed.leadSalesActivities],

  meetings: [...seed.meetings],
  quotes: [...seed.quotes],
  messages: [...seed.messages],

  agreements: [...seed.agreements],
  agreementLeadDomains: [...seed.agreementLeadDomains],
  projects: [...seed.projects],
  commissionInvoices: [...seed.commissionInvoices],
  reviews: [...seed.reviews],

  notifications: [...seed.notifications],
  supportTickets: [...seed.supportTickets],
  referrals: [...seed.referrals],
};

export const demoClientId = seed.demoClientId;

/** Simulated network latency, so loading states are real rather than theoretical. */
export const LATENCY_MS = 0;

export async function delay<T>(value: T): Promise<T> {
  if (LATENCY_MS > 0) {
    await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
  }
  return value;
}

let counter = 1000;
export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
