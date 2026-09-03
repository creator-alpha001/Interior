/**
 * The HTTP seam.
 *
 * Every function in this package currently resolves against an in-memory store.
 * When the backend exists, they call `api()` instead — and nothing above this
 * package changes, because the view models they return stay identical.
 *
 * The switch is one environment variable. With `NEXT_PUBLIC_API_URL` unset the
 * apps run entirely on seed data, which is what keeps local development and the
 * team preview working with no backend at all.
 */

import type { Paginated } from "@repo/types";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/** True once a real backend is configured. */
export const USING_API = API_BASE_URL.length > 0;

/**
 * A failed request, carrying enough for the UI to say something useful rather
 * than "something went wrong".
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** The caller sent something the server rejected — do not retry. */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  /** Not signed in, or the session expired. */
  get isUnauthorised(): boolean {
    return this.status === 401;
  }

  /** Signed in, but not allowed to see this. */
  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** Worth retrying: the server or the network failed, not the request. */
  get isRetryable(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

export interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Serialised as JSON. */
  body?: unknown;
  /** Appended as a query string; undefined and null values are dropped. */
  query?: Record<string, string | number | boolean | undefined | null>;
  /**
   * Forwarded verbatim. Server components pass the session cookie through here
   * so the backend can identify the caller.
   */
  headers?: Record<string, string>;
  /** Next.js cache tags, so a mutation can invalidate exactly what it changed. */
  tags?: string[];
  revalidate?: number | false;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: ApiOptions["query"]): string {
  const url = new URL(path.replace(/^\//, ""), `${API_BASE_URL.replace(/\/$/, "")}/`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/** The session cookie both apps and the API agree on. */
export const SESSION_COOKIE = "aangan_session";

/**
 * The caller's session cookie, read from the current request.
 *
 * `next/headers` is imported dynamically for two reasons: this package is also
 * pulled into client bundles, where that module does not exist; and the import
 * must not run at module load, because there is no request then.
 *
 * This used to be registered from `instrumentation.ts` instead. That does not
 * work — Next builds instrumentation in a separate module graph, so the
 * registration landed on a different copy of this module than the one the
 * screens import, and every request looked signed out.
 */
export type CookieReader = () => Promise<string | undefined> | string | undefined;

let cookieReader: CookieReader | null = null;

/** Overrides how the cookie is found. For tests, and for non-Next callers. */
export function configureCookieForwarding(reader: CookieReader): void {
  cookieReader = reader;
}

export async function currentSessionCookie(): Promise<string | undefined> {
  if (cookieReader) return cookieReader();
  if (typeof window !== "undefined") return undefined;

  try {
    const { cookies } = await import("next/headers");
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    return token ? `${SESSION_COOKIE}=${token}` : undefined;
  } catch {
    // Outside a request — a build-time render, or a non-Next caller. Neither
    // has a session, and neither is an error.
    return undefined;
  }
}

/**
 * One place where every request is shaped, so authentication, error mapping and
 * caching are decided once rather than at 115 call sites.
 */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  if (!USING_API) {
    throw new ApiError(
      0,
      "no_api_configured",
      "NEXT_PUBLIC_API_URL is not set, so this build has no backend to call.",
    );
  }

  const { method = "GET", body, query, headers, tags, revalidate, signal } = options;

  // The browser never talks to the API directly — every call is made by the
  // Next server on the user's behalf — so the cookie has to be carried across
  // explicitly rather than travelling with the request.
  const cookie = headers?.cookie ?? (await currentSessionCookie());

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal,
      // Mutations must never be cached; reads opt in explicitly. A read
      // carrying a session is never cached either — a shared cache holding one
      // person's data and serving it to the next visitor is the worst failure
      // this layer could have.
      next:
        method === "GET" && !cookie
          ? { tags, revalidate: revalidate === false ? undefined : revalidate }
          : undefined,
      cache: method === "GET" && !cookie ? undefined : "no-store",
    });
  } catch (cause) {
    // Network failure, DNS, timeout — status 0 marks it retryable.
    throw new ApiError(0, "network_error", "Could not reach the server.", cause);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? safeJson(text) : undefined;

  if (!response.ok) {
    const problem = payload as { code?: string; message?: string } | undefined;
    throw new ApiError(
      response.status,
      problem?.code ?? String(response.status),
      problem?.message ?? response.statusText ?? "Request failed",
      payload,
    );
  }

  return payload as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Chooses between the seed store and the real backend.
 *
 * Written this way so migration is function by function: point one at the API,
 * leave the rest on seed data, and the app keeps working throughout.
 *
 * ```ts
 * export const listDomains = () =>
 *   fromApiOrMock(() => api<Domain[]>("/domains", { tags: ["domains"] }), mockListDomains);
 * ```
 */
export async function fromApiOrMock<T>(
  fromApi: () => Promise<T>,
  fromMock: () => Promise<T>,
): Promise<T> {
  return USING_API ? fromApi() : fromMock();
}

/* ------------------------------------------------------------------ *
 * Pagination
 * ------------------------------------------------------------------ */

/**
 * Turns a filtered, sorted array into one page of results.
 *
 * The mock adapter's cursor is just an encoded offset. A real backend will use
 * something keyset-based, which is why callers must treat it as opaque and pass
 * it back unread — swapping the encoding must not be a frontend change.
 */
export function paginate<T>(rows: T[], limit: number, cursor?: string | null): Paginated<T> {
  const offset = decodeCursor(cursor);
  const items = rows.slice(offset, offset + limit);
  const next = offset + items.length;
  return {
    items,
    nextCursor: next < rows.length ? encodeCursor(next) : null,
    total: rows.length,
  };
}

function encodeCursor(offset: number): string {
  return Buffer.from(`o:${offset}`, "utf8").toString("base64url");
}

function decodeCursor(cursor?: string | null): number {
  if (!cursor) return 0;
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const offset = Number(decoded.replace(/^o:/, ""));
    return Number.isFinite(offset) && offset >= 0 ? offset : 0;
  } catch {
    return 0;
  }
}

/**
 * Walks every page of a paginated list.
 *
 * For the handful of places that genuinely need the whole set — the sitemap,
 * an export — rather than each of them inventing an enormous `limit`.
 */
export async function collectAll<T>(
  fetchPage: (cursor: string | null) => Promise<Paginated<T>>,
): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | null = null;
  // Bounded so a backend returning a non-advancing cursor cannot hang a render.
  for (let page = 0; page < 200; page += 1) {
    const result: Paginated<T> = await fetchPage(cursor);
    all.push(...result.items);
    if (!result.nextCursor) break;
    cursor = result.nextCursor;
  }
  return all;
}

/**
 * A read that goes to the backend when there is one, and to the seed store
 * when there is not.
 *
 * The point of the helper is that each repository function stays one readable
 * statement: the endpoint, its cache tags, and the mock that stands in for it.
 * Migrating one read means deleting nothing — the mock arm simply stops being
 * taken once `NEXT_PUBLIC_API_URL` is set.
 */
export async function readThrough<T>(
  path: string,
  options: ApiOptions,
  fromMock: () => T | Promise<T>,
): Promise<T> {
  if (USING_API) return api<T>(path, options);
  return fromMock();
}
