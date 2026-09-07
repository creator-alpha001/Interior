/**
 * Environment, validated once at boot.
 *
 * A missing DATABASE_URL should stop the process on startup with a readable
 * message, not surface as a null dereference on the first request that happens
 * to touch the database.
 */
import "dotenv/config";
import { z } from "zod";

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
    .default("A newer version of Aangan is required. Please update to continue."),

  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_BASE_URL: z.string().url().optional(),
});

function load() {
  const parsed = schema.safeParse(process.env);

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
    warnings,
  };
}

export const config = load();
export type Config = typeof config;
