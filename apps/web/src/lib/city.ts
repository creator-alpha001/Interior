import { cookies } from "next/headers";
import { listCities, getSessionUser } from "@repo/data";
import type { City } from "@repo/types";

/**
 * Which city the catalogue should be rendered for, or null for all of them.
 *
 * Null is a real, supported answer and the reason this function changed shape.
 * It used to return `cities[0]` when it did not know — so somebody who had
 * never chosen was shown one city's prices, professionals and availability as
 * though they were the whole platform, with nothing on the page saying which
 * city they were looking at or that a choice had been made for them.
 *
 * Now "we have not been told" travels through to the screens, which show
 * everything and offer to narrow it. Every caller has to handle null; that is
 * the point, because every caller was previously handling a guess.
 *
 * The cookie wins, and the account is the fallback. That order matters in both
 * directions:
 *
 * - The account is what *travels*. Somebody who set their city in the app on
 *   their phone should not be asked again the first time they open a browser,
 *   where there is no cookie yet.
 * - The cookie is what *this browser is looking at*, and it has to win while
 *   they are looking at it. With the account in front, switching city here
 *   would depend on the write to the account succeeding — and that write is
 *   deliberately best-effort, so a blip would leave somebody pressing a city in
 *   the header and watching nothing change.
 *
 * `setCityAction` writes both, so they agree in the normal case; this decides
 * only what happens when they do not.
 */
export async function getSelectedCity(): Promise<City | null> {
  const [cities, jar, session] = await Promise.all([listCities(), cookies(), getSessionUser()]);

  const cookieCity = jar.get("city")?.value;

  /*
   * An explicit "no city" has to be distinguishable from "no cookie".
   *
   * `setCityAction(null)` deletes the cookie, so a signed-in person choosing
   * "All cities" would otherwise fall straight through to their account's city
   * and appear to have changed nothing. The account write clears it too, but
   * that write is best-effort — this is what makes the choice hold regardless.
   */
  const preferred = cookieCity ?? (jar.get("city_cleared")?.value ? undefined : session?.cityId);
  if (!preferred) return null;

  // A city that has since been deactivated, or an id from a stale cookie, is
  // not a reason to show the wrong catalogue — it is the same "we do not know"
  // as never having been asked.
  return cities.find((c) => c.id === preferred) ?? null;
}

