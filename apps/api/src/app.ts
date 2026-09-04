/**
 * The Fastify application.
 *
 * Built separately from `server.ts` so tests can construct an app, drive it with
 * `app.inject()` and never open a port.
 */
import { randomUUID } from "node:crypto";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import { ZodError } from "zod";
import { config } from "./lib/config";
import { HttpError, translateDatabaseError } from "./lib/errors";
import { registerAuthRoutes } from "./routes/auth";
import { registerCustomerRoutes } from "./routes/customer";
import { registerHealthRoutes } from "./routes/health";
import { registerOpsRoutes } from "./routes/ops";
import { registerPublicRoutes } from "./routes/public";
import { registerVendorRoutes } from "./routes/vendor";
import { limitMutations } from "./lib/mutation-limit";
import { reportError, startObservability } from "./lib/observability";
// Imported for its side effect as well as its hooks: loading it is what makes
// `db` resolve to a request's own connection.
import {
  enterActorScope,
  releaseActorScope,
  reserveActorScope,
} from "./lib/scope-hook";

export async function buildApp(): Promise<FastifyInstance> {
  startObservability();

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
    /**
     * One id per request, from the edge if there is one.
     *
     * The frontends call this API server-to-server, so a customer's page render
     * and the API calls behind it are separate processes. Carrying the id across
     * that boundary is what turns "something went wrong at about four o'clock"
     * into a single log query.
     */
    genReqId: (request) => {
      const inbound = request.headers["x-request-id"];
      const supplied = Array.isArray(inbound) ? inbound[0] : inbound;
      // Bounded and stripped: this value reaches the logs and a response header,
      // and it arrives from outside.
      if (supplied && /^[A-Za-z0-9_-]{8,64}$/.test(supplied)) return supplied;
      return randomUUID();
    },

    // Railway terminates TLS, so the client IP is in X-Forwarded-For. Without
    // this, every rate limit would be keyed to the proxy.
    trustProxy: true,
    bodyLimit: 1_000_000,
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

    // Fastify's own errors — a malformed body, a payload over the limit, an
    // unsupported content type — carry an honest 4xx. Reporting those as 500
    // sends the caller looking for a server fault that is not there.
    if (typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 500) {
      request.log.warn({ err: error }, "bad request");
      return reply.status(error.statusCode).send({
        code: error.code ?? "bad_request",
        message: error.message,
      });
    }

    // Anything reaching here is a bug. Log it fully; tell the caller nothing —
    // a stack trace in a response is a map of the server.
    request.log.error({ err: error }, "unhandled error");
    reportError(error, request);
    return reply.status(500).send({
      code: "internal_error",
      message: "Something went wrong on our side.",
      // Deliberately the only detail. A stack trace is a map of the server; a
      // request id is the one thing that helps both sides and gives away nothing.
      details: { requestId: String(request.id) },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      code: "not_found",
      message: `No route for ${request.method} ${request.url}`,
    });
  });

  /**
   * A ceiling on writes, before any handler runs.
   *
   * As a hook rather than a decorator on each route: there are around seventy
   * mutations and the ones that get added later are exactly the ones nobody
   * remembers to protect.
   */
  /**
   * The request id goes back on every response, success or failure.
   *
   * A support conversation starts with the customer reading something out. This
   * is the thing worth reading out.
   */
  app.addHook("onSend", async (request, reply) => {
    reply.header("x-request-id", String(request.id));
  });

  app.addHook("onRequest", limitMutations);

  /**
   * Row-level security for the personal surfaces. Order matters: reserve, then
   * enter, then the handler, then release once the response has gone.
   */
  app.addHook("preHandler", reserveActorScope);
  app.addHook("preHandler", enterActorScope);
  app.addHook("onResponse", releaseActorScope);

  await app.register(registerHealthRoutes);
  await app.register(registerAuthRoutes);
  await app.register(registerPublicRoutes);
  await app.register(registerCustomerRoutes);
  await app.register(registerVendorRoutes);
  await app.register(registerOpsRoutes);

  return app;
}
