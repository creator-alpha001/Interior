import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { VendorShell } from "@/components/vendor-shell";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Aangan for Professionals", template: "%s · Aangan Pro" },
  description: "Qualified leads, quoting, agreements and payments for verified professionals.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen antialiased">
        <VendorShell>{children}</VendorShell>
      </body>
    </html>
  );
}
