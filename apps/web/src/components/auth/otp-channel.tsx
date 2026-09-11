"use client";

import type { OtpChannel } from "@repo/data";

/**
 * Where a code went, and how to have it sent the other way.
 *
 * Shared by every screen on the site that asks for a code, because they have to
 * agree. A screen saying "check WhatsApp" for a code that went by SMS strands
 * somebody, and the copy of that sentence that drifts is always the one on the
 * screen used twice a year.
 */

/**
 * "on WhatsApp " or "by SMS ", trailing space included, for the middle of a
 * sentence — or nothing, from an API too old to say.
 */
export function sentVia(channel: OtpChannel | undefined): string {
  if (channel === "whatsapp") return "on WhatsApp ";
  if (channel === "sms") return "by SMS ";
  return "";
}

/**
 * The other channel, offered straight away rather than after the resend
 * countdown.
 *
 * Somebody with no WhatsApp on this number receives nothing by waiting thirty
 * seconds, so making them wait is only a delay. The server's per-number limit
 * is what stops it being pressed on repeat.
 */
export function OtherChannelButton({
  channel,
  onSwitch,
  disabled,
}: {
  channel: OtpChannel | undefined;
  onSwitch: (next: OtpChannel) => void;
  disabled?: boolean;
}) {
  if (!channel) return null;
  const next: OtpChannel = channel === "whatsapp" ? "sms" : "whatsapp";

  return (
    <button
      type="button"
      onClick={() => onSwitch(next)}
      disabled={disabled}
      className="font-medium text-brand disabled:opacity-50"
    >
      {next === "sms" ? "Send by SMS instead" : "Send on WhatsApp instead"}
    </button>
  );
}
