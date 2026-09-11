/**
 * Which channel a one-time code goes out on.
 *
 * The rule that matters is the one nobody sees until a deployment is half
 * configured: a code must never go into a driver that leads nowhere while the
 * other channel works. That is `resolveChannel`, checked here without a network.
 * The route tests check the answer actually reaches the client, because a screen
 * saying "check WhatsApp" for a code that went by SMS strands somebody just as
 * surely.
 */
import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { unscopedDb } from "../src/db/client";
import { resolveChannel } from "../src/lib/otp-delivery";
import { reset } from "../src/lib/rate-limit";
import { whatsAppOtpRequest } from "../src/lib/whatsapp";
import { app } from "./helpers/harness";

const neitherLive = { whatsapp: "console", sms: "console" };
const bothLive = { whatsapp: "msg91", sms: "msg91" };
const onlySms = { whatsapp: "console", sms: "msg91" };
const onlyWhatsApp = { whatsapp: "msg91", sms: "console" };

describe("choosing a channel", () => {
  test("defaults to WhatsApp", () => {
    expect(resolveChannel(undefined, bothLive)).toBe("whatsapp");
    expect(resolveChannel(undefined, neitherLive)).toBe("whatsapp");
  });

  test("honours the channel asked for when it is live", () => {
    expect(resolveChannel("sms", bothLive)).toBe("sms");
    expect(resolveChannel("whatsapp", bothLive)).toBe("whatsapp");
  });

  test("swaps a channel that is not live for one that is", () => {
    expect(resolveChannel(undefined, onlySms)).toBe("sms");
    expect(resolveChannel("whatsapp", onlySms)).toBe("sms");
    expect(resolveChannel("sms", onlyWhatsApp)).toBe("whatsapp");
  });

  test("keeps what was asked when neither is live, so both paths run locally", () => {
    expect(resolveChannel("sms", neitherLive)).toBe("sms");
  });
});

describe("the WhatsApp request", () => {
  const settings = {
    MSG91_WHATSAPP_NUMBER: "919000000000",
    MSG91_WHATSAPP_OTP_TEMPLATE: "decora_shine_otp",
    MSG91_WHATSAPP_OTP_LANGUAGE: "en",
    MSG91_WHATSAPP_NAMESPACE: undefined,
  };

  test("puts the code in the body and behind the copy button", () => {
    const body = whatsAppOtpRequest("919839012477", "484220", settings);
    const template = body.payload.template;
    const [recipient] = template.to_and_components;

    expect(body.integrated_number).toBe("919000000000");
    expect(body.content_type).toBe("template");
    expect(template.name).toBe("decora_shine_otp");
    expect(template.language).toEqual({ code: "en", policy: "deterministic" });
    expect(recipient?.to).toEqual(["919839012477"]);
    expect(recipient?.components.body_1).toEqual({ type: "text", value: "484220" });
    expect(recipient?.components.button_1).toEqual({ subtype: "url", type: "text", value: "484220" });
  });

  test("sends a namespace only when one is configured", () => {
    expect(whatsAppOtpRequest("919839012477", "484220", settings).payload.template).not.toHaveProperty(
      "namespace",
    );
    expect(
      whatsAppOtpRequest("919839012477", "484220", { ...settings, MSG91_WHATSAPP_NAMESPACE: "ns_1" })
        .payload.template,
    ).toHaveProperty("namespace", "ns_1");
  });
});

describe("requesting a code", () => {
  const mobile = "9839012478";

  beforeEach(async () => {
    await reset(`otp:mobile:91${mobile}`);
    await reset("otp:ip:127.0.0.1");
  });

  afterAll(async () => {
    // Shared database: no spent allowances left for the next file.
    await unscopedDb.execute(sql`DELETE FROM rate_limits WHERE key LIKE 'otp:%'`);
  });

  test("says it went on WhatsApp when nothing was asked for", async () => {
    const instance = await app();
    const response = await instance.inject({
      method: "POST",
      url: "/auth/otp/request",
      payload: { mobile },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty("channel", "whatsapp");
  });

  test("says it went by SMS when that was asked for", async () => {
    const instance = await app();
    const response = await instance.inject({
      method: "POST",
      url: "/auth/otp/request",
      payload: { mobile, channel: "sms" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty("channel", "sms");
  });

  test("refuses a channel it does not know", async () => {
    const instance = await app();
    const response = await instance.inject({
      method: "POST",
      url: "/auth/otp/request",
      payload: { mobile, channel: "telegram" },
    });

    expect(response.statusCode).toBe(400);
  });
});
