import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { OpsShell } from "@/components/ops-shell";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "InterioBee Ops",
    template: "%s · InterioBee Ops",
  },
  description: "Internal operations panel — leads, assignment, relay, vendors and commission.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen antialiased">
        <OpsShell>{children}</OpsShell>
      </body>
    </html>
  );
}
