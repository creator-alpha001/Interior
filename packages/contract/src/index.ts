/**
 * The API contract: what a request must look like, and where to send it.
 *
 * `@repo/types` is type-only and describes responses. This package is its
 * runtime counterpart — Zod schemas that validate input, plus a manifest of
 * every endpoint. The server and `@repo/data` both read from here, so neither
 * can drift from the other without a compile error.
 *
 * Modules are added as their milestone lands. Public reads and auth are here;
 * the customer, vendor and ops surfaces follow.
 */
export * from "./http";
export * from "./common";
export * from "./auth";
export * from "./catalogue";

import { authRoutes } from "./auth";
import { catalogueRoutes } from "./catalogue";

/** Every route, in one object, for the server to iterate over. */
export const routes = {
  ...authRoutes,
  ...catalogueRoutes,
} as const;

export type RouteName = keyof typeof routes;
