/**
 * Getting a one-time code to somebody, on WhatsApp or by SMS.
 *
 * The caller says which it would like; this decides which it gets, and the
 * answer goes back in the response so the screen can say where to look.
 *
 * Two rules, both about not stranding a person:
 *
 * - **A channel that is not live is swapped for one that is.** Asking for
 *   WhatsApp on a deployment whose WhatsApp driver is still `console` would put
 *   the code in a log nobody reads, while a working SMS route sat unused.
 * - **A provider that fails is retried on the other channel**, when that one is
 *   live. MSG91's WhatsApp API being down should cost somebody a text message,
 *   not their sign-in.
 */
import { config } from "./config";
import { sendOtp, type SmsResult } from "./sms";
import { sendWhatsAppOtp } from "./whatsapp";

export type OtpChannel = "whatsapp" | "sms";

interface Drivers {
  whatsapp: string;
  sms: string;
}

const senders: Record<OtpChannel, (mobile: string, code: string) => Promise<SmsResult>> = {
  whatsapp: sendWhatsAppOtp,
  sms: sendOtp,
};

const isLive = (channel: OtpChannel, drivers: Drivers) => drivers[channel] === "msg91";
const otherThan = (channel: OtpChannel): OtpChannel => (channel === "whatsapp" ? "sms" : "whatsapp");

function currentDrivers(): Drivers {
  return { whatsapp: config.whatsappDriver, sms: config.smsDriver };
}

/**
 * Which channel a code is sent on.
 *
 * Nothing asked for means WhatsApp. With neither channel live — every laptop —
 * the answer is whatever was asked, so both screens can be exercised against
 * the console drivers.
 */
export function resolveChannel(
  requested: OtpChannel | undefined,
  drivers: Drivers = currentDrivers(),
): OtpChannel {
  const wanted = requested ?? "whatsapp";
  if (isLive(wanted, drivers) || !isLive(otherThan(wanted), drivers)) return wanted;
  return otherThan(wanted);
}

export async function deliverOtp(
  mobile: string,
  code: string,
  requested?: OtpChannel,
): Promise<SmsResult & { channel: OtpChannel }> {
  const channel = resolveChannel(requested);

  /**
   * Nothing is sent to the store reviewers' number.
   *
   * Its code is the configured one, so a message would be pointless — and the
   * number belongs to nobody, so a real WhatsApp attempt either fails and
   * takes the sign-in down with it, or worse, reaches whoever is issued that
   * number next. The screen still says which channel it would have used.
   */
  if (config.reviewAccount?.mobile === mobile) {
    return { channel, sent: false, skippedReason: "review account" };
  }

  try {
    return { ...(await senders[channel](mobile, code)), channel };
  } catch (error) {
    const fallback = otherThan(channel);
    if (!isLive(fallback, currentDrivers())) throw error;

    console.warn(
      `[otp] ${channel} failed, sending by ${fallback} instead: ` +
        (error instanceof Error ? error.message : String(error)),
    );
    return { ...(await senders[fallback](mobile, code)), channel: fallback };
  }
}
