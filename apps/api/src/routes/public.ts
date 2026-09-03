/**
 * The public read surface.
 *
 * Every path and query name here comes from `@repo/contract`, which is the same
 * manifest `@repo/data` builds its URLs from — so an endpoint cannot be spelled
 * one way here and another way in the caller.
 *
 * Handlers stay thin on purpose: validate, call one repository function, return
 * it. Anything that looks like a decision belongs in the repository, where it
 * can be tested without an HTTP request.
 */
import type { FastifyInstance } from "fastify";
import { routes } from "@repo/contract";
import { NotFoundError } from "../lib/errors";
import * as catalogue from "../modules/catalogue/repository";
import * as content from "../modules/content/repository";
import * as directory from "../modules/directory/repository";
import * as search from "../modules/search/repository";

/**
 * How long a CDN or the Next.js fetch cache may reuse a response.
 *
 * The catalogue changes when an admin edits it, which is rarely, so a minute of
 * staleness costs nothing and takes almost all the read load off Postgres.
 * `stale-while-revalidate` means the refresh never blocks a visitor.
 */
const CACHE_PUBLIC = "public, max-age=60, stale-while-revalidate=300";

export async function registerPublicRoutes(app: FastifyInstance) {
  const cached = (reply: { header: (k: string, v: string) => unknown }) => {
    reply.header("Cache-Control", CACHE_PUBLIC);
  };

  /* ---------------- domains and cities ---------------- */

  app.get(routes.listDomains.path, async (_request, reply) => {
    cached(reply);
    return catalogue.listDomains();
  });

  app.get<{ Params: { slug: string } }>(routes.getDomain.path, async (request, reply) => {
    const { slug } = routes.getDomain.params!.parse(request.params);
    const domain = await catalogue.getDomainBySlug(slug);
    if (!domain) throw new NotFoundError("That service");
    cached(reply);
    return domain;
  });

  app.get(routes.listCities.path, async (_request, reply) => {
    cached(reply);
    return catalogue.listCities();
  });

  /* ---------------- products ---------------- */

  app.get(routes.listProducts.path, async (request, reply) => {
    const query = routes.listProducts.query!.parse(request.query);
    cached(reply);
    return catalogue.listProducts(query);
  });

  app.get<{ Params: { slug: string } }>(routes.getProduct.path, async (request, reply) => {
    const { slug } = routes.getProduct.params!.parse(request.params);
    const { city } = routes.getProduct.query!.parse(request.query);
    const product = await catalogue.getProductBySlug(slug, city);
    if (!product) throw new NotFoundError("That product");
    cached(reply);
    return product;
  });

  app.get<{ Params: { id: string } }>(routes.listRelatedProducts.path, async (request, reply) => {
    const { id } = routes.listRelatedProducts.params!.parse(request.params);
    const { city, limit } = routes.listRelatedProducts.query!.parse(request.query);
    cached(reply);
    return catalogue.listRelatedProducts(id, city, limit);
  });

  app.get(routes.listCategories.path, async (request, reply) => {
    const { domain } = routes.listCategories.query!.parse(request.query);
    cached(reply);
    return catalogue.listCategories(domain);
  });

  /* ---------------- packages ---------------- */

  app.get(routes.listPackages.path, async (request, reply) => {
    const query = routes.listPackages.query!.parse(request.query);
    cached(reply);
    return catalogue.listPackages(query);
  });

  app.get<{ Params: { slug: string } }>(routes.getPackage.path, async (request, reply) => {
    const { slug } = routes.getPackage.params!.parse(request.params);
    const found = await catalogue.getPackageBySlug(slug);
    if (!found) throw new NotFoundError("That package");
    cached(reply);
    return found;
  });

  app.get(routes.catalogueCounts.path, async (_request, reply) => {
    cached(reply);
    return catalogue.countCatalogueByDomain();
  });

  /* ---------------- directory ---------------- */

  app.get(routes.listProfessionals.path, async (request, reply) => {
    const query = routes.listProfessionals.query!.parse(request.query);
    cached(reply);
    return directory.listProfessionals(query);
  });

  app.get<{ Params: { id: string } }>(routes.getProfessional.path, async (request, reply) => {
    const { id } = routes.getProfessional.params!.parse(request.params);
    const profile = await directory.getProfessional(id);
    if (!profile) throw new NotFoundError("That professional");
    cached(reply);
    return profile;
  });

  app.get(routes.listPortfolio.path, async (request, reply) => {
    const { domain, limit } = routes.listPortfolio.query!.parse(request.query);
    cached(reply);
    return directory.listPortfolio(domain, limit);
  });

  app.get(routes.platformStats.path, async (_request, reply) => {
    cached(reply);
    return directory.getPlatformStats();
  });

  /* ---------------- blog ---------------- *
   * Registered before /posts/:slug so the literal paths win the match.        */

  app.get(routes.listPostCategories.path, async (_request, reply) => {
    cached(reply);
    return content.listBlogCategories();
  });

  app.get(routes.listPostTags.path, async (_request, reply) => {
    cached(reply);
    return content.listBlogTags();
  });

  app.get(routes.listPosts.path, async (request, reply) => {
    const query = routes.listPosts.query!.parse(request.query);
    cached(reply);
    return content.listPosts(query);
  });

  app.get<{ Params: { id: string } }>(routes.listRelatedPosts.path, async (request, reply) => {
    const { id } = routes.listRelatedPosts.params!.parse(request.params);
    const { limit } = routes.listRelatedPosts.query!.parse(request.query);
    cached(reply);
    return content.listRelatedPosts(id, limit);
  });

  app.get<{ Params: { slug: string } }>(routes.getPost.path, async (request, reply) => {
    const { slug } = routes.getPost.params!.parse(request.params);
    const post = await content.getPostBySlug(slug);
    if (!post) throw new NotFoundError("That article");
    cached(reply);
    return post;
  });

  /* ---------------- home page content ---------------- */

  app.get(routes.listBanners.path, async (_request, reply) => {
    cached(reply);
    return content.listBanners();
  });

  app.get(routes.listTestimonials.path, async (_request, reply) => {
    cached(reply);
    return content.listTestimonials();
  });

  /* ---------------- search ---------------- */

  app.get(routes.search.path, async (request, reply) => {
    const { q, city } = routes.search.query!.parse(request.query);
    // Shorter than the catalogue: a search result page for a query somebody is
    // still typing has little value stale.
    reply.header("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
    return search.search(q, city);
  });

  app.get(routes.searchSuggest.path, async (request, reply) => {
    const { q } = routes.searchSuggest.query!.parse(request.query);
    reply.header("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
    return search.searchSuggestions(q);
  });
}
