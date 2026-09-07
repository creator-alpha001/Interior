/**
 * Sending an SMS.
 *
 * One place, so switching provider is one file. MSG91 because Indian
 * transactional SMS needs a DLT-registered template and sender id, which a
 * generic international provider cannot give you.
 *
 * Two shapes: `sendOtp` uses the OTP flow (a template with one variable, and
 * MSG91's own delivery guarantees), `sendTransactional` uses a normal flow for
 * everything else. They are different endpoints at the provider.
 *
 * ---
 *
 * **Every driver here works without an account.** That is deliberate, and it is
 * a change from how this file used to behave: `sendOtp` threw when MSG91 was
 * unconfigured, which meant that until DLT registration completed — days to
 * weeks, and outside anyone's control — nobody could sign in at all, on any
 * surface. A dependency with a lead time should not be able to stop the
 * platform running; it should degrade to something an operator can work
 * through.
 *
 * So:
 *
 * - `msg91`   the real thing
 * - `console` writes the code to the log. Somebody with server access can read
 *             it during an outage, and somebody with server access already has
 *             the database — this grants no capability that was not there. It
 *             is never exposed over HTTP, which is the line that matters:
 *             `OTP_DEV_ECHO` returns a code to *the caller* and is refused in
 *             production; this does not
 * - `file`    appends to a file somebody tails and sends by hand
 */
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { config } from "./config";

export interface SmsResult {
  sent: boolean;
  /** Returned only when OTP_DEV_ECHO is on, so local work needs no SMS account. */
  devCode?: string;
  /** Why it did not send, when it did not. Recorded, not swallowed. */
  skippedReason?: string;
}

/** Appends one line to the outbox file, creating it on first use. */
async function appendToOutbox(mobile: string, message: string): Promise<void> {
  const path = resolve(config.SMS_OUTBOX_PATH);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${new Date().toISOString()}\t${mobile}\t${message}\n`, "utf8");
}

/* ------------------------------------------------------------------ *
 * One-time codes
 * ------------------------------------------------------------------ */

export async function sendOtp(mobile: string, code: string): Promise<SmsResult> {
  if (config.OTP_DEV_ECHO) {
    // config.ts refuses to start with this on when NODE_ENV=production.
    return { sent: false, devCode: code };
  }

  switch (config.smsDriver) {
    case "console":
      // Deliberately at info, not debug: if this is how codes are reaching
      // people, the line has to be visible in the default log level.
      console.info(`[sms:console] OTP for ${mobile}: ${code}`);
      return { sent: false, skippedReason: "SMS driver is 'console'; the code is in the log" };

    case "file":
      await appendToOutbox(mobile, `OTP ${code}`);
      return { sent: false, skippedReason: `SMS driver is 'file'; written to ${config.SMS_OUTBOX_PATH}` };

    case "msg91":
      return sendViaMsg91({
        templateId: config.MSG91_TEMPLATE_ID!,
        recipient: { mobiles: mobile, otp: code },
        // A sign-in should fail fast rather than hold a request open: the user
        // can press the button again, and a hung provider must not exhaust the
        // connection pool.
        throwOnFailure: true,
      });

    default:
      return { sent: false, skippedReason: `unknown SMS driver ${config.smsDriver}` };
  }
}

/* ------------------------------------------------------------------ *
 * Everything else
 * ------------------------------------------------------------------ */

/**
 * A notification SMS.
 *
 * Returns rather than throws when it cannot send: a missing provider must not
 * fail the job delivering a notification, because the notification is already
 * recorded and already visible in the app. It simply has not gone out by text,
 * and the reason is now written on the row.
 */
export async function sendTransactional(mobile: string, message: string): Promise<SmsResult> {
  switch (config.smsDriver) {
    case "console":
      console.info(`[sms:console] → ${mobile}: ${message}`);
      return { sent: false, skippedReason: "SMS driver is 'console'" };

    case "file":
      await appendToOutbox(mobile, message);
      return { sent: false, skippedReason: "SMS driver is 'file'" };

    case "msg91":
      if (!config.MSG91_NOTIFY_TEMPLATE_ID) {
        // The notification template is a separate DLT registration from the OTP
        // one, and it routinely lands later. Codes working while notifications
        // do not is a normal intermediate state, not a misconfiguration.
        return { sent: false, skippedReason: "MSG91_NOTIFY_TEMPLATE_ID is not set" };
      }
      return sendViaMsg91({
        templateId: config.MSG91_NOTIFY_TEMPLATE_ID,
        // DLT templates take named variables, not free text. `message` fills
        // the one variable the registered notification template declares.
        recipient: { mobiles: mobile, message },
        throwOnFailure: false,
      });

    default:
      return { sent: false, skippedReason: `unknown SMS driver ${config.smsDriver}` };
  }
}

/* ------------------------------------------------------------------ *
 * The provider
 * ------------------------------------------------------------------ */

async function sendViaMsg91(input: {
  templateId: string;
  recipient: Record<string, string>;
  throwOnFailure: boolean;
}): Promise<SmsResult> {
  if (!config.MSG91_AUTH_KEY) {
    const reason = "MSG91_AUTH_KEY is not set";
    if (input.throwOnFailure) throw new Error(`SMS is not configured: ${reason}`);
    return { sent: false, skippedReason: reason };
  }

  try {
    const response = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: config.MSG91_AUTH_KEY },
      body: JSON.stringify({
        template_id: input.templateId,
        sender: config.MSG91_SENDER_ID,
        recipients: [input.recipient],
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const reason = `provider returned ${response.status}`;
      if (input.throwOnFailure) throw new Error(`SMS provider returned ${response.status}`);
      return { sent: false, skippedReason: reason };
    }

    return { sent: true };
  } catch (error) {
    if (input.throwOnFailure) throw error;
    return { sent: false, skippedReason: error instanceof Error ? error.message : "send failed" };
  }
}

/** For the health endpoint and the startup log: what is actually in use. */
export function smsDescription(): string {
  return config.smsDriver === "msg91"
    ? `msg91 (${config.MSG91_SENDER_ID ?? "no sender id"})`
    : `${config.smsDriver} — codes are not reaching phones`;
}
