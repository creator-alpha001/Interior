import { listAgreementsForClient, listLeadsForClient, listNotifications } from "@repo/data";
import { AccountNav } from "@/components/account/account-nav";
import { ButtonLink, Container } from "@repo/ui";

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
