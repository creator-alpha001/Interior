import type { Metadata } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Aangan — Interiors, Furniture, Fabrication & Painting",
    template: "%s | Aangan",
  },
  description:
    "Tell us what you need, meet three verified professionals, compare their quotes side by side, and hire the one you trust. Interiors, furniture, fabrication and painting.",
};

/**
 * Only the document shell. The customer site and the professional portal each
 * bring their own chrome — see (site)/layout.tsx and partner/layout.tsx.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body className="min-h-screen bg-paper antialiased">{children}</body>
    </html>
  );
}
