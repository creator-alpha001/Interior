import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Two gates, in order: the preview password, then the sign-in check.
 *
 * Named `proxy` rather than `middleware`: the middleware convention is
 * deprecated in this version of Next.
 */

/** Everything below these paths is personal to whoever is signed in. */
const SIGNED_IN_PATHS = ["/account", "/partner"];
const SESSION_COOKIE = "aangan_session";

export function proxy(request: NextRequest) {
  const previewChallenge = checkPreviewPassword(request);
  if (previewChallenge) return previewChallenge;

  return checkSignedIn(request) ?? NextResponse.next();
}

/**
 * Basic-auth gate for the preview deployment.
 *
 * Unreleased work on sample data should not be reachable by anyone who happens
 * to find the URL. When PREVIEW_PASSWORD is unset — local development — this is
 * a no-op.
 */
function checkPreviewPassword(request: NextRequest): NextResponse | null {
  // Read per request, not at module scope: an edge bundle can freeze
  // module-level process.env at build time, which would leave the site open if
  // the variable were added to the project afterwards.
  const USER = process.env.PREVIEW_USER ?? "team";
  const PASSWORD = process.env.PREVIEW_PASSWORD;

  if (!PASSWORD) return null;

  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const [user, ...rest] = atob(header.slice(6)).split(":");
      if (user === USER && rest.join(":") === PASSWORD) return null;
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

/**
 * Sends a signed-out visitor to the sign-in page.
 *
 * This has to happen here rather than in the layouts. Next renders a layout and
 * its page concurrently, so a redirect decided in the layout loses the race
 * against the page's own data call — which throws, and the visitor gets an
 * error boundary instead of a sign-in form.
 *
 * Only the cookie's *presence* is checked, deliberately. Validating it would
 * mean a network call on every request to every asset; a forged or expired
 * cookie gets no further than the data layer, which resolves it properly and
 * refuses. This gate exists to route people, not to authorise them.
 */
function checkSignedIn(request: NextRequest): NextResponse | null {
  // With no backend configured the whole site runs on seed data behind a
  // fixed demo identity, and there is nothing to sign in to.
  if (!process.env.NEXT_PUBLIC_API_URL) return null;
  if (process.env.NEXT_PUBLIC_ALLOW_DEMO_SESSION === "true") return null;

  const { pathname } = request.nextUrl;
  const needsSession = SIGNED_IN_PATHS.some(
    (base) => pathname === base || pathname.startsWith(`${base}/`),
  );
  if (!needsSession) return null;

  if (request.cookies.get(SESSION_COOKIE)?.value) return null;

  const signIn = new URL("/login", request.url);
  // So the sign-in form can send them back where they were going.
  signIn.searchParams.set("next", pathname);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
