import { cookies } from "next/headers";
import { listCities } from "@repo/data";
import type { City } from "@repo/types";

/**
 * The visitor's selected city, read from a cookie on the server so every
 * price rendered on a page agrees with every other one. Falls back to the
 * first active city rather than throwing — a missing cookie is normal.
 */
export async function getSelectedCity(): Promise<City> {
  const cities = await listCities();
  const jar = await cookies();
  const id = jar.get("city")?.value;
  return cities.find((c) => c.id === id) ?? cities[0];
}
