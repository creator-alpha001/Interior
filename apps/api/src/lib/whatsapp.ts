/**
 * Sending a one-time code on WhatsApp.
 *
 * Through MSG91's WhatsApp API, with a Meta-approved *authentication*
 * template: the category Meta prices lowest, and the only one allowed a
 * copy-code button. The wording is Meta's own, so there is nothing here to
 * phrase — only the code, filled in twice: once in the body and once behind
 * the button.
 *
 * Every driver works without an account, for the reason `sms.ts` gives. A Meta
 * Business verification with a lead time of weeks must not stop anybody
 * signing in on a laptop.
 *
 * - `msg91`   the real thing
 * - `console` writes the code to the log, exactly as the SMS driver of the
 *             same name does
 */
import { config, type Config } from "./config";
import type { SmsResult } from "./sms";

const MSG91_WHATSAPP_URL = "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/";

export async function sendWhatsAppOtp(mobile: string, code: string): Promise<SmsResult> {
  if (config.OTP_DEV_ECHO) {
    // config.ts refuses to start with this on when NODE_ENV=production.
    return { sent: false, devCode: code };
  }

  switch (config.whatsappDriver) {
    case "console":
      // At info, like the SMS console driver: if this is how codes are reaching
      // people, the line has to be visible at the default log level.
      console.info(`[whatsapp:console] OTP for ${mobile}: ${code}`);
      return { sent: false, skippedReason: "WhatsApp driver is 'console'; the code is in the log" };

    case "msg91":
      return sendViaMsg91(mobile, code);

    default:
      return { sent: false, skippedReason: `unknown WhatsApp driver ${config.whatsappDriver}` };
  }
}

type TemplateSettings = Pick<
  Config,
  | "MSG91_WHATSAPP_NUMBER"
  | "MSG91_WHATSAPP_OTP_TEMPLATE"
  | "MSG91_WHATSAPP_OTP_LANGUAGE"
  | "MSG91_WHATSAPP_NAMESPACE"
>;

/**
 * The request body, on its own so a test can hold its shape without a network.
 *
 * `to` is the number as stored — twelve digits with the country code, which is
 * what `mobileSchema` normalises to and what WhatsApp expects.
 */
export function whatsAppOtpRequest(mobile: string, code: string, settings: TemplateSettings = config) {
  return {
    integrated_number: settings.MSG91_WHATSAPP_NUMBER,
    content_type: "template",
    payload: {
      messaging_product: "whatsapp",
      type: "template",
      template: {
        name: settings.MSG91_WHATSAPP_OTP_TEMPLATE,
        language: { code: settings.MSG91_WHATSAPP_OTP_LANGUAGE, policy: "deterministic" },
        ...(settings.MSG91_WHATSAPP_NAMESPACE ? { namespace: settings.MSG91_WHATSAPP_NAMESPACE } : {}),
        to_and_components: [
          {
            to: [mobile],
            components: {
              body_1: { type: "text", value: code },
              // The copy-code button takes the code as a URL-subtype parameter.
              // Meta rejects a send that leaves it out for a template that has
              // the button — which is every template worth sending.
              button_1: { subtype: "url", type: "text", value: code },
            },
          },
        ],
      },
    },
  };
}

async function sendViaMsg91(mobile: string, code: string): Promise<SmsResult> {
  if (!config.MSG91_AUTH_KEY || !config.MSG91_WHATSAPP_NUMBER || !config.MSG91_WHATSAPP_OTP_TEMPLATE) {
    // Thrown, like the SMS OTP path: a sign-in should fail fast, and
    // `deliverOtp` sends by SMS instead when SMS is live.
    throw new Error(
      "WhatsApp is not configured: MSG91_AUTH_KEY, MSG91_WHATSAPP_NUMBER and " +
        "MSG91_WHATSAPP_OTP_TEMPLATE are all needed",
    );
  }

  const response = await fetch(MSG91_WHATSAPP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      authkey: config.MSG91_AUTH_KEY,
    },
    body: JSON.stringify(whatsAppOtpRequest(mobile, code)),
    // A hung provider must not hold a sign-in open or exhaust the pool.
    signal: AbortSignal.timeout(8000),
  });

  // MSG91 can answer 200 and report the failure in the body, so the status
  // alone is not the verdict.
  const body = (await response.json().catch(() => null)) as {
    status?: string;
    hasError?: boolean;
  } | null;

  if (!response.ok || body?.hasError === true || body?.status === "fail") {
    throw new Error(`WhatsApp provider refused the message (${response.status})`);
  }

  return { sent: true };
}
