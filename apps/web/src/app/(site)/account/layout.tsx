import { redirect } from "next/navigation";
import {
  authenticationRequired,
  getActor,
  getSessionUser,
  listAgreementsForClient,
  listLeadsForClient,
  listNotifications,
} from "@repo/data";
import { signOutAction } from "./../login/actions";
import { AccountNav } from "@/components/account/account-nav";
import { ButtonLink, Container } from "@repo/ui";

/**
 * Never statically generated.
 *
 * Everything below this layout is scoped to whoever is signed in. A prerendered
 * copy would be one person's data baked into a build artifact and served to
 * everybody — and it also means the build tries to render these pages with no
 * session at all, which fails as soon as a real backend is configured.
 */
export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  // Checked here rather than left to the first query that needs an identity:
  // somebody whose session expired should land on the sign-in page, not on an
  // error boundary explaining that they are not authenticated.
  const actor = await getActor();
  if (!actor && authenticationRequired()) redirect("/login");
  if (actor && actor.role !== "client") redirect(actor.role === "professional" ? "/partner" : "/");

  const sessionUser = await getSessionUser();

  const [leads, agreements, notifications] = await Promise.all([
    listLeadsForClient(),
    listAgreementsForClient(),
    listNotifications(),
  ]);

  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-[70vh] bg-paper">
      <div className="border-b border-line bg-surface">
        <Container width="wide" className="pt-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[12px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-clay">
                {sessionUser
                  ? `Signed in as ${sessionUser.name}${authenticationRequired() ? "" : " · demo account"}`
                  : "Demo account"}
              </p>
              <h1 className="mt-2 text-[30px] leading-none sm:text-[34px]">My requirements</h1>
            </div>
            {/* The primary action of this whole area, so it sits with the
                heading rather than only on the list tab. Full width on mobile,
                where a right-aligned button next to a wrapped heading reads as
                an afterthought. */}
            <div className="flex w-full items-center gap-3 sm:w-auto">
              <ButtonLink href="/submit-requirement" className="flex-1 sm:flex-none">
                Post a new requirement
              </ButtonLink>
              {authenticationRequired() ? (
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="whitespace-nowrap rounded-full border border-line-strong px-4 py-2.5 text-[14px] text-ink-3 transition-colors hover:text-ink sm:text-[13px]"
                  >
                    Sign out
                  </button>
                </form>
              ) : null}
            </div>
          </div>
          <AccountNav
            counts={{
              requirements: leads.length,
              agreements: agreements.length,
              notifications: unread,
            }}
          />
        </Container>
      </div>

      <Container width="wide" className="py-10">{children}</Container>
    </div>
  );
}
