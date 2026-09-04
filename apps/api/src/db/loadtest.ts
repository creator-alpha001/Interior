/**
 * The ops queue at fifty thousand leads.
 *
 * The queue and My Day were the two screens flagged during the inventory as
 * reading every row, and the seed has around a dozen leads — which is to say
 * the fast path has never been measured against anything. This inserts a
 * realistic backlog and times the real repository functions, not the HTTP layer,
 * because what is being measured is the query.
 *
 * It refuses to run against a database whose name does not say it is for this.
 * Fifty thousand synthetic leads in the demo database would be a bad afternoon.
 *
 *   npm run db:loadtest --workspace=api            # 50,000, the default
 *   npm run db:loadtest --workspace=api -- 200000
 *
 * **These are warm-cache figures.** The run seeds the table, settles it and
 * discards three warm-ups, but the first run against freshly inserted rows
 * still reads from disk and the aggregate screens come out roughly three times
 * slower. Run it twice and read the second; a service that has been up for five
 * minutes is in the warm state, and the cold number is worth knowing as the
 * cost of a restart rather than as the number to design against.
 */
import { sql } from "drizzle-orm";
import { closeDatabase, db, opsDb } from "./client";
import { withDatabase } from "./actor-context";
import { config } from "../lib/config";
import * as ops from "../modules/ops/repository";

/** What the screens have to stay under to feel immediate. */
const BUDGET_MS = 300;

/**
 * Enough runs that one outlier does not decide the answer.
 *
 * Reported at the median and the ninetieth rather than the ninety-fifth: with
 * this many samples the p95 is one or two measurements, and on a developer
 * machine that is usually whatever else the laptop was doing.
 */
const RUNS = 25;

function databaseName(): string {
  return new URL(config.DATABASE_URL).pathname.replace(/^\//, "");
}

/**
 * Inserts `count` leads, each with one service, in one statement.
 *
 * Generated in SQL rather than in a loop of inserts: fifty thousand round trips
 * would measure the network, and the point is to arrive at the backlog quickly,
 * not to simulate how it accumulated.
 */
async function seedBacklog(count: number): Promise<void> {
  // Re-runnable: clear any previous run's rows first. Topping up instead would
  // make each run measure a different backlog, and a benchmark whose input
  // changes between runs is not a benchmark.
  const cleared = await db.execute(sql`
    DELETE FROM leads WHERE reference LIKE 'LD-LOAD-%'
  `);
  if (Array.isArray(cleared) && cleared.length >= 0) {
    console.log(`Cleared the previous run's synthetic leads.`);
  }

  console.log(`Inserting ${count.toLocaleString()} leads...`);
  const started = Date.now();

  await db.execute(sql`
    INSERT INTO leads (reference, client_id, city_id, description, urgency, overall_status,
                       assigned_sales_agent_id, created_at)
    SELECT
      'LD-LOAD-' || g,
      (SELECT id FROM clients ORDER BY random() LIMIT 1),
      (SELECT id FROM cities  ORDER BY random() LIMIT 1),
      'Synthetic load-test requirement ' || g,
      (ARRAY['immediate','within_month','exploring'])[1 + (g % 3)]::urgency,
      (ARRAY['new','verified','in_progress'])[1 + (g % 3)]::lead_status,
      CASE WHEN g % 4 = 0 THEN NULL
           ELSE (SELECT id FROM sales_agents ORDER BY random() LIMIT 1) END,
      now() - (g || ' minutes')::interval
    FROM generate_series(1, ${count}) AS g
  `);

  await db.execute(sql`
    INSERT INTO lead_domains (lead_id, domain_id, status)
    SELECT l.id,
           (SELECT id FROM domains ORDER BY random() LIMIT 1),
           -- Spread across statuses without a window function, which is not
           -- allowed in this position.
           (ARRAY['pending_assignment','assigned','quoted'])[1 + (abs(hashtext(l.id::text)) % 3)]::lead_domain_status
    FROM leads l
    WHERE l.reference LIKE 'LD-LOAD-%'
      AND NOT EXISTS (SELECT 1 FROM lead_domains ld WHERE ld.lead_id = l.id)
  `);

  // VACUUM, not just ANALYZE. Fifty thousand fresh rows leave the visibility
  // map empty, so index-only scans fall back to the heap and autovacuum
  // competes with the first measurements — which is why two consecutive runs
  // could disagree by a factor of five. A benchmark that argues with itself is
  // not measuring the thing it claims to.
  console.log(`  settling the table...`);
  await db.execute(sql`VACUUM ANALYZE leads`);
  await db.execute(sql`VACUUM ANALYZE lead_domains`);
  console.log(`  done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

/**
 * Times one screen on the staff pool, which is where these actually run.
 *
 * Measuring them on the application pool would report a cost production does
 * not pay: staff bypass row-level security, so the policy is never evaluated
 * for them.
 */
async function time(label: string, run: () => Promise<unknown>): Promise<boolean> {
  const work = () => withDatabase(opsDb, run);

  // Three warm-ups, discarded: the first calls pay for plan caching, a
  // connection and a cold buffer cache, none of which is what a busy agent
  // experiences on their tenth screen of the morning.
  await work();
  await work();
  await work();

  const samples: number[] = [];
  for (let i = 0; i < RUNS; i += 1) {
    const started = performance.now();
    await work();
    samples.push(performance.now() - started);
  }

  samples.sort((a, b) => a - b);
  const p50 = samples[Math.floor(RUNS * 0.5)]!;
  const p90 = samples[Math.floor(RUNS * 0.9)]!;
  const ok = p90 < BUDGET_MS;

  console.log(
    `  ${ok ? "ok  " : "SLOW"}  ${label.padEnd(34)} p50 ${p50.toFixed(0).padStart(4)}ms   ` +
      `p90 ${p90.toFixed(0).padStart(4)}ms`,
  );
  return ok;
}

async function main() {
  const name = databaseName();
  if (!/load|test|scratch/.test(name)) {
    throw new Error(
      `Refusing to insert synthetic leads into "${name}". ` +
        `Point DATABASE_URL at a database whose name says it is for load testing.`,
    );
  }

  const count = Number(process.argv[2] ?? 50_000);
  await seedBacklog(count);

  const totals = (await db.execute(sql`
    SELECT count(*)::int AS total FROM leads WHERE deleted_at IS NULL
  `)) as unknown as Array<{ total: number }>;
  const total = totals[0]?.total ?? 0;

  // The busiest agent, deterministically. Picking one with no ordering meant a
  // different agent — and a different amount of work — on every run, which made
  // the numbers look like noise because they were.
  const agent = (await db.execute(sql`
    SELECT sa.id, count(l.id) AS leads
    FROM sales_agents sa
    LEFT JOIN leads l ON l.assigned_sales_agent_id = sa.id AND l.deleted_at IS NULL
    GROUP BY sa.id
    ORDER BY count(l.id) DESC, sa.id
    LIMIT 1
  `)) as unknown as Array<{ id: string; leads: number }>;
  const agentId = agent[0]?.id ?? null;
  console.log(`Busiest agent holds ${Number(agent[0]?.leads ?? 0).toLocaleString()} leads.`);

  console.log(`\nTiming against ${total.toLocaleString()} leads, budget ${BUDGET_MS}ms (p90):\n`);

  const results = [
    await time("ops queue, first page", () => ops.listLeads({ limit: 25, status: "all" })),
    await time("ops queue, filtered by status", () =>
      ops.listLeads({ limit: 25, status: "new" }),
    ),
    await time("ops queue, searched", () =>
      ops.listLeads({ limit: 25, status: "all", search: "LD-LOAD-4900" }),
    ),
    await time("my day (one agent)", () => ops.getMyDay(agentId)),
    await time("sales dashboard (one agent)", () => ops.getSalesDashboard(agentId)),
    await time("sales dashboard (admin, all)", () => ops.getSalesDashboard(null)),
  ];

  const slow = results.filter((ok) => !ok).length;
  console.log("");
  if (slow > 0) {
    console.error(`${slow} of ${results.length} screens are over budget.`);
    process.exitCode = 1;
  } else {
    console.log(`All ${results.length} screens within budget.`);
  }
}

main()
  .then(async () => {
    await closeDatabase();
  })
  .catch(async (error: Error) => {
    console.error(error.message);
    await closeDatabase().catch(() => {});
    process.exit(1);
  });
