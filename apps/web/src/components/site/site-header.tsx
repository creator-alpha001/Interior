import { listCities } from "@repo/data";
import { HeaderNav } from "@/components/site/header-nav";
import { getSelectedCity } from "@/lib/city";

/**
 * Server wrapper so the selected city is resolved once, on the server, and the
 * header never flashes the wrong one on first paint.
 */
export async function SiteHeader() {
  const [cities, selectedCity] = await Promise.all([listCities(), getSelectedCity()]);
  return <HeaderNav cities={cities} selectedCity={selectedCity} />;
}
