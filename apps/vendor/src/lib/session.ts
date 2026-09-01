/**
 * Which professional the panel is signed in as. Becomes a session lookup with
 * real auth; every caller stays as it is.
 *
 * Aarohi is used for the demo because she works across two trades, which is
 * what makes the per-domain behaviour visible — separate ratings, separate
 * lead pools, and a combined agreement where one client hired her for both.
 */
export const CURRENT_PROFESSIONAL_ID = "pro-aarohi";
export const CURRENT_PROFESSIONAL_USER_ID = "user-pro-aarohi";
