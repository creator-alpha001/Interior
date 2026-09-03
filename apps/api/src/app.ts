/**
 * The Fastify application.
 *
 * Built separately from `server.ts` so tests can construct an app, drive it with
 * `app.inject()` and never open a port.
 */
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import { ZodError } from "zod";
import { config } from "./lib/config";
import { HttpError, translateDatabaseError } from "./lib/errors";
import { registerAuthRoutes } from "./routes/auth";
import { registerCustomerRoutes } from "./routes/customer";
import { registerHealthRoutes } from "./routes/health";
import { registerPublicRoutes } from "./routes/public";
import { registerVendorRoutes } from "./routes/vendor";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport: config.isProduction
        ? undefined
        : { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } },
      redact: {
        // These reach the logger through request bodies and headers. A log
        // aggregator is not a place to keep session tokens or OTP codes.
        paths: [
          "req.headers.cookie",
          "req.headers.authorization",
          'req.body.code',
          'req.body.password',
          'req.body.totp',
        ],
        remove: true,
      },
    },
    // Railway terminates TLS, so the client IP is in X-Forwarded-For. Without
    // this, every rate limit would be keyed to the proxy.
    trustProxy: true,
    bodyLimit: 1_000_000,
    disableRequestLogging: config.isTest,
  });

  await app.register(helmet, {
    // The API returns JSON, never HTML, so the browser-facing directives that
    // matter for a page are not the ones that matter here.
    contentSecurityPolicy: false,
  });

  await app.register(cookie, {
    secret: config.SESSION_SECRET,
    parseOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: config.isProduction,
      path: "/",
    },
  });

  /**
   * One error shape for every failure: { code, message, details? }, which is
   * what `ApiError` in @repo/data parses.
   */
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof HttpError) {
      return reply
        .status(error.status)
        .send({ code: error.code, message: error.message, details: error.details });
    }

    if (error instanceof ZodError) {
      return reply.status(422).send({
        code: "invalid_request",
        message: "Some of those values are not valid",
        details: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }

    const translated = translateDatabaseError(error);
    if (translated) {
      request.log.warn({ err: error }, "constraint violation");
      return reply
        .status(translated.status)
        .send({ code: translated.code, message: translated.message, details: translated.details });
    }

    if (error.validation) {
      return reply.status(422).send({
        code: "invalid_request",
        message: error.message,
        details: error.validation,
      });
    }

    // Anything reaching here is a bug. Log it fully; tell the caller nothing —
    // a stack trace in a response is a map of the server.
    request.log.error({ err: error }, "unhandled error");
    return reply.status(500).send({
      code: "internal_error",
      message: "Something went wrong on our side.",
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      code: "not_found",
      message: `No route for ${request.method} ${request.url}`,
    });
  });

  await app.register(registerHealthRoutes);
  await app.register(registerAuthRoutes);
  await app.register(registerPublicRoutes);
  await app.register(registerCustomerRoutes);
  await app.register(registerVendorRoutes);

  return app;
}
