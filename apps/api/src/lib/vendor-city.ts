/**
 * Which city a vendor is shown in.
 *
 * Migration 0012 made `users.city_id` nullable, correctly: a Google sign-in may
 * never have been asked where somebody is, and null means "not told" rather
 * than a default. What did not follow was every query that reached the city
 * through it — they all inner-joined `cities` on `users.city_id`, and an inner
 * join on a nullable column does not render a card without a location. It drops
 * the row. A vendor with no city on their account disappeared from the public
 * directory, from the admin vendor list, and from the pool a lead is assigned
 * from — silently, with no error anywhere.
 *
 * That was already reachable through Google sign-up. It became guaranteed the
 * moment vendors could be created by approving an application, which sets
 * service areas and never touches the account's own city.
 *
 * So the city is resolved here instead, and the order is deliberate: the first
 * city a vendor *serves*, and only then the city on their account. For a
 * business those are answers to different questions — a proprietor living in
 * Kanpur whose workshop serves Lucknow should be found in Lucknow — and "where
 * do you work" is the one a customer is asking.
 *
 * Callers LEFT JOIN on this. A vendor with neither still appears, with no
 * location shown, because being unfindable is the worse failure.
 */
import { sql } from "drizzle-orm";
import * as t from "../db/schema";

export const vendorCityId = sql`COALESCE(
  (
    SELECT sa.city_id
    FROM ${t.professionalServiceAreas} sa
    WHERE sa.professional_id = ${t.professionals.id}
    ORDER BY sa.created_at ASC
    LIMIT 1
  ),
  ${t.users.cityId}
)`;

/** The join every vendor read uses in place of the old inner join. */
export const vendorCityJoin = sql`${t.cities.id} = ${vendorCityId}`;
