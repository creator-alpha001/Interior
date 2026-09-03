/**
 * Runs once when the server starts, before any request is handled.
 *
 * Deliberately empty of session wiring. That used to live here — `register()`
 * handed `@repo/data` a function for finding the session cookie and turning it
 * into an identity — and it silently did nothing: Next builds instrumentation
 * as its own module graph, so the registration landed on a different copy of
 * the module than the one the screens import. Every request rendered as signed
 * out, with no error to explain why.
 *
 * `@repo/data` now reads the request itself. This file is the place for what
 * `register` is actually for: observability that must be initialised before the
 * first request — tracing, error reporting, metrics.
 */
export async function register() {
  // Sentry, OpenTelemetry and the like are initialised here when they land.
}
