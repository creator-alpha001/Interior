/**
 * The single data-access seam for every app in this monorepo.
 *
 * Screens import from here and nowhere else. Today these functions resolve
 * against an in-memory mock store; when the backend is built, only the bodies
 * change — every signature, view model and screen stays exactly as it is.
 */
export * from "./catalogue";
export * from "./client-actions";
export * from "./estimator";
export * from "./search";
export * from "./ops";
export * from "./ops-extra";
export * from "./onboarding";
export * from "./admin";
export * from "./vendor";
export * from "./content";
export * from "./directory";
export * from "./leads";
export { demoClientId, store } from "./store";
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
