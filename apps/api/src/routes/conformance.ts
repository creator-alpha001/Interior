/**
 * Does each handler still return what its route promises?
 *
 * `CONTEXT.md` claims the platform's central property: "a response that drifts
 * from what a screen renders is a compile error, because both sides import
 * packages/types". That held for the *frontends*, which consume the view models
 * directly. It never held for the API, whose handlers returned whatever the
 * repository happened to return — the manifest's `response` field was a phantom
 * type that nothing read.
 *
 * This file makes the claim true on the server side too, and extends it to the
 * mobile client: `response` now feeds the OpenAPI document, the OpenAPI
 * document generates the Dart models, and every line below fails the build if a
 * repository stops returning the shape its route advertises.
 *
 * There is no runtime here on purpose. It is types only; `tsc` is the test.
 * Adding a route without a line here is caught by the manifest coverage test in
 * `tests/contract.test.ts`, so this cannot quietly fall behind.
 */
import type { z } from "zod";
import type { routes } from "@repo/contract";

import type * as catalogue from "../modules/catalogue/repository";
import type * as content from "../modules/content/repository";
import type * as directory from "../modules/directory/repository";
import type * as search from "../modules/search/repository";
import type * as customer from "../modules/customer/repository";
import type * as customerWrite from "../modules/customer/mutations";
import type * as vendor from "../modules/vendor/repository";
import type * as vendorWrite from "../modules/vendor/mutations";
import type * as onboarding from "../modules/vendor/onboarding";
import type * as verification from "../modules/vendor/verification";
import type * as uploads from "../modules/uploads/repository";
import type * as sessions from "../modules/auth/sessions";
import type * as closure from "../modules/auth/closure";
import type * as applications from "../modules/applications/repository";
import type * as applicationWrite from "../modules/applications/mutations";

/* ------------------------------------------------------------------ *
 * The mechanism
 * ------------------------------------------------------------------ */

/** Fails to compile unless `T` is exactly `true`. The constraint is the test. */
type Assert<T extends true> = T;

/** What a route says it returns, unwrapped from its schema. */
type Promised<R> = R extends { response?: infer S }
  ? NonNullable<S> extends z.ZodTypeAny
    ? z.infer<NonNullable<S>>
    : never
  : never;

/**
 * True when a handler's actual return type satisfies the route's promise.
 *
 * `Awaited` because every handler is async. Assignability rather than equality
 * is deliberate: a handler returning a *narrower* type than the schema
 * describes is fine — `Rupees` where the schema says `number`, a literal union
 * where it says `string`. The failure this catches is the other direction, a
 * handler returning something the schema cannot describe.
 */
type Conforms<Route, Actual> = Awaited<Actual> extends Promised<Route> ? true : false;

/**
 * Reads as one line per endpoint: "this function answers this route".
 *
 * Resolves to `true` on a match, and otherwise to an object carrying both
 * shapes — so the compiler prints what the route promised and what the handler
 * actually returns, rather than a bare "false is not true". The `Assert` that
 * turns it into a build failure sits at each use site, because a constraint
 * applied inside this alias would fire on the generic definition instead of on
 * the route that is actually wrong.
 */
type Check<Route, Fn extends (...args: never[]) => unknown> = Conforms<
  Route,
  ReturnType<Fn>
> extends true
  ? true
  : {
      error: "handler does not return what its route promises";
      routePromised: Promised<Route>;
      handlerReturns: Awaited<ReturnType<Fn>>;
    };

/* ------------------------------------------------------------------ *
 * Public reads
 * ------------------------------------------------------------------ */

export type _listDomains = Assert<Check<typeof routes.listDomains, typeof catalogue.listDomains>>;
export type _listCities = Assert<Check<typeof routes.listCities, typeof catalogue.listCities>>;
export type _listProducts = Assert<Check<typeof routes.listProducts, typeof catalogue.listProducts>>;
export type _listRelatedProducts = Assert<Check<
  typeof routes.listRelatedProducts,
  typeof catalogue.listRelatedProducts
>>;
export type _listCategories = Assert<Check<typeof routes.listCategories, typeof catalogue.listCategories>>;
export type _listPackages = Assert<Check<typeof routes.listPackages, typeof catalogue.listPackages>>;
export type _catalogueCounts = Assert<Check<
  typeof routes.catalogueCounts,
  typeof catalogue.countCatalogueByDomain
>>;

export type _listProfessionals = Assert<Check<
  typeof routes.listProfessionals,
  typeof directory.listProfessionals
>>;
export type _listPortfolio = Assert<Check<typeof routes.listPortfolio, typeof directory.listPortfolio>>;
export type _platformStats = Assert<Check<typeof routes.platformStats, typeof directory.getPlatformStats>>;

export type _listPosts = Assert<Check<typeof routes.listPosts, typeof content.listPosts>>;
export type _listRelatedPosts = Assert<Check<
  typeof routes.listRelatedPosts,
  typeof content.listRelatedPosts
>>;
export type _listPostCategories = Assert<Check<
  typeof routes.listPostCategories,
  typeof content.listBlogCategories
>>;
export type _listPostTags = Assert<Check<typeof routes.listPostTags, typeof content.listBlogTags>>;
export type _listBanners = Assert<Check<typeof routes.listBanners, typeof content.listBanners>>;
export type _listTestimonials = Assert<Check<
  typeof routes.listTestimonials,
  typeof content.listTestimonials
>>;

export type _search = Assert<Check<typeof routes.search, typeof search.search>>;
export type _searchSuggest = Assert<Check<typeof routes.searchSuggest, typeof search.searchSuggestions>>;

/**
 * The four public reads whose handler narrows a nullable repository result.
 *
 * `getProductBySlug` answers `ProductView | null` and the route throws 404 on
 * the null, so the response really is non-nullable. Checked against the
 * narrowed type rather than the repository's, because that is what goes on the
 * wire.
 */
export type _getDomain = Assert<Check<
  typeof routes.getDomain,
  () => Promise<NonNullable<Awaited<ReturnType<typeof catalogue.getDomainBySlug>>>>
>>;
export type _getProduct = Assert<Check<
  typeof routes.getProduct,
  () => Promise<NonNullable<Awaited<ReturnType<typeof catalogue.getProductBySlug>>>>
>>;
export type _getPackage = Assert<Check<
  typeof routes.getPackage,
  () => Promise<NonNullable<Awaited<ReturnType<typeof catalogue.getPackageBySlug>>>>
>>;
export type _getProfessional = Assert<Check<
  typeof routes.getProfessional,
  () => Promise<NonNullable<Awaited<ReturnType<typeof directory.getProfessional>>>>
>>;
export type _getPost = Assert<Check<
  typeof routes.getPost,
  () => Promise<NonNullable<Awaited<ReturnType<typeof content.getPostBySlug>>>>
>>;

/* ------------------------------------------------------------------ *
 * Identity
 *
 * `me` is the one worth reading twice. It answers `SessionUser`, which carries
 * the signed-in person's own mobile number — correct, and the reason
 * `MaskedClientSummary` exists separately for anybody else's.
 * ------------------------------------------------------------------ */

export type _me = Assert<
  Check<
    typeof routes.me,
    () => Promise<NonNullable<Awaited<ReturnType<typeof sessions.resolveSession>>>>
  >
>;
export type _deleteAccount = Assert<Check<typeof routes.deleteAccount, typeof closure.closeAccount>>;

/* ------------------------------------------------------------------ *
 * Uploads
 * ------------------------------------------------------------------ */

export type _createUploadTicket = Assert<Check<
  typeof routes.createUploadTicket,
  typeof uploads.createUploadTicket
>>;

/* ------------------------------------------------------------------ *
 * The customer surface
 * ------------------------------------------------------------------ */

export type _listRequirements = Assert<Check<
  typeof routes.listRequirements,
  typeof customer.listRequirements
>>;
export type _getRequirement = Assert<Check<typeof routes.getRequirement, typeof customer.getRequirement>>;
export type _createRequirement = Assert<Check<
  typeof routes.createRequirement,
  typeof customerWrite.submitRequirement
>>;
export type _listServiceMessages = Assert<Check<
  typeof routes.listServiceMessages,
  typeof customer.listMessages
>>;
export type _sendServiceMessage = Assert<Check<
  typeof routes.sendServiceMessage,
  typeof customerWrite.sendMessage
>>;
export type _selectQuote = Assert<Check<typeof routes.selectQuote, typeof customerWrite.selectQuote>>;
export type _listAgreements = Assert<Check<typeof routes.listAgreements, typeof customer.listAgreements>>;
/** Generates, then answers with the refreshed list rather than the ids. */
export type _generateAgreements = Assert<Check<
  typeof routes.generateAgreements,
  typeof customer.listAgreements
>>;
export type _signAgreement = Assert<Check<
  typeof routes.signAgreement,
  typeof customerWrite.signAgreement
>>;
export type _listProjects = Assert<Check<typeof routes.listProjects, typeof customer.listProjects>>;
export type _submitReview = Assert<Check<typeof routes.submitReview, typeof customerWrite.submitReview>>;
export type _requestReschedule = Assert<Check<
  typeof routes.requestReschedule,
  typeof customerWrite.requestReschedule
>>;
export type _listNotifications = Assert<Check<
  typeof routes.listNotifications,
  typeof customer.listNotifications
>>;
export type _listTickets = Assert<Check<typeof routes.listTickets, typeof customer.listTickets>>;
export type _createTicket = Assert<Check<typeof routes.createTicket, typeof customerWrite.createTicket>>;
export type _replyToTicket = Assert<Check<
  typeof routes.replyToTicket,
  typeof customerWrite.replyToTicket
>>;
export type _referrals = Assert<Check<typeof routes.referrals, typeof customer.getReferralSummary>>;

/** Null is a real answer here: most customers have never applied. */
export type _myProfessionalApplication = Assert<Check<
  typeof routes.myProfessionalApplication,
  typeof applications.myApplication
>>;
export type _submitProfessionalApplication = Assert<Check<
  typeof routes.submitProfessionalApplication,
  typeof applicationWrite.submitApplication
>>;
export type _withdrawProfessionalApplication = Assert<Check<
  typeof routes.withdrawProfessionalApplication,
  typeof applicationWrite.withdrawApplication
>>;

/* ------------------------------------------------------------------ *
 * The vendor surface
 * ------------------------------------------------------------------ */

export type _vendorLeads = Assert<Check<typeof routes.vendorLeads, typeof vendor.listLeads>>;
export type _vendorLead = Assert<Check<typeof routes.vendorLead, typeof vendor.getLead>>;
/** Records the response, then answers with the lead as it now stands. */
export type _respondToLead = Assert<Check<typeof routes.respondToLead, typeof vendor.getLead>>;
export type _submitQuote = Assert<Check<typeof routes.submitQuote, typeof vendorWrite.submitQuote>>;
export type _vendorThread = Assert<Check<typeof routes.vendorThread, typeof vendor.listThread>>;
export type _sendVendorMessage = Assert<Check<
  typeof routes.sendVendorMessage,
  typeof vendorWrite.sendMessage
>>;
export type _vendorDashboard = Assert<Check<typeof routes.vendorDashboard, typeof vendor.getDashboard>>;
export type _vendorAgreements = Assert<Check<
  typeof routes.vendorAgreements,
  typeof vendor.listAgreements
>>;
export type _vendorProjects = Assert<Check<typeof routes.vendorProjects, typeof vendor.listProjects>>;
/** Proof is submitted, then the refreshed project list comes back. */
export type _submitMilestoneProof = Assert<Check<
  typeof routes.submitMilestoneProof,
  typeof vendor.listProjects
>>;
export type _vendorInvoices = Assert<Check<typeof routes.vendorInvoices, typeof vendor.listInvoices>>;
export type _vendorVisits = Assert<Check<typeof routes.vendorVisits, typeof vendor.listVisits>>;
export type _vendorPerformance = Assert<Check<
  typeof routes.vendorPerformance,
  typeof vendor.getPerformance
>>;
export type _vendorPortfolio = Assert<Check<typeof routes.vendorPortfolio, typeof vendor.listPortfolio>>;
export type _vendorOnboarding = Assert<Check<
  typeof routes.vendorOnboarding,
  typeof onboarding.getOnboarding
>>;
export type _signPartnerAgreement = Assert<Check<
  typeof routes.signPartnerAgreement,
  typeof vendorWrite.signPartnerAgreement
>>;
export type _vendorVerification = Assert<Check<
  typeof routes.vendorVerification,
  typeof verification.getVerification
>>;
export type _submitSignedCopy = Assert<Check<
  typeof routes.submitSignedCopy,
  typeof verification.submitSignedCopy
>>;
export type _reportHardcopy = Assert<Check<
  typeof routes.reportHardcopy,
  typeof verification.reportHardcopy
>>;
export type _submitVendorDocument = Assert<Check<
  typeof routes.submitVendorDocument,
  typeof verification.submitDocument
>>;
