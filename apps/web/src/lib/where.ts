import type { MaskedClientSummary } from "@repo/types";

/**
 * Where a customer is, in one line, for the vendor portal.
 *
 * Exists because the city can be absent. Signing up no longer requires one —
 * a person may have come in through Google and not yet said where they are —
 * and six screens were each rendering `${locality}, ${city.name}` on the
 * assumption that it could not be. One of those would have printed
 * "Gomti Nagar, undefined" on a lead card.
 *
 * Where a lead is in context the city is the *lead's* and is always present,
 * so this reads exactly as it did before. It is the agreements and projects
 * screens, which have no lead in context and fall back to the account, where
 * the missing half has to be dropped rather than shown.
 */
export function whereClientIs(client: Pick<MaskedClientSummary, "locality" | "city">): string {
  return [client.locality, client.city?.name].filter(Boolean).join(", ");
}
