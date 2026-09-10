import { authenticationRequired, getActor, getSessionUser, listCities } from "@repo/data";
import { pendingGoogleLink } from "@/app/(site)/login/actions";
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
  const [cities, selectedCity, actor, pendingGoogle] = await Promise.all([
    listCities(),
    getSelectedCity(),
    getActor(),
    pendingGoogleLink(),
  ]);

  /**
   * The name to show, and only when there is a real session behind it.
   *
   * `getSessionUser()` fills in the seeded demo person where nobody is signed
   * in, so it is read only once `getActor()` has said somebody is — otherwise
   * the header would greet a visitor by a stranger's name.
   */
  const signedInAsClient = actor?.role === "client";
  const person = signedInAsClient ? await getSessionUser() : null;
  return (
    <HeaderNav
      cities={cities}
      selectedCity={selectedCity}
      signedInAsClient={signedInAsClient}
      accountName={person?.name ?? null}
      // A Google sign-in waiting on a mobile number. Not a session, so nothing
      // personal is shown — but offering "Sign in" while one is half-finished
      // is what made the state unreadable.
      completingSignIn={Boolean(pendingGoogle)}
      // No backend, so both portals render seed data without anybody signing
      // in. The menu says so rather than presenting them as a real session.
      demoMode={!authenticationRequired()}
    />
  );
}
