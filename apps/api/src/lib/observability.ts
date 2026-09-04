/**
 * Error reporting.
 *
 * Off unless SENTRY_DSN is set, so local development and the test suite never
 * send anything anywhere. That is deliberate rather than convenient: a test run
 * that reports its own deliberate failures to a production error tracker
 * poisons the signal that makes the tracker useful.
 *
 * What reaches Sentry is filtered on the way out. This system holds customers'
 * phone numbers, home addresses and vendors' commercial terms; an error tracker
 * is a third party, and the fact that a request failed is the part worth
 * sending, not the body it failed on.
 */
import * as Sentry from "@sentry/node";
import type { FastifyRequest } from "fastify";
import { config } from "./config";

let started = false;

export function startObservability(): void {
  if (started || !config.SENTRY_DSN) return;
  started = true;

  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.NODE_ENV,
    release: config.RELEASE,

    // A sample rather than everything: traces are for spotting the slow
    // endpoint, and 10% of a steady load shows that just as well at a tenth of
    // the cost.
    tracesSampleRate: config.isProduction ? 0.1 : 1,

    // The SDK will otherwise attach request bodies, headers and cookies.
    sendDefaultPii: false,

    beforeSend(event) {
      // Belt and braces over sendDefaultPii: strip the places a customer's
      // details could still ride along.
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        if (event.request.headers) {
          delete event.request.headers.cookie;
          delete event.request.headers.authorization;
        }
        // A query string can carry a mobile number on a search endpoint.
        if (event.request.url) event.request.url = event.request.url.split("?")[0];
      }
      delete event.user;
      return event;
    },
  });
}

/**
 * Reports one unhandled error, tagged with the request id.
 *
 * The id is the link back to the log line and to whatever the customer was
 * looking at, which is the difference between an alert and a diagnosis.
 */
export function reportError(error: unknown, request: FastifyRequest): void {
  if (!started) return;

  Sentry.withScope((scope) => {
    scope.setTag("request_id", String(request.id));
    scope.setTag("route", request.routeOptions?.url ?? request.url);
    scope.setTag("method", request.method);
    Sentry.captureException(error);
  });
}

/** Flushes buffered events on shutdown, so a crash's last error still arrives. */
export async function stopObservability(): Promise<void> {
  if (!started) return;
  await Sentry.close(2000);
}
