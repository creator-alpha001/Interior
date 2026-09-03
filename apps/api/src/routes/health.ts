/**
 * Liveness and readiness.
 *
 * Two endpoints rather than one, because they answer different questions.
 * `/health` says the process is up — the platform restarts the container if it
 * stops answering. `/ready` says the process can actually serve traffic, which
 * means the database is reachable; a deploy should not receive requests until
 * that is true.
 */
import type { FastifyInstance } from "fastify";
import { sql as raw } from "drizzle-orm";
import { db } from "../db/client";

const startedAt = Date.now();

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    status: "ok",
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
  }));

  app.get("/ready", async (_request, reply) => {
    try {
      await db.execute(raw`SELECT 1`);
      return { status: "ready", database: "up" };
    } catch (error) {
      app.log.error({ err: error }, "readiness check failed");
      return reply.status(503).send({
        code: "not_ready",
        message: "The database is not reachable",
      });
    }
  });
}
