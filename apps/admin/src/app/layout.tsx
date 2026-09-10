import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
      {/*
        The shell moved down to `(panel)/layout.tsx`.
        Sign-in is the one screen that must render without it: a sidebar full
        of links to leads and commission, drawn for somebody who is not signed
        in, is both a lie and an invitation.
      */}
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
