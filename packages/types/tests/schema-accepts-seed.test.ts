/**
 * Every response schema, run against the real seed data.
 *
 * The typecheck across the monorepo already proves the schemas and the
 * TypeScript types describe the same shape. It cannot prove either one
 * describes *reality* — a field typed `string` that is null in practice, or an
 * enum missing a value the seed actually uses, compiles perfectly and fails on
 * the first request.
 *
 * `@repo/mock` is the API's own seed source, so parsing it here is the closest
 * thing to parsing production rows without a database. A schema that rejects
 * the seed would have rejected a real response.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import * as seed from "@repo/mock";
import * as schema from "../src/schema/index";

/**
 * One entry per seeded collection. Adding an entity to `@repo/mock` without
 * adding it here is caught by `covers every seeded collection` below, so this
 * list cannot quietly fall behind.
 */
const collections: Array<[string, z.ZodTypeAny, unknown[]]> = [
  ["adminRoles", schema.adminRoleSchema, seed.adminRoles],
  ["adminUserRecords", schema.adminUserSchema, seed.adminUserRecords],
  ["adminUsers", schema.userSchema, seed.adminUsers],
  ["agreementLeadDomains", schema.agreementLeadDomainSchema, seed.agreementLeadDomains],
  ["agreements", schema.agreementSchema, seed.agreements],
  ["banners", schema.bannerSchema, seed.banners],
  ["blogCategories", schema.blogCategorySchema, seed.blogCategories],
  ["blogPosts", schema.blogPostSchema, seed.blogPosts],
  ["blogTags", schema.blogTagSchema, seed.blogTags],
  ["cities", schema.citySchema, seed.cities],
  ["clientUsers", schema.userSchema, seed.clientUsers],
  ["clients", schema.clientSchema, seed.clients],
  ["commissionInvoices", schema.commissionInvoiceSchema, seed.commissionInvoices],
  ["domains", schema.domainSchema, seed.domains],
  ["leadDomainAssignments", schema.leadDomainAssignmentSchema, seed.leadDomainAssignments],
  ["leadDomainItems", schema.leadDomainItemSchema, seed.leadDomainItems],
  ["leadDomains", schema.leadDomainSchema, seed.leadDomains],
  ["leadSalesActivities", schema.leadSalesActivitySchema, seed.leadSalesActivities],
  ["leads", schema.leadSchema, seed.leads],
  ["meetings", schema.meetingSchema, seed.meetings],
  ["messages", schema.messageSchema, seed.messages],
  [
    "professionalApplications",
    schema.professionalApplicationSchema,
    seed.professionalApplications,
  ],
  ["notifications", schema.notificationSchema, seed.notifications],
  ["packageItems", schema.packageItemSchema, seed.packageItems],
  ["partnerAgreements", schema.partnerAgreementSchema, seed.partnerAgreements],
  ["portfolioItems", schema.portfolioItemSchema, seed.portfolioItems],
  ["productCategories", schema.productCategorySchema, seed.productCategories],
  ["productCityPrices", schema.productCityPriceSchema, seed.productCityPrices],
  ["products", schema.productSchema, seed.products],
  ["professionalDomains", schema.professionalDomainSchema, seed.professionalDomains],
  [
    "professionalServiceAreas",
    schema.professionalServiceAreaSchema,
    seed.professionalServiceAreas,
  ],
  ["professionalUsers", schema.userSchema, seed.professionalUsers],
  ["professionals", schema.professionalSchema, seed.professionals],
  ["projects", schema.projectSchema, seed.projects],
  ["quotes", schema.quoteSchema, seed.quotes],
  ["referrals", schema.referralSchema, seed.referrals],
  ["reviews", schema.reviewSchema, seed.reviews],
  ["salesAgents", schema.salesAgentSchema, seed.salesAgents],
  ["salesUsers", schema.userSchema, seed.salesUsers],
  ["servicePackages", schema.servicePackageSchema, seed.servicePackages],
  ["supportTickets", schema.supportTicketSchema, seed.supportTickets],
  ["testimonials", schema.testimonialSchema, seed.testimonials],
  ["users", schema.userSchema, seed.users],
];

describe("response schemas accept the seed data", () => {
  it.each(collections)("%s", (name, itemSchema, rows) => {
    // A collection that is empty proves nothing, and an empty fixture is
    // usually a sign the seed moved rather than that the entity has no rows.
    expect(rows.length, `${name} has no seed rows to validate against`).toBeGreaterThan(0);

    const result = z.array(itemSchema).safeParse(rows);
    if (!result.success) {
      const issues = result.error.issues
        .slice(0, 10)
        .map((i) => `  [${i.path.join(".")}] ${i.message}`)
        .join("\n");
      throw new Error(
        `${name}: ${result.error.issues.length} row(s) rejected by the schema\n${issues}`,
      );
    }
  });

  it("the non-collection singletons parse too", () => {
    expect(schema.partnerTermsSchema.safeParse(seed.partnerTerms).success).toBe(true);
  });
});

describe("the seed list stays complete", () => {
  it("covers every array exported by @repo/mock", () => {
    const covered = new Set(collections.map(([name]) => name));
    const exported = Object.entries(seed)
      .filter(([, value]) => Array.isArray(value) && value.length > 0)
      .map(([name]) => name);

    const uncovered = exported.filter((name) => !covered.has(name));
    expect(
      uncovered,
      `these seed collections have no schema check — add them to \`collections\``,
    ).toEqual([]);
  });
});

describe("masking is structural, not procedural", () => {
  /**
   * The platform's central promise: a vendor never receives a customer's phone
   * number or email. That is enforced by the *shape* — there is no key to put
   * one in — and this asserts the shape rather than any particular query.
   *
   * It matters more now than it did: these schemas generate the mobile app's
   * Dart models, so a field added here would reach a vendor's phone.
   */
  it("MaskedClientSummary has no contact fields, and strips them if sent", () => {
    const withContact = {
      displayName: "Priya S.",
      city: seed.cities[0],
      locality: "Gomti Nagar",
      address: null,
      contactReleased: false as const,
      mobile: "919839012477",
      email: "priya@example.com",
    };

    const parsed = schema.maskedClientSummarySchema.parse(withContact);
    expect(parsed).not.toHaveProperty("mobile");
    expect(parsed).not.toHaveProperty("email");
  });

  it("refuses a masked client that claims contact was released", () => {
    const released = {
      displayName: "Priya S.",
      city: seed.cities[0],
      locality: "Gomti Nagar",
      address: "12 Vipul Khand",
      contactReleased: true,
    };

    expect(schema.maskedClientSummarySchema.safeParse(released).success).toBe(false);
  });
});
