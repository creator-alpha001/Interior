/**
 * Runs once when the server starts, before any request is handled.
 *
 * Its job is to tell `@repo/data` how to find the signed-in user. The function
 * registered here is called *per request*, so it can read request-scoped things
 * like cookies even though it was registered at boot.
 */
import { configureSession } from "@repo/data";

export async function register() {
  configureSession(async () => {
    // No authentication yet, so this returns null and the data layer falls back
    // to the seeded demo identity for whichever role a call needs. That fallback
    // is disabled automatically once NEXT_PUBLIC_API_URL is set — with a real
    // backend, "nobody is signed in" must mean no data, not somebody else's.
    //
    // The real implementation is this shape:
    //
    //   const { cookies } = await import("next/headers");
    //   const token = (await cookies()).get("session")?.value;
    //   if (!token) return null;
    //   return await verifyAndDecode(token);   // -> Actor
    //
    return null;
  });
}
