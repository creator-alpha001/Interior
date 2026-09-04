import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Gives the request an id, if the edge did not already.
 *
 * A page render and the API calls behind it are separate processes. Without a
 * shared id there is nothing linking an API error to the page somebody was
 * looking at when it happened, which is precisely the moment you want the link.
 * `@repo/data` reads this header and passes it to the API, and the API echoes
 * it back on every response.
 */
function withRequestId(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  const existing = headers.get("x-request-id");
  if (!existing || !/^[A-Za-z0-9_-]{8,64}$/.test(existing)) {
    headers.set("x-request-id", crypto.randomUUID());
  }
  return headers;
}

/**
 * Basic-auth gate for the preview deployment.
 *
 * Staff sign in properly now — email, password and TOTP — but this sits in
 * front of that: an unreleased ops panel should not be reachable at all by
 * whoever happens to find the URL, sign-in form included. When PREVIEW_PASSWORD
 * is unset — local development — it is a no-op.
 *
 * Named `proxy` rather than `middleware`: the middleware convention is
 * deprecated in this version of Next.
 */
export function proxy(request: NextRequest) {
  // Read per request, not at module scope: an edge bundle can freeze
  // module-level process.env at build time, which would leave the site open if
  // the variable were added to the project afterwards.
  const USER = process.env.PREVIEW_USER ?? "team";
  const PASSWORD = process.env.PREVIEW_PASSWORD;

  if (!PASSWORD) return NextResponse.next({ request: { headers: withRequestId(request) } });

  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const [user, ...rest] = atob(header.slice(6)).split(":");
      if (user === USER && rest.join(":") === PASSWORD) {
        return NextResponse.next({ request: { headers: withRequestId(request) } });
      }
    } catch {
      // Malformed header — fall through to the challenge below.
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Aangan preview", charset="UTF-8"',
      // Belt and braces: a 401 should never be cached or indexed.
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
