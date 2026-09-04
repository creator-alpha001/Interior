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
 */
import { config } from "./config";

export interface SmsResult {
  sent: boolean;
  /** Returned only in development, so local work needs no SMS account. */
  devCode?: string;
  /** Why it did not send, when it did not. */
  skippedReason?: string;
}

export async function sendOtp(mobile: string, code: string): Promise<SmsResult> {
  if (config.OTP_DEV_ECHO) {
    // config.ts refuses to start with this on when NODE_ENV=production.
    return { sent: false, devCode: code };
  }

  if (!config.MSG91_AUTH_KEY || !config.MSG91_TEMPLATE_ID) {
    throw new Error("SMS is not configured: set MSG91_AUTH_KEY and MSG91_TEMPLATE_ID");
  }

  const response = await fetch("https://control.msg91.com/api/v5/flow/", {
    method: "POST",
    headers: { "Content-Type": "application/json", authkey: config.MSG91_AUTH_KEY },
    body: JSON.stringify({
      template_id: config.MSG91_TEMPLATE_ID,
      sender: config.MSG91_SENDER_ID,
      recipients: [{ mobiles: mobile, otp: code }],
    }),
    // A login should fail fast rather than hold a request open: the user can
    // press the button again, and a hung provider must not exhaust the pool.
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) throw new Error(`SMS provider returned ${response.status}`);
  return { sent: true };
}

/**
 * A notification SMS.
 *
 * Returns rather than throws when SMS is not configured: a missing provider
 * should not fail the job that is delivering a notification, because the
 * notification is already recorded and visible in the app. It just has not gone
 * out by text.
 */
export async function sendTransactional(mobile: string, message: string): Promise<SmsResult> {
  if (!config.MSG91_AUTH_KEY || !config.MSG91_NOTIFY_TEMPLATE_ID) {
    return { sent: false, skippedReason: "SMS is not configured" };
  }

  try {
    const response = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: config.MSG91_AUTH_KEY },
      body: JSON.stringify({
        template_id: config.MSG91_NOTIFY_TEMPLATE_ID,
        sender: config.MSG91_SENDER_ID,
        // DLT templates take named variables, not free text. `message` fills
        // the one variable the registered notification template declares.
        recipients: [{ mobiles: mobile, message }],
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return { sent: false, skippedReason: `provider returned ${response.status}` };
    }
    return { sent: true };
  } catch (error) {
    return { sent: false, skippedReason: error instanceof Error ? error.message : "send failed" };
  }
}
