/**
 * The route manifest.
 *
 * `@repo/types` describes what the API returns; this describes how to ask for
 * it. Both sides read from here — the server registers handlers against these
 * entries, and `@repo/data` builds its URLs from them — so a path can never be
 * spelled one way in the API and another way in the client.
 *
 * There are around ninety endpoints. Hand-written path strings on both sides of
 * that many would drift, and the drift would only show up at runtime.
 */
import type { z } from "zod";

export type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/** Who may call an endpoint. Checked by the server, documented for the client. */
export type Audience = "public" | "client" | "professional" | "staff";

export interface RouteDefinition<
  Params extends z.ZodTypeAny = z.ZodTypeAny,
  Query extends z.ZodTypeAny = z.ZodTypeAny,
  Body extends z.ZodTypeAny = z.ZodTypeAny,
  Response = unknown,
> {
  method: Method;
  /** Fastify-style, e.g. "/products/:slug". Params are filled by `pathFor`. */
  path: string;
  audience: Audience;
  params?: Params;
  query?: Query;
  body?: Body;
  /** Present only as a type. Responses are `@repo/types` view models. */
  response?: () => Response;
  /**
   * Next.js cache tags for this read, so a mutation can invalidate exactly what
   * it changed rather than the whole route.
   */
  tags?: string[];
  summary?: string;
}

/** Helper that preserves each field's literal type through the manifest. */
export function route<
  Params extends z.ZodTypeAny,
  Query extends z.ZodTypeAny,
  Body extends z.ZodTypeAny,
  Response,
>(def: RouteDefinition<Params, Query, Body, Response>): RouteDefinition<Params, Query, Body, Response> {
  return def;
}

/**
 * Fills `:param` placeholders and returns a path ready to hand to `api()`.
 *
 * Values are percent-encoded: a product slug is user-controlled data by the
 * time an admin has typed it, and an unencoded "/" in one would silently
 * address a different endpoint.
 */
export function pathFor(
  definition: Pick<RouteDefinition, "path">,
  params: Record<string, string | number> = {},
): string {
  return definition.path.replace(/:([A-Za-z0-9_]+)/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) {
      throw new Error(`Missing path parameter "${name}" for ${definition.path}`);
    }
    return encodeURIComponent(String(value));
  });
}

/** The error body every failed response carries. */
export interface ApiProblem {
  code: string;
  message: string;
  details?: unknown;
}
