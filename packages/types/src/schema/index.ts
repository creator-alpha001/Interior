/**
 * The runtime response contract.
 *
 * `@repo/types` (the default entry) is the type-only view of everything here.
 * This entry is the same shapes as values — importable by anything that needs
 * to *validate* a response rather than merely describe one: the API's OpenAPI
 * document, and through it the generated Dart models the mobile app renders.
 *
 * Importing this pulls zod in. Screens should not: they want `@repo/types`.
 */
export * from "./common";
export * from "./identity";
export * from "./domains";
export * from "./leads";
export * from "./flow";
export * from "./agreements";
export * from "./execution";
export * from "./catalog";
export * from "./content";
export * from "./notifications";
export * from "./onboarding";
export * from "./views";
