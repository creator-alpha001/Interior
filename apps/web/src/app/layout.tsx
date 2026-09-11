import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

/**
 * One family for the whole site.
 *
 * Headings used to be set in a display serif. It read as editorial and heavy
 * beside photography, so every heading is Inter now, carried by weight rather
 * than by a second typeface.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Decora Shine — Interiors, Furniture, Fabrication & Painting",
    template: "%s | Decora Shine",
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
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-paper antialiased">{children}</body>
    </html>
  );
}
