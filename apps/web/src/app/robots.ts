import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://aangan.example.com";

/** Only the real production site should ever be crawlable. */
const IS_PRODUCTION = process.env.NEXT_PUBLIC_DEPLOY_ENV === "production";

export default function robots(): MetadataRoute.Robots {
  if (!IS_PRODUCTION) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

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
