/**
 * Environment, validated once at boot.
 *
 * A missing DATABASE_URL should stop the process on startup with a readable
 * message, not surface as a null dereference on the first request that happens
 * to touch the database.
 */
import "dotenv/config";
import { z } from "zod";

/**
 * What `jobs/index.ts` gives pg-boss. Named here because the budget check has to
 * count it: it is a third pool against the same pooler allowance, and leaving it
 * out is how the sum came to look safe when it was not.
 */
export const JOB_QUEUE_CONNECTIONS = 2;

/**
 * Connections deliberately left unused.
 *
 * `db:migrate` opens one, and somebody reading production with psql or the
 * Supabase SQL editor opens another. Without this the app is entitled to every
 * slot, and the first person to look at the database takes the site down.
 */
const POOLER_HEADROOM = 4;

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  /**
   * The service's connection, as a role that is **not** a superuser.
   *
   * A superuser bypasses row-level security entirely, which would silently undo
   * migration 0005. There is no way to check that from here — `rolsuper` is
   * readable, but refusing to boot on it would strand anybody running a
   * single-role setup — so it is stated here and asserted in the tests instead.
   */
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required — see apps/api/.env.example"),

  /**
   * The owner's connection, for work the app role cannot do: migrations, the
   * seed, backups and the restore drill. Falls back to DATABASE_URL for a
   * single-role setup.
   */
  OWNER_DATABASE_URL: z.string().optional(),

  /**
   * The staff surface's connection.
   *
   * A role with BYPASSRLS and nothing else extra. Ops read across every
   * customer by design, so the policies let all their rows through anyway —
   * they just charged for the check on each one. Falls back to DATABASE_URL,
   * which is correct but slower on the dashboards.
   */
  OPS_DATABASE_URL: z.string().optional(),

  /**
   * Pool sizes, which stopped being a constant when the database moved.
   *
   * These were 10 and 6, chosen against Railway's 100-connection limit. A
   * Supabase pooler in session mode allows far fewer — the default is 15 for
   * the whole project, shared with migrations and any psql session — so the old
   * numbers are no longer a safe hardcoded default anywhere but Railway.
   *
   * Worth knowing when raising them: a customer or vendor request reserves a
   * connection for its entire life, so DATABASE_POOL_MAX is also the ceiling on
   * concurrent personal requests. Too low shows up as requests queueing, too
   * high as `remaining connection slots are reserved`.
   */
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(5),
  OPS_DATABASE_POOL_MAX: z.coerce.number().int().positive().default(2),

  /**
   * How many clients the pooler will accept for the whole project.
   *
   * Supabase's session-mode default, and the number the check below measures
   * the pools against. Raise it here only after raising it in the Supabase
   * dashboard, under Database -> Connection pooling.
   */
  DATABASE_POOLER_MAX_CLIENTS: z.coerce.number().int().positive().default(15),

  /**
   * Google OAuth client ids allowed to sign in, comma separated.
   *
   * A list because the website, the Android build and the iOS build each get
   * their own client id from Google and all three sign in through one endpoint.
   * It is an allowlist of `aud` claims: a token minted for somebody else's
   * application is a valid Google token, and accepting it would let any app
   * sign a person into this one.
   *
   * Empty means Google sign-in is off, which is the default and is not a
   * failure — the mobile OTP path is unaffected.
   */
  GOOGLE_CLIENT_IDS: z.string().optional(),

  WEB_ORIGIN: z.string().url().default("http://localhost:3001"),
  ADMIN_ORIGIN: z.string().url().default("http://localhost:3002"),

  /** Signs session cookies. At least 32 bytes of real entropy. */
  SESSION_SECRET: z.string().min(32).optional(),

  /**
   * Returns the OTP in the response instead of sending an SMS, so local
   * development needs no SMS provider. Forced off in production below.
   */
  OTP_DEV_ECHO: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  /**
   * How an SMS actually leaves the building.
   *
   * `auto` picks msg91 when it is configured and `console` when it is not, so a
   * checkout with no accounts anywhere still signs people in. The others are
   * chosen deliberately:
   *
   * - `msg91`    the real provider; needs a DLT-registered template
   * - `console`  writes the message to the log. An operator with server access
   *              can read a code during a provider outage — and somebody with
   *              server access already has the database, so this grants nothing
   *              new. It is never exposed over HTTP
   * - `file`     appends to SMS_OUTBOX_PATH. This is the manual path: during a
   *              DLT gap or a provider outage, somebody tails that file and
   *              sends the messages by hand
   *
   * Which of these ran, and whether it worked, is recorded on the notification
   * row — so "did the customer hear about this" is answerable from the database
   * rather than from the logs.
   */
  SMS_DRIVER: z.enum(["auto", "msg91", "console", "file"]).default("auto"),
  SMS_OUTBOX_PATH: z.string().default(".data/sms-outbox.log"),

  MSG91_AUTH_KEY: z.string().optional(),
  /** The DLT template for one-time codes. */
  MSG91_TEMPLATE_ID: z.string().optional(),
  /** The DLT template for everything else — a separate registration. */
  MSG91_NOTIFY_TEMPLATE_ID: z.string().optional(),
  MSG91_SENDER_ID: z.string().optional(),

  /**
   * Whether this process also runs the scheduled jobs.
   *
   * On by default: pg-boss coordinates through Postgres, so several API
   * instances can each run a worker without duplicating work. Turn it off to
   * run the worker as its own process.
   */
  RUN_JOBS: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),

  /** Error reporting. Unset means reporting is off, which is the default. */
  SENTRY_DSN: z.string().url().optional(),
  /**
   * Which build this is, for grouping errors by deploy. Railway supplies the
   * commit sha; anything stable and unique will do.
   */
  RELEASE: z.string().default("dev"),

  /**
   * Where uploaded files go.
   *
   * `auto` uses R2 when it is configured and the local disk when it is not, so
   * the upload flow works end to end on a laptop with no bucket. `local` may be
   * chosen explicitly in production — a mounted volume is a legitimate way to
   * run this — but it is never the *fallback* there, because silently writing
   * customer photographs to a container's ephemeral disk is how they disappear
   * on the next deploy.
   */
  STORAGE_DRIVER: z.enum(["auto", "r2", "local"]).default("auto"),
  /** Where the local driver writes. Relative paths resolve from the API's cwd. */
  STORAGE_LOCAL_DIR: z.string().default(".data/media"),
  /**
   * Signs local upload URLs. Falls back to SESSION_SECRET, then to a per-boot
   * random value — which is correct for a laptop and would invalidate
   * in-flight tickets across a restart, hence the warning at boot.
   */
  STORAGE_SIGNING_SECRET: z.string().optional(),
  /** Where the API is reachable from a phone. Local upload URLs are built on it. */
  PUBLIC_BASE_URL: z.string().url().optional(),

  /**
   * Push delivery. `log` records what would have been sent, so notification
   * plumbing is testable with no Firebase project.
   */
  PUSH_DRIVER: z.enum(["auto", "fcm", "log"]).default("auto"),
  /** The service account JSON, as a string or a path to a file. */
  FCM_SERVICE_ACCOUNT: z.string().optional(),
  FCM_PROJECT_ID: z.string().optional(),

  /**
   * The oldest mobile build allowed to talk to this API. Bumping it forces an
   * upgrade, which is the only lever there is once a bad build is in the wild.
   */
  MOBILE_MIN_BUILD: z.coerce.number().int().nonnegative().default(0),
  MOBILE_UPGRADE_MESSAGE: z
    .string()
    .default("A newer version of Decora Shine is required. Please update to continue."),

  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_BASE_URL: z.string().url().optional(),
});

function load() {
  /*
   * An empty variable means "not set", which is not what Zod thinks.
   *
   * `.optional()` admits `undefined`, not `""`, so a template copied with its
   * blank lines intact — `SENTRY_DSN=`, `R2_BUCKET=`, `FCM_PROJECT_ID=` — fails
   * validation on a value nobody supplied, and the process refuses to boot with
   * "SENTRY_DSN: Invalid url". That is exactly how `.env.production.example` is
   * meant to be used: fill in what applies, leave the rest alone.
   *
   * Hosting panels do the same thing from the other direction — clearing a
   * field in Hostinger's UI leaves an empty string rather than removing the
   * variable — so this is not only about files.
   *
   * Stripping them here means an unset variable and a blank one behave
   * identically, and every default and `.optional()` below reads the way it
   * looks.
   */
  const supplied = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value !== ""),
  );

  const parsed = schema.safeParse(supplied);

  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment:\n${lines.join("\n")}`);
  }

  const env = parsed.data;
  const isProduction = env.NODE_ENV === "production";

  /*
   * Resolve `auto` once, here, rather than at each call site.
   *
   * Every one of these has a working path with no third-party account
   * configured. That is deliberate: an SMS gateway, a bucket and a Firebase
   * project all have lead times measured in weeks, and none of them should be
   * able to stop somebody running the platform — on a laptop, in a demo, or
   * through a provider outage at four in the morning.
   */
  const msg91Ready = Boolean(env.MSG91_AUTH_KEY && env.MSG91_TEMPLATE_ID);
  const r2Ready = Boolean(
    env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET,
  );
  const fcmReady = Boolean(env.FCM_SERVICE_ACCOUNT && env.FCM_PROJECT_ID);

  const smsDriver = env.SMS_DRIVER === "auto" ? (msg91Ready ? "msg91" : "console") : env.SMS_DRIVER;
  const storageDriver = env.STORAGE_DRIVER === "auto" ? (r2Ready ? "r2" : "local") : env.STORAGE_DRIVER;
  const pushDriver = env.PUSH_DRIVER === "auto" ? (fcmReady ? "fcm" : "log") : env.PUSH_DRIVER;

  /**
   * Things worth saying out loud at boot.
   *
   * Not failures — each one is a supported way to run — but each is also a way
   * to be surprised later, and a line in the startup log is cheaper than the
   * surprise.
   */
  const warnings: string[] = [];

  /*
   * Two ways a managed Postgres connection is wrong without ever saying so.
   *
   * **A transaction-mode pooler.** Supabase serves one on port 6543, and it is
   * the port its dashboard offers first. It returns the connection to the pool
   * after every transaction, which breaks two things here silently rather than
   * loudly:
   *
   *   - `openScope` sets app.user_id and friends with `set_config(..., false)`
   *     — session-scoped — and then runs the request's queries expecting them to
   *     still be there. Through a transaction pooler they are not. The policies
   *     in 0005 and 0007 treat absent settings as "no restriction", by design,
   *     so row-level security does not fail closed. It stops applying. No error,
   *     no log line, and the containment layer is simply gone.
   *   - pg-boss keeps advisory locks and LISTEN/NOTIFY across statements, and
   *     has neither through a transaction pooler.
   *
   * Session mode is port 5432 on the same pooler host. That is the one to use.
   *
   * **No TLS.** postgres.js and pg both default to an unencrypted connection,
   * and Supabase is reached across the public internet, so `sslmode` has to be
   * in the URL.
   *
   * But the two drivers do not agree on what `sslmode=require` means, and this
   * comment used to claim they did — "neither driver needs code for this".
   * They do:
   *
   *   * **postgres.js** encrypts and does not verify the chain. The API's own
   *     pool has always connected this way.
   *   * **node-postgres**, which pg-boss uses, encrypts *and* verifies against
   *     the system trust store. Supabase's pooler presents a chain that is not
   *     in it, so pg-boss died on `self-signed certificate in certificate
   *     chain` while the API beside it worked perfectly.
   *
   * That asymmetry cost a deploy: the server listened, `/health` answered, and
   * every database route hung because the process was crashing behind it.
   * `databaseTls` below is what the job queue passes to node-postgres so both
   * drivers end up doing the same thing.
   */
  const isPooler = /pooler\.supabase\.com/i.test(env.DATABASE_URL);
  const transactionPooler = /:6543(\/|\?|$)/.test(env.DATABASE_URL);
  const remote = isPooler || /supabase\.(co|com)/i.test(env.DATABASE_URL);
  const hasSsl = /[?&]sslmode=/i.test(env.DATABASE_URL);

  if (transactionPooler) {
    const message =
      "DATABASE_URL points at a transaction-mode pooler (port 6543). Row-level security " +
      "would stop applying — the per-request settings it reads do not survive that pooler — " +
      "and the job queue cannot run on one. Use session mode: the same host on port 5432.";
    if (isProduction) throw new Error(message);
    warnings.push(message);
  }

  if (remote && !hasSsl) {
    const message =
      "DATABASE_URL has no sslmode and points at a remote database. Both drivers default to " +
      "an unencrypted connection. Append ?sslmode=require to the URL.";
    if (isProduction) throw new Error(message);
    warnings.push(message);
  }

  /**
   * The connection budget, checked rather than described.
   *
   * The comment on DATABASE_POOL_MAX has always said a session-mode pooler
   * allows about fifteen clients for the entire project. The defaults summed to
   * eighteen, and production was configured to fourteen — one below the line,
   * with nothing left for a migration, a psql session, or the Supabase SQL
   * editor. It held for single requests and broke the moment anything arrived
   * concurrently, as `(EMAXCONNSESSION) max clients reached in session mode`,
   * surfacing as a 500 on a different endpoint each time. A Vercel build
   * generating static pages does exactly that, so the first deploy pointed at
   * the real API failed on /sitemap.xml.
   *
   * Being under the limit is not enough — exceeding our own pool merely queues,
   * which is slow, while exceeding the pooler's is an immediate error. So the
   * budget keeps real headroom rather than fitting exactly.
   */
  const poolTotal = env.DATABASE_POOL_MAX + env.OPS_DATABASE_POOL_MAX + JOB_QUEUE_CONNECTIONS;
  const poolCeiling = env.DATABASE_POOLER_MAX_CLIENTS - POOLER_HEADROOM;

  if (remote && poolTotal > poolCeiling) {
    const message =
      `The database pools ask for ${poolTotal} connections ` +
      `(DATABASE_POOL_MAX ${env.DATABASE_POOL_MAX} + OPS_DATABASE_POOL_MAX ` +
      `${env.OPS_DATABASE_POOL_MAX} + ${JOB_QUEUE_CONNECTIONS} for the job queue), ` +
      `but the pooler accepts ${env.DATABASE_POOLER_MAX_CLIENTS} for the whole project ` +
      `and ${POOLER_HEADROOM} are kept free for migrations and a psql session. ` +
      `Lower the pool sizes to total ${poolCeiling} or fewer, or raise the pool size in ` +
      `the Supabase dashboard and set DATABASE_POOLER_MAX_CLIENTS to match.`;
    if (isProduction) throw new Error(message);
    warnings.push(message);
  }

  if (isProduction) {
    // Echoing the code would turn "knows a phone number" into "can sign in as
    // its owner", so this is a hard failure rather than a warning.
    if (env.OTP_DEV_ECHO) {
      throw new Error("OTP_DEV_ECHO must be false in production");
    }
    if (!env.SESSION_SECRET) {
      throw new Error("SESSION_SECRET is required in production");
    }

    /*
     * Storage may be local in production, but only when somebody chose it.
     *
     * Falling back silently would put customer photographs on a container's
     * disk, where the next deploy erases them — a data loss with no error and
     * no log line. Choosing it explicitly means a mounted volume, which is a
     * perfectly good way to run this.
     */
    if (env.STORAGE_DRIVER === "auto" && !r2Ready) {
      throw new Error(
        "Object storage is not configured. Set the R2_* variables, or STORAGE_DRIVER=local " +
          "with STORAGE_LOCAL_DIR on a mounted volume if local disk is intended.",
      );
    }
    if (storageDriver === "local") {
      warnings.push(
        `Storage driver is 'local' (${env.STORAGE_LOCAL_DIR}). Uploaded files live on this ` +
          "machine's disk — make sure it is a mounted volume, and that it is backed up.",
      );
    }
    if (!env.STORAGE_SIGNING_SECRET && storageDriver === "local" && !env.SESSION_SECRET) {
      throw new Error("STORAGE_SIGNING_SECRET is required when STORAGE_DRIVER=local in production");
    }

    /*
     * SMS is a warning rather than a failure, which is a change.
     *
     * It used to refuse to boot without MSG91, on the reasoning that nobody
     * could sign in — true, and the wrong response to it. A provider whose DLT
     * registration is still pending, or one that has gone down, should leave a
     * running platform that an operator can work through, not a service that
     * will not start.
     */
    if (smsDriver !== "msg91") {
      warnings.push(
        `SMS driver is '${smsDriver}', not msg91. One-time codes will not reach phones. ` +
          "Set MSG91_AUTH_KEY and MSG91_TEMPLATE_ID once DLT registration completes.",
      );
    }
    if (pushDriver !== "fcm") {
      warnings.push(
        "Push driver is 'log'. Notifications are still written and still sent by SMS; " +
          "they will not reach a device until FCM_SERVICE_ACCOUNT and FCM_PROJECT_ID are set.",
      );
    }
  }

  return {
    ...env,
    isProduction,
    isTest: env.NODE_ENV === "test",
    /** The driver actually in use, with `auto` already resolved. */
    smsDriver,
    storageDriver,
    pushDriver,

    /**
     * What node-postgres should be told about TLS.
     *
     * `false` locally, where the database has no certificate at all and
     * forcing one fails. Remote, it matches postgres.js: encrypt, do not
     * verify the chain — the alternative is shipping Supabase's CA and
     * pinning ourselves to their rotation schedule, for a connection that
     * only ever goes to a host we named ourselves.
     */
    databaseTls: remote && hasSsl ? ({ rejectUnauthorized: false } as const) : false,

    /**
     * The same URL with `sslmode` removed, for node-postgres only.
     *
     * Passing `ssl` beside a connection string that carries `sslmode` does
     * nothing: node-postgres reads the string last and the string wins, so the
     * explicit setting above is silently discarded and the chain is verified
     * anyway. Proved by trying both against the live pooler — with `sslmode`
     * present it fails on `SELF_SIGNED_CERT_IN_CHAIN`, with it stripped and
     * `ssl` supplied it connects.
     *
     * postgres.js is untouched by any of this and keeps the full URL.
     */
    databaseUrlForPg: env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/i, ""),

    /**
     * Origins the browser may call this API from.
     *
     * Both `www` and the apex, derived from whichever was configured. They are
     * different origins to a browser and only one can be written in
     * `WEB_ORIGIN`, so an allowlist built from that value alone rejects half
     * the site — and CORS failures do not appear in the server log at all,
     * which is a bad way to find out. Production is configured as
     * `https://www.decorashine.com` while the site answers on the apex, so this
     * was already wrong for every visitor who typed the short address.
     */
    corsOrigins: [
      ...[env.WEB_ORIGIN, env.ADMIN_ORIGIN].flatMap((origin) => {
        const url = new URL(origin);
        const host = url.host.startsWith("www.") ? url.host.slice(4) : url.host;
        return [`${url.protocol}//${host}`, `${url.protocol}//www.${host}`];
      }),
      /*
       * Any localhost port, outside production only. `flutter run -d chrome`
       * serves the mobile app from a port it picks at random, so no fixed
       * origin can name it. Production keeps the strict list above.
       */
      ...(isProduction ? [] : [/^http:\/\/(localhost|127\.0\.0\.1):\d+$/]),
    ],

    /** GOOGLE_CLIENT_IDS split and cleaned. Empty when the feature is off. */
    googleClientIds: (env.GOOGLE_CLIENT_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),

    warnings,
  };
}

export const config = load();
export type Config = typeof config;
