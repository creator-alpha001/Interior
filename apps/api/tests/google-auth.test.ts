/**
 * The two pieces of Google sign-in that must not be wrong.
 *
 * Everything else in the flow fails visibly — a bad lookup returns nobody, a
 * missing city throws. These two fail *silently* in the dangerous direction: a
 * token check that accepts too much, and a link token that can be forged, both
 * hand somebody another person's account and look like a working sign-in while
 * they do it.
 *
 * So the tests are mostly about refusal. A real RSA key is generated here and
 * Google's JWKS endpoint is stubbed with it, which means the signature path is
 * exercised for real rather than mocked away — `alg: none` and a token edited
 * after signing are the two attacks that a mocked verifier would happily pass.
 */
import { createSign, generateKeyPairSync } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { verifyGoogleIdToken } from "../src/lib/google";
import { issueLinkToken, readLinkToken } from "../src/modules/auth/link-token";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test-key", alg: "RS256", use: "sig" };

const AUDIENCE = "web-client-id.apps.googleusercontent.com";
const now = () => Math.floor(Date.now() / 1000);

const encode = (value: unknown) => Buffer.from(JSON.stringify(value), "utf8").toString("base64url");

function mint(payload: Record<string, unknown>, header: Record<string, unknown> = {}): string {
  const head = encode({ alg: "RS256", kid: "test-key", typ: "JWT", ...header });
  const body = encode(payload);
  const signature = createSign("RSA-SHA256")
    .update(`${head}.${body}`)
    .sign(privateKey)
    .toString("base64url");
  return `${head}.${body}.${signature}`;
}

function claims(overrides: Record<string, unknown> = {}) {
  return {
    iss: "https://accounts.google.com",
    aud: AUDIENCE,
    sub: "107812345678901234567",
    email: "Person@Example.com",
    email_verified: true,
    name: "A Person",
    exp: now() + 3600,
    iat: now(),
    ...overrides,
  };
}

const realFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = (async (input: Parameters<typeof realFetch>[0], init?: RequestInit) => {
    if (String(input).includes("oauth2/v3/certs")) {
      return new Response(JSON.stringify({ keys: [jwk] }), {
        status: 200,
        headers: { "content-type": "application/json", "cache-control": "max-age=3600" },
      });
    }
    return realFetch(input, init);
  }) as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

describe("Google ID token", () => {
  test("accepts a token Google signed for this application", async () => {
    const identity = await verifyGoogleIdToken(mint(claims()), [AUDIENCE]);
    expect(identity.subject).toBe("107812345678901234567");
    // Lowercased, because addresses are compared and stored case-insensitively
    // everywhere else and Google does not promise a casing.
    expect(identity.email).toBe("person@example.com");
    expect(identity.name).toBe("A Person");
  });

  test("refuses a token minted for a different application", async () => {
    // A perfectly valid Google token — just not for us. Accepting it would let
    // any app that can sign a user in sign them into this one.
    await expect(
      verifyGoogleIdToken(mint(claims({ aud: "someone-elses-app" })), [AUDIENCE]),
    ).rejects.toThrow(/different app/i);
  });

  test("refuses an expired token", async () => {
    await expect(
      verifyGoogleIdToken(mint(claims({ exp: now() - 3600 })), [AUDIENCE]),
    ).rejects.toThrow(/expired/i);
  });

  test("refuses the wrong issuer", async () => {
    await expect(
      verifyGoogleIdToken(mint(claims({ iss: "https://evil.example" })), [AUDIENCE]),
    ).rejects.toThrow(/issuer/i);
  });

  test("refuses an unverified email address", async () => {
    // The address is the only thing support has to identify the account by, and
    // its whole value is that somebody else confirmed it.
    await expect(
      verifyGoogleIdToken(mint(claims({ email_verified: false })), [AUDIENCE]),
    ).rejects.toThrow(/not verified/i);
  });

  test("refuses `alg: none`, rather than reading the algorithm off the token", async () => {
    // The classic JWT attack: strip the signature and say there was not meant
    // to be one. `alg` is attacker-controlled, so it is checked, not obeyed.
    const head = encode({ alg: "none", kid: "test-key" });
    await expect(
      verifyGoogleIdToken(`${head}.${encode(claims())}.`, [AUDIENCE]),
    ).rejects.toThrow(/algorithm/i);
  });

  test("refuses a payload edited after signing", async () => {
    const [head, , signature] = mint(claims()).split(".");
    const swapped = encode(claims({ sub: "999-somebody-else" }));
    await expect(
      verifyGoogleIdToken(`${head}.${swapped}.${signature}`, [AUDIENCE]),
    ).rejects.toThrow(/could not be verified/i);
  });

  test("refuses everything when no client id is configured", async () => {
    // An empty allowlist must not read as "any audience will do".
    await expect(verifyGoogleIdToken(mint(claims()), [])).rejects.toThrow(/GOOGLE_CLIENT_IDS/);
  });
});

describe("link token", () => {
  test("survives a round trip", () => {
    const token = issueLinkToken({
      provider: "google",
      subject: "abc",
      email: "a@b.com",
      name: "A Person",
    });
    expect(readLinkToken(token)).toMatchObject({
      provider: "google",
      subject: "abc",
      email: "a@b.com",
    });
  });

  test("refuses a payload swapped for somebody else's", () => {
    // The attack this exists to stop: complete an OTP on your own number while
    // presenting a link token that names another person's Google account.
    const real = issueLinkToken({ provider: "google", subject: "abc", email: "a@b.com" });
    const forged = encode({
      provider: "google",
      subject: "victim",
      email: "victim@example.com",
      exp: now() + 600,
    });
    expect(() => readLinkToken(`${forged}.${real.split(".")[1]}`)).toThrow();
  });

  test("refuses an expired token", () => {
    const body = encode({ provider: "google", subject: "abc", email: "a@b.com", exp: now() - 10 });
    expect(() => readLinkToken(`${body}.whatever`)).toThrow();
  });

  test("refuses nonsense", () => {
    expect(() => readLinkToken("not-a-token")).toThrow();
  });
});
