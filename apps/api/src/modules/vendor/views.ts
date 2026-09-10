/**
 * What a vendor is allowed to see about a customer.
 *
 * This is the most consequential file in the API. The platform's whole
 * proposition is that it sits between the two sides — if a vendor can reach the
 * customer directly, the relationship and the commission go with them, and the
 * customer loses the protection of having somebody to complain to.
 *
 * So the rule is structural rather than procedural. `MaskedClientSummary` has
 * no field for a phone number or an email; there is no query below that selects
 * `users.mobile`; and the address is released only when the database says a
 * visit has been confirmed. A leak would have to be a deliberate change to the
 * type, not an oversight in a `select`.
 */
import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { MaskedClientSummary } from "@repo/types";
import { db } from "../../db/client";
import * as t from "../../db/schema";
import { toCity } from "../../lib/mappers";

/**
 * Masked customer details for a set of services.
 *
 * Keyed by lead-domain rather than by customer, because the address release is
 * a property of *that service's* visit: a vendor booked for the painting has no
 * business seeing the address because somebody else's furniture visit was
 * confirmed.
 */
export async function maskedClientsFor(
  leadDomainIds: string[],
): Promise<Map<string, MaskedClientSummary>> {
  const byLeadDomain = new Map<string, MaskedClientSummary>();
  if (leadDomainIds.length === 0) return byLeadDomain;

  const rows = await db
    .select({
      leadDomainId: t.leadDomains.id,
      // Deliberately narrow. `users.mobile` and `users.email` are not selected
      // anywhere in this module, so they cannot reach a response by accident.
      name: t.users.name,
      address: t.clients.address,
      city: t.cities,
      /**
       * The address is released for this service only once a visit is
       * confirmed. Computed in SQL so the answer comes from the same place the
       * coordinator wrote it, rather than from a mapper that could drift.
       */
      addressReleased: sql<boolean>`EXISTS (
        SELECT 1 FROM ${t.meetings} m
        WHERE m.lead_domain_id = ${t.leadDomains.id}
          AND m.address_released_at IS NOT NULL
          AND m.status IN ('confirmed', 'completed')
      )`,
    })
    .from(t.leadDomains)
    .innerJoin(t.leads, eq(t.leads.id, t.leadDomains.leadId))
    .innerJoin(t.clients, eq(t.clients.id, t.leads.clientId))
    .innerJoin(t.users, eq(t.users.id, t.clients.userId))
    .innerJoin(t.cities, eq(t.cities.id, t.leads.cityId))
    .where(inArray(t.leadDomains.id, leadDomainIds));

  for (const row of rows) {
    byLeadDomain.set(row.leadDomainId, {
      displayName: shortName(row.name),
      city: toCity(row.city),
      locality: localityOf(row.address),
      address: row.addressReleased ? row.address : null,
      contactReleased: false,
    });
  }

  return byLeadDomain;
}

/**
 * A masked customer with no service in context — the agreements screen.
 *
 * The address is never released here, whatever visits exist: a signed contract
 * is not a reason to hand over a home address outside the visit it was booked
 * for.
 */
export async function maskedClientsById(
  clientIds: string[],
): Promise<Map<string, MaskedClientSummary>> {
  const byId = new Map<string, MaskedClientSummary>();
  const unique = [...new Set(clientIds)];
  if (unique.length === 0) return byId;

  /*
   * The city comes from the account here, not from a lead, and the account may
   * not have one — `users.city_id` is nullable since signup stopped insisting.
   * So this is a LEFT join: an inner one would drop the client from the map
   * entirely, and the agreements screen would render a signed contract with no
   * customer against it.
   *
   * `maskedClientsFor` above has no such problem and needs no such care: it
   * joins the *lead's* city, which is required by the requirement form and is
   * in any case the more useful answer when there is a job in context.
   */
  const rows = await db
    .select({
      clientId: t.clients.id,
      name: t.users.name,
      address: t.clients.address,
      city: t.cities,
    })
    .from(t.clients)
    .innerJoin(t.users, eq(t.users.id, t.clients.userId))
    .leftJoin(t.cities, eq(t.cities.id, t.users.cityId))
    .where(inArray(t.clients.id, unique));

  for (const row of rows) {
    byId.set(row.clientId, {
      displayName: shortName(row.name),
      city: row.city ? toCity(row.city) : null,
      locality: localityOf(row.address),
      address: null,
      contactReleased: false,
    });
  }

  return byId;
}

/** "Priya Sharma" becomes "Priya S." — enough to greet somebody by. */
function shortName(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/);
  if (!first) return "Customer";
  const last = rest[rest.length - 1];
  return last ? `${first} ${last.charAt(0)}.` : first;
}

/**
 * The locality out of a full address.
 *
 * Released before a visit is confirmed because a vendor cannot price a job
 * without knowing roughly where it is — travel, parking and access all depend
 * on it. The second-to-last comma-separated part is the locality in the way
 * Indian addresses are normally written; the whole string is never returned.
 */
function localityOf(address: string | null): string {
  if (!address) return "";
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2]! : (parts[0] ?? "");
}
