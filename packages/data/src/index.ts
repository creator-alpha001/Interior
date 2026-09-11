/**
 * The single data-access seam for every app in this monorepo.
 *
 * Screens import from here and nowhere else. Today these functions resolve
 * against an in-memory mock store; when the backend is built, only the bodies
 * change — every signature, view model and screen stays exactly as it is.
 */
export * from "./client";
export * from "./session";
export * from "./auth";
export * from "./profile";
export * from "./uploads";
export * from "./catalogue";
export * from "./client-actions";
export * from "./estimator";
export * from "./search";
export * from "./ops";
export * from "./ops-extra";
export * from "./attention";
export * from "./onboarding";
export * from "./verification";
export * from "./showcase";
export * from "./applications";
export * from "./admin";
export * from "./vendor";
export * from "./content";
export * from "./directory";
export * from "./leads";
export {
  cityById,
  domainById,
  domainBySlug,
  toAgreementView,
  toClientSummary,
  toLeadView,
  toPackageView,
  toProductView,
  toProfessionalProfile,
  toProfessionalSummary,
  toMaskedClientSummary,
  toProjectView,
  toQuoteView,
} from "./mappers";

export { formatRupees, formatRupeesShort, priceUnitLabel } from "@repo/mock";
