import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://aangan.example.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The account area is per-user and search results are thin pages —
      // neither should be indexed.
      disallow: ["/account/", "/search", "/api/"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
