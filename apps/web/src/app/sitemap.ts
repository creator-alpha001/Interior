import type { MetadataRoute } from "next";
import { listDomains, listPackages, listPosts, listProducts, listProfessionals } from "@repo/data";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://aangan.example.com";

/**
 * The catalogue and blog are the reason the public site is server-rendered, so
 * every one of those pages belongs in the sitemap.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Preview deployments publish nothing.
  if (process.env.NEXT_PUBLIC_DEPLOY_ENV !== "production") return [];

  const [domains, products, packages, posts, pros] = await Promise.all([
    listDomains(),
    listProducts(),
    listPackages(),
    listPosts(),
    listProfessionals({ verifiedOnly: true }),
  ]);

  const staticRoutes = [
    { path: "", priority: 1 },
    { path: "/catalogue", priority: 0.9 },
    { path: "/packages", priority: 0.9 },
    { path: "/our-work", priority: 0.7 },
    { path: "/estimate", priority: 0.7 },
    { path: "/professionals", priority: 0.7 },
    { path: "/blog", priority: 0.8 },
    { path: "/how-it-works", priority: 0.6 },
    { path: "/join-as-professional", priority: 0.5 },
    { path: "/submit-requirement", priority: 0.9 },
  ].map((route) => ({
    url: `${BASE_URL}${route.path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: route.priority,
  }));

  return [
    ...staticRoutes,
    ...domains.map((d) => ({
      url: `${BASE_URL}/catalogue/${d.slug}`,
      lastModified: new Date(d.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...products.map((p) => ({
      url: `${BASE_URL}/product/${p.product.slug}`,
      lastModified: new Date(p.product.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...packages.map((p) => ({
      url: `${BASE_URL}/packages/${p.servicePackage.slug}`,
      lastModified: new Date(p.servicePackage.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...posts.map((p) => ({
      url: `${BASE_URL}/blog/${p.post.slug}`,
      lastModified: new Date(p.post.publishedAt ?? p.post.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...pros.map((p) => ({
      url: `${BASE_URL}/professionals/${p.id}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
