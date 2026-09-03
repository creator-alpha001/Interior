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

/**
 * Asserts that a row the seed store was asked for actually exists.
 *
 * There is one situation where it will not, and it is confusing enough to be
 * worth a real message: a backend is configured and somebody has signed in, so
 * the session carries database ids — but the module serving this screen still
 * reads the seed store, which is keyed by its own ids. Nothing matches.
 *
 * Without this the failure is `Cannot read properties of undefined`, several
 * frames from the cause. With it, the message says which surface is not wired
 * yet.
 */
export function seedRow<T>(row: T | undefined, kind: string, id: string): T {
  if (row !== undefined) return row;

  throw new Error(
    `No seeded ${kind} with id "${id}". ` +
      "This usually means a real session is in use while this surface still " +
      "reads seed data — see the migration order in API.md. Set " +
      "NEXT_PUBLIC_ALLOW_DEMO_SESSION=true, or wire this module to the API.",
  );
}
