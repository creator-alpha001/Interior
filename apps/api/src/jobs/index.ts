/**
 * The scheduler.
 *
 * pg-boss, because it keeps its queue in the Postgres this application already
 * has: no Redis to run, back up or lose, and the job state is visible to the
 * same `psql` session as everything else.
 *
 * Several API instances can each start a scheduler. pg-boss coordinates through
 * the database — `schedule()` upserts the cron and job fetching takes a lock —
 * so nothing runs twice. That is why this does not need a leader election or a
 * "only on instance zero" flag, both of which are how scheduled work quietly
 * stops running after a scaling change.
 */
import PgBoss from "pg-boss";
import type { FastifyBaseLogger } from "fastify";
import { config } from "../lib/config";
import * as tasks from "./tasks";

/** Times are IST, which is where the business and everybody using it are. */
const TZ = "Asia/Kolkata";

interface Scheduled {
  name: string;
  cron: string;
  run: () => Promise<tasks.JobResult>;
  description: string;
}

const SCHEDULE: Scheduled[] = [
  {
    name: "invoice.mark-overdue",
    cron: "0 2 * * *",
    run: tasks.markInvoicesOverdue,
    description: "Turns pending commission invoices overdue once the due date passes",
  },
  {
    name: "notification.dispatch",
    // Every two minutes. The table is the outbox, so this is the delivery lag,
    // and a couple of minutes is well inside what a text message is expected to
    // take anyway.
    cron: "*/2 * * * *",
    run: () => tasks.dispatchNotifications(),
    description: "Sends notifications that have been written but not delivered",
  },
  {
    name: "followup.due",
    cron: "0 8 * * *",
    run: tasks.followUpsDue,
    description: "Tells each agent how many follow-ups are due today",
  },
  {
    name: "lead.stale-alert",
    cron: "30 8 * * *",
    run: tasks.staleLeadAlert,
    description: "Flags leads over two weeks old with nothing under way",
  },
  {
    name: "otp.sweep",
    cron: "15 * * * *",
    run: tasks.sweepOtpChallenges,
    description: "Removes spent and long-expired one-time codes",
  },
  {
    name: "media.orphan-sweep",
    cron: "0 3 * * 0",
    run: tasks.sweepOrphanMedia,
    description: "Removes upload tickets that were issued and never used",
  },
  {
    name: "session.sweep",
    cron: "30 3 * * 0",
    run: tasks.sweepSessions,
    description: "Removes sessions that expired a month ago",
  },
  {
    name: "ratelimit.sweep",
    cron: "45 3 * * *",
    run: tasks.sweepRateLimits,
    description: "Removes rate-limit counters whose window closed",
  },
];

let boss: PgBoss | null = null;

export async function startJobs(log: FastifyBaseLogger): Promise<void> {
  if (!config.RUN_JOBS) {
    log.info("Scheduled jobs are disabled (RUN_JOBS=false)");
    return;
  }

  boss = new PgBoss({
    connectionString: config.DATABASE_URL,
    // Its own schema, so `\dt` on the application still shows the application.
    schema: "pgboss",
    // Small: these jobs are minutes apart and mostly do nothing.
    max: 2,
  });

  boss.on("error", (error) => log.error({ err: error }, "job queue error"));

  await boss.start();

  for (const job of SCHEDULE) {
    await boss.createQueue(job.name);

    await boss.work(job.name, async () => {
      const started = Date.now();
      try {
        const result = await job.run();
        // Logged at info only when it did something. A cron that runs every two
        // minutes and finds nothing should not fill the log with proof of it.
        if (result.handled > 0) {
          log.info(
            { job: job.name, handled: result.handled, detail: result.detail, ms: Date.now() - started },
            "job done",
          );
        } else {
          log.debug({ job: job.name, ms: Date.now() - started }, "job done, nothing to do");
        }
      } catch (error) {
        // Rethrown so pg-boss records the failure and retries; logged here so
        // it is visible without querying the queue.
        log.error({ err: error, job: job.name }, "job failed");
        throw error;
      }
    });

    await boss.schedule(job.name, job.cron, undefined, { tz: TZ });
  }

  log.info(`Scheduled ${SCHEDULE.length} jobs (${TZ})`);
}

export async function stopJobs(): Promise<void> {
  if (!boss) return;
  await boss.stop({ graceful: true, timeout: 5000 });
  boss = null;
}

/**
 * Runs one job immediately, by name.
 *
 * For the `db:job` script — a nightly sweep should be testable without waiting
 * until two in the morning or editing a cron expression.
 */
export async function runJobNow(name: string): Promise<tasks.JobResult> {
  const job = SCHEDULE.find((j) => j.name === name);
  if (!job) {
    throw new Error(`Unknown job "${name}". Known: ${SCHEDULE.map((j) => j.name).join(", ")}`);
  }
  return job.run();
}

export const jobNames = SCHEDULE.map((j) => ({ name: j.name, cron: j.cron, description: j.description }));
