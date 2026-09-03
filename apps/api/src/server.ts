/**
 * Process entry point.
 *
 * Shutdown is graceful on purpose: a deploy sends SIGTERM, and killing the
 * process immediately would abort in-flight transactions. `signAgreement`
 * writes an agreement, its projects and an invoice — that is not something to
 * cut off halfway because a container was replaced.
 */
import { buildApp } from "./app";
import { config } from "./lib/config";
import { closeDatabase } from "./db/client";

async function main() {
  const app = await buildApp();

  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  app.log.info(`API listening on :${config.PORT} (${config.NODE_ENV})`);

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    app.log.info(`${signal} received, finishing in-flight requests`);
    try {
      await app.close();
      await closeDatabase();
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, "shutdown failed");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error) => {
  console.error("Failed to start:", error);
  process.exit(1);
});
