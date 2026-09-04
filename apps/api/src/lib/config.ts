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

  if (isProduction) {
    // Echoing the code would turn "knows a phone number" into "can sign in as
    // its owner", so this is a hard failure rather than a warning.
    if (env.OTP_DEV_ECHO) {
      throw new Error("OTP_DEV_ECHO must be false in production");
    }
    if (!env.SESSION_SECRET) {
      throw new Error("SESSION_SECRET is required in production");
    }
    if (!env.MSG91_AUTH_KEY) {
      throw new Error("MSG91_AUTH_KEY is required in production — nobody could sign in without it");
    }
  }

  return { ...env, isProduction, isTest: env.NODE_ENV === "test" };
}

export const config = load();
export type Config = typeof config;
