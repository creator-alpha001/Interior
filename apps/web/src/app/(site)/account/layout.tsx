import { listAgreementsForClient, listLeadsForClient, listNotifications } from "@repo/data";
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
                Signed in as Priya Sharma · demo account
              </p>
              <h1 className="mt-2 text-[30px] leading-none sm:text-[34px]">My requirements</h1>
            </div>
            {/* The primary action of this whole area, so it sits with the
                heading rather than only on the list tab. Full width on mobile,
                where a right-aligned button next to a wrapped heading reads as
                an afterthought. */}
            <ButtonLink href="/submit-requirement" className="w-full sm:w-auto">
              Post a new requirement
            </ButtonLink>
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
