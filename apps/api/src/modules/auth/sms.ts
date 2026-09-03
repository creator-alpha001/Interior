/**
 * Sending the code.
 *
 * One function, so switching provider is one file. MSG91 because Indian
 * transactional SMS needs a DLT-registered template and sender id, which a
 * generic international provider cannot give you.
 */
import { config } from "../../lib/config";

export interface SmsResult {
  sent: boolean;
  /** Returned only in development, so local work needs no SMS account. */
  devCode?: string;
}

export async function sendOtp(mobile: string, code: string): Promise<SmsResult> {
  if (config.OTP_DEV_ECHO) {
    // Refused at startup when NODE_ENV=production, so this cannot reach a
    // deployed environment — see lib/config.ts.
    return { sent: false, devCode: code };
  }

  if (!config.MSG91_AUTH_KEY || !config.MSG91_TEMPLATE_ID) {
    throw new Error("SMS is not configured: set MSG91_AUTH_KEY and MSG91_TEMPLATE_ID");
  }

  const response = await fetch("https://control.msg91.com/api/v5/flow/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authkey: config.MSG91_AUTH_KEY,
    },
    body: JSON.stringify({
      template_id: config.MSG91_TEMPLATE_ID,
      sender: config.MSG91_SENDER_ID,
      recipients: [{ mobiles: mobile, otp: code }],
    }),
    // A login should fail fast rather than hold a request open: the user can
    // press the button again, and a hung provider must not exhaust the pool.
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`SMS provider returned ${response.status}`);
  }

  return { sent: true };
}
