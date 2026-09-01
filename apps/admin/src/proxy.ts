import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Basic-auth gate for the preview deployment.
 *
 * The whole platform runs on seed data and has no real authentication yet, so
 * nothing here should be reachable by anyone who happens to find the URL. When
 * PREVIEW_PASSWORD is unset — local development — this is a no-op.
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

  if (!PASSWORD) return NextResponse.next();

  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const [user, ...rest] = atob(header.slice(6)).split(":");
      if (user === USER && rest.join(":") === PASSWORD) {
        return NextResponse.next();
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
