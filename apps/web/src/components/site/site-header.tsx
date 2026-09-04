import { authenticationRequired, getActor, listCities } from "@repo/data";
import { HeaderNav } from "@/components/site/header-nav";
import { getSelectedCity } from "@/lib/city";

/**
 * Server wrapper so the selected city is resolved once, on the server, and the
 * header never flashes the wrong one on first paint.
 *
 * `getActor()` — not `getSessionUser()` — is what decides the sign-in link:
 * the latter fills in the seeded demo person for display even where nobody has
 * actually signed in, which is right for a page that already knows it is
 * showing a demo account but wrong for a header deciding whether to invite a
 * visitor to sign in at all.
 */
export async function SiteHeader() {
  const [cities, selectedCity, actor] = await Promise.all([
    listCities(),
    getSelectedCity(),
    getActor(),
  ]);
  return (
    <HeaderNav
      cities={cities}
      selectedCity={selectedCity}
      signedInAsClient={actor?.role === "client"}
      // No backend, so both portals render seed data without anybody signing
      // in. The menu says so rather than presenting them as a real session.
      demoMode={!authenticationRequired()}
    />
  );
}
