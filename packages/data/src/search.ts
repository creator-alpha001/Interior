import type { BlogPostView, PackageView, ProductView, ProfessionalSummary } from "@repo/types";
import { toPackageView, toProductView, toProfessionalSummary } from "./mappers";
import { delay, store } from "./store";

export interface SearchResults {
  query: string;
  total: number;
  products: ProductView[];
  packages: PackageView[];
  professionals: ProfessionalSummary[];
  posts: BlogPostView[];
}

/**
 * One search across everything a visitor might be looking for. Catalogue items
 * rank first — someone typing "wardrobe" wants a wardrobe, not an article
 * about wardrobes — with guides last as supporting reading.
 */
export async function search(query: string, cityId?: string): Promise<SearchResults> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) {
    return delay({ query, total: 0, products: [], packages: [], professionals: [], posts: [] });
  }

  const matches = (...fields: Array<string | undefined>) =>
    fields.filter(Boolean).join(" ").toLowerCase().includes(q);

  const products = store.products
    .filter((p) => p.isActive)
    .filter((p) => matches(p.name, p.shortDescription, p.tags.join(" ")))
    .slice(0, 12)
    .map((p) => toProductView(p.id, cityId));

  const packages = store.servicePackages
    .filter((p) => p.isActive)
    .filter((p) => matches(p.name, p.shortDescription, p.inclusions.join(" ")))
    .slice(0, 6)
    .map((p) => toPackageView(p.id));

  const professionals = store.professionals
    .filter((p) => p.verificationStatus === "verified")
    .filter((p) => {
      const user = store.users.find((u) => u.id === p.userId);
      return matches(user?.name, p.companyName, p.bio);
    })
    .slice(0, 6)
    .map((p) => toProfessionalSummary(p.id));

  const posts = store.blogPosts
    .filter((p) => p.status === "published")
    .filter((p) => matches(p.title, p.excerpt, p.body))
    .slice(0, 6)
    .map((post) => ({
      post,
      category: store.blogCategories.find((c) => c.id === post.categoryId)!,
      tags: post.tagIds.map((id) => store.blogTags.find((t) => t.id === id)?.name ?? ""),
      domain: store.domains.find((d) => d.id === post.domainId) ?? null,
    }));

  return delay({
    query,
    total: products.length + packages.length + professionals.length + posts.length,
    products,
    packages,
    professionals,
    posts,
  });
}

/** Type-ahead suggestions for the header search box. */
export async function searchSuggestions(query: string): Promise<
  Array<{ label: string; hint: string; href: string }>
> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return delay([]);

  const products = store.products
    .filter((p) => p.isActive && p.name.toLowerCase().includes(q))
    .slice(0, 5)
    .map((p) => ({
      label: p.name,
      hint: store.domains.find((d) => d.id === p.domainId)?.name ?? "",
      href: `/product/${p.slug}`,
    }));

  const packages = store.servicePackages
    .filter((p) => p.isActive && p.name.toLowerCase().includes(q))
    .slice(0, 3)
    .map((p) => ({
      label: p.name,
      hint: "Package",
      href: `/packages/${p.slug}`,
    }));

  return delay([...products, ...packages].slice(0, 7));
}
