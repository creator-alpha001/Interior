import type { Metadata } from "next";
import { VendorShell } from "@/components/partner/vendor-shell";

export const metadata: Metadata = {
  title: { default: "Aangan for Professionals", template: "%s · Aangan Pro" },
  description: "Qualified leads, quoting, agreements and payments for verified professionals.",
  // The portal sits on the customer domain but is never a landing page.
  robots: { index: false, follow: false },
};

/**
 * The professional portal lives on the same site as the customer experience so
 * vendors have one address to remember and reach it through a normal sign-in —
 * but it presents its own chrome, not the customer header and footer.
 *
 * `partner-portal` switches the page to the denser type scale these screens
 * were designed at.
 */
export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return <div className="partner-portal">{
    <VendorShell>{children}</VendorShell>
  }</div>;
}
