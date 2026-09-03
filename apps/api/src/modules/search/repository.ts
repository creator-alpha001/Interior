/**
 * One search across everything a visitor might be looking for.
 *
 * Catalogue items rank first: somebody typing "wardrobe" wants a wardrobe, not
 * an article about wardrobes. Guides come last as supporting reading.
 */
import type { SearchResults } from "@repo/types";
import { listProducts, listPackages } from "../catalogue/repository";
import { listProfessionals } from "../directory/repository";
import { listPosts } from "../content/repository";

const MIN_QUERY = 2;

export async function search(query: string, cityId?: string): Promise<SearchResults> {
  const q = query.trim();

  // One or two characters match most of the catalogue, so the result is noise
  // and the query is expensive. Say nothing rather than everything.
  if (q.length < MIN_QUERY) {
    return { query, total: 0, products: [], packages: [], professionals: [], posts: [] };
  }

  const [products, packages, professionals, posts] = await Promise.all([
    listProducts({ search: q, city: cityId, sort: "featured", limit: 8 }),
    listPackages({ limit: 50 }),
    listProfessionals({ search: q, city: cityId, verifiedOnly: true, limit: 4 }),
    listPosts({ search: q, limit: 4 }),
  ]);

  // Packages have no search filter of their own — there are few enough that
  // filtering the loaded set is cheaper than another indexed query.
  const needle = q.toLowerCase();
  const matchedPackages = packages
    .filter(
      (p) =>
        p.servicePackage.name.toLowerCase().includes(needle) ||
        p.servicePackage.shortDescription.toLowerCase().includes(needle),
    )
    .slice(0, 4);

  return {
    query,
    total:
      products.items.length + matchedPackages.length + professionals.items.length + posts.items.length,
    products: products.items,
    packages: matchedPackages,
    professionals: professionals.items,
    posts: posts.items,
  };
}

/**
 * Type-ahead for the header search box.
 *
 * Fires on every keystroke, so it stays deliberately small: names only, no
 * joins beyond what a label needs, and a hard cap well under the page size.
 */
export async function searchSuggestions(
  query: string,
): Promise<Array<{ label: string; hint: string; href: string }>> {
  const q = query.trim();
  if (q.length < MIN_QUERY) return [];

  const [products, professionals, posts] = await Promise.all([
    listProducts({ search: q, sort: "featured", limit: 5 }),
    listProfessionals({ search: q, verifiedOnly: true, limit: 3 }),
    listPosts({ search: q, limit: 2 }),
  ]);

  return [
    ...products.items.map((p) => ({
      label: p.product.name,
      hint: p.domain.name,
      href: `/product/${p.product.slug}`,
    })),
    ...professionals.items.map((p) => ({
      label: p.companyName,
      hint: `${p.city.name} · ${p.domains.map((d) => d.name).join(", ")}`,
      href: `/professionals/${p.id}`,
    })),
    ...posts.items.map((p) => ({
      label: p.post.title,
      hint: "Guide",
      href: `/blog/${p.post.slug}`,
    })),
  ];
}
