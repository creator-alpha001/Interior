/**
 * Sending a push notification.
 *
 * One place, so switching provider is one file — the same arrangement `sms.ts`
 * has and for the same reason. Firebase Cloud Messaging because it reaches both
 * Android and iOS from one integration, and because APNs on its own needs a
 * certificate rotation nobody remembers to do.
 *
 * Push is a *delivery mechanism for the existing outbox*, not a new one. A
 * notification row is still written inside the transaction that caused it, and
 * still visible in the app whether or not any of this works. That ordering is
 * what stops a push going out for a write that rolled back, and it is why the
 * `log` driver below is a perfectly serviceable way to run: nothing is lost
 * when push is off, it just does not buzz.
 */
import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";
import { config } from "./config";

export interface PushMessage {
  token: string;
  title: string;
  body: string;
  /** Where a tap should land. Read by the app's deep-link router. */
  data?: Record<string, string>;
}

export interface PushResult {
  sent: boolean;
  /** The token is dead — uninstalled, or never valid. Stop trying it. */
  permanentFailure?: boolean;
  skippedReason?: string;
}

/* ------------------------------------------------------------------ *
 * The service account, and an access token made from it
 * ------------------------------------------------------------------ */

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id?: string;
}

let cachedAccount: ServiceAccount | null | undefined;
let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * `FCM_SERVICE_ACCOUNT` is either the JSON itself or a path to it.
 *
 * Both, because the two hosting arrangements want different things: Railway
 * takes a multi-line environment variable happily, and a Docker deployment
 * would rather mount the file.
 */
function serviceAccount(): ServiceAccount | null {
  if (cachedAccount !== undefined) return cachedAccount;

  const raw = config.FCM_SERVICE_ACCOUNT;
  if (!raw) return (cachedAccount = null);

  try {
    const text = raw.trim().startsWith("{") ? raw : readFileSync(raw, "utf8");
    const parsed = JSON.parse(text) as ServiceAccount;
    cachedAccount = parsed.client_email && parsed.private_key ? parsed : null;
  } catch {
    cachedAccount = null;
  }

  return cachedAccount;
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

/**
 * A short-lived OAuth token for the FCM v1 API.
 *
 * Signed here rather than with `google-auth-library`, which is several
 * megabytes of dependency for one JWT and one token exchange. Cached until
 * shortly before it expires, so a batch of fifty notifications makes one token
 * request rather than fifty.
 */
async function accessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const account = serviceAccount();
  if (!account) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );

  const signature = createSign("RSA-SHA256")
    .update(`${header}.${claims}`)
    .sign(account.private_key.replace(/\\n/g, "\n"), "base64url");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) return null;

  const json = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;

  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

/* ------------------------------------------------------------------ *
 * Sending
 * ------------------------------------------------------------------ */

export async function sendPush(message: PushMessage): Promise<PushResult> {
  if (config.pushDriver === "log") {
    // Not a no-op: the line is the record that the plumbing reached this point
    // with the right payload, which is most of what push integration work is.
    console.info(
      `[push:log] → ${message.token.slice(0, 12)}… ${message.title} — ${message.body}`,
      message.data ?? {},
    );
    return { sent: false, skippedReason: "push driver is 'log'" };
  }

  const token = await accessToken();
  const projectId = config.FCM_PROJECT_ID ?? serviceAccount()?.project_id;

  if (!token || !projectId) {
    return { sent: false, skippedReason: "FCM credentials are not usable" };
  }

  try {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: {
            token: message.token,
            notification: { title: message.title, body: message.body },
            // Data is what the app routes on. Values must be strings — FCM
            // rejects the whole message for a number, which is an unhelpful
            // 400 to debug at three in the morning.
            data: message.data ?? {},
            android: { priority: "high" },
            apns: { payload: { aps: { sound: "default" } } },
          },
        }),
        signal: AbortSignal.timeout(8000),
      },
    );

    if (response.ok) return { sent: true };

    /*
     * 404 and 403 mean this token is finished — the app was uninstalled, or the
     * token belongs to another project. Anything else is transient. Telling
     * them apart is what stops the dispatcher asking about a deleted app every
     * two minutes for the rest of the year.
     */
    const permanent = response.status === 404 || response.status === 403;
    const detail = await response.text().catch(() => "");

    return {
      sent: false,
      permanentFailure: permanent,
      skippedReason: `FCM returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
    };
  } catch (error) {
    return { sent: false, skippedReason: error instanceof Error ? error.message : "send failed" };
  }
}

/** For the health endpoint: whether push would actually leave the building. */
export function pushDescription(): string {
  return config.pushDriver === "fcm" ? `fcm (${config.FCM_PROJECT_ID ?? "from service account"})` : "log";
}
