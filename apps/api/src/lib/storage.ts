/**
 * Where uploaded files go, and how a client is told to put them there.
 *
 * Two drivers behind one function. `r2` presigns a PUT straight at Cloudflare,
 * which is how this should run in production — bytes never touch this server,
 * and a vendor uploading eight site photographs on mobile data does not hold a
 * connection open for minutes. `local` presigns a PUT at *this* API, which
 * writes to a directory.
 *
 * The local driver exists because a dependency with a lead time should not be
 * able to stop the platform working. Before this, an unconfigured bucket meant
 * upload tickets were issued against a URL that returned nothing, so the whole
 * flow — requirement photographs, stage proof, portfolio, vendor documents —
 * could be clicked through and never actually worked. That is the single thing
 * the mobile app most needs, so it now works out of the box and is switched to
 * R2 with one environment variable.
 *
 * Both drivers issue a URL that expires. The local one signs it with HMAC
 * rather than checking a session, for the same reason the R2 one does: the PUT
 * comes from a phone that may take a minute to get there, and it should carry
 * its own authority to write exactly one key.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { dirname, join, normalize, resolve, sep } from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { config } from "./config";
import { ForbiddenError, ValidationError } from "./errors";

export interface PresignedPut {
  uploadUrl: string;
  headers: Record<string, string>;
}

/** How long a ticket is good for. Long enough for a slow phone, short enough to matter. */
const TICKET_SECONDS = 900;

/**
 * The key that signs local upload URLs.
 *
 * Falls back through SESSION_SECRET to a per-boot random value. The random case
 * is right for a laptop — it only means a ticket issued before a restart cannot
 * be redeemed after one — and `config.ts` refuses it in production.
 */
const signingKey =
  config.STORAGE_SIGNING_SECRET ?? config.SESSION_SECRET ?? randomBytes(32).toString("hex");

/** Where this API is reachable from, for building absolute upload URLs. */
function apiBaseUrl(): string {
  return (config.PUBLIC_BASE_URL ?? `http://localhost:${config.PORT}`).replace(/\/$/, "");
}

/* ------------------------------------------------------------------ *
 * The public surface
 * ------------------------------------------------------------------ */

export async function presignPut(storageKey: string, contentType: string): Promise<PresignedPut> {
  return config.storageDriver === "r2"
    ? presignR2(storageKey, contentType)
    : presignLocal(storageKey, contentType);
}

/**
 * Where a stored file is readable from.
 *
 * `ph:` keys are placeholder tokens rather than files — the seed uses them and
 * the frontends render them as designed tiles — so they pass through untouched.
 */
export function publicUrlFor(storageKey: string): string {
  if (storageKey.startsWith("ph:") || storageKey.startsWith("http")) return storageKey;

  const key = storageKey.replace(/^\//, "");

  if (config.storageDriver === "r2") {
    const base = config.R2_PUBLIC_BASE_URL;
    return base ? `${base.replace(/\/$/, "")}/${key}` : `/media/${key}`;
  }

  return `${apiBaseUrl()}/media/${key}`;
}

/* ------------------------------------------------------------------ *
 * The local driver
 * ------------------------------------------------------------------ */

/**
 * Keys are built by this service, never by a caller — but this function is what
 * turns one into a filesystem path, so it checks anyway. A key that escapes the
 * media directory is refused rather than normalised into something plausible.
 */
export function localPathFor(storageKey: string): string {
  const root = resolve(config.STORAGE_LOCAL_DIR);
  const path = resolve(root, normalize(storageKey));

  /*
   * Refused, not repaired.
   *
   * Stripping the leading `../` and carrying on would turn
   * "../../../etc/passwd" into "etc/passwd" — safely inside the directory, and
   * therefore silent. A key that tries to leave is not a key with a typo in it,
   * and the useful response is to stop rather than to serve whatever the
   * sanitised version happens to name.
   */
  if (path !== root && !path.startsWith(root + sep)) {
    throw new ForbiddenError("That file is not available");
  }
  return path;
}

function signLocal(storageKey: string, expiresAt: number): string {
  return createHmac("sha256", signingKey).update(`${storageKey}\n${expiresAt}`).digest("hex");
}

function presignLocal(storageKey: string, contentType: string): PresignedPut {
  const expiresAt = Math.floor(Date.now() / 1000) + TICKET_SECONDS;
  const query = new URLSearchParams({
    expires: String(expiresAt),
    signature: signLocal(storageKey, expiresAt),
  });

  return {
    uploadUrl: `${apiBaseUrl()}/media/${storageKey}?${query.toString()}`,
    headers: { "Content-Type": contentType },
  };
}

/** Checks a signature from a local upload URL. Constant-time, and expiry first. */
export function verifyLocalSignature(
  storageKey: string,
  expires: string | undefined,
  signature: string | undefined,
): void {
  if (!expires || !signature) throw new ForbiddenError("This upload link is not valid");

  const expiresAt = Number(expires);
  if (!Number.isFinite(expiresAt) || expiresAt * 1000 < Date.now()) {
    throw new ForbiddenError("This upload link has expired. Please try again.");
  }

  const expected = Buffer.from(signLocal(storageKey, expiresAt), "hex");
  const supplied = Buffer.from(signature, "hex");

  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    throw new ForbiddenError("This upload link is not valid");
  }
}

/**
 * Writes an uploaded body to the media directory.
 *
 * Streamed rather than buffered, and capped: the ticket already declared a size
 * and `bodyLimit` does not apply to this route, so without a cap a client could
 * announce 2MB and send two gigabytes. The partial file is removed on the way
 * out, because a half-written photograph that reports success is worse than a
 * failure.
 */
export async function writeLocalObject(
  storageKey: string,
  body: Readable,
  maxBytes: number,
): Promise<number> {
  const path = localPathFor(storageKey);
  await mkdir(dirname(path), { recursive: true });

  let written = 0;
  let tooLarge = false;

  body.on("data", (chunk: Buffer) => {
    written += chunk.length;
    if (written > maxBytes && !tooLarge) {
      tooLarge = true;
      body.destroy(new ValidationError(`That file is larger than ${maxBytes} bytes`));
    }
  });

  try {
    await pipeline(body, createWriteStream(path));
  } catch (error) {
    await rm(path, { force: true }).catch(() => {});
    throw error;
  }

  return written;
}

export async function localObjectSize(storageKey: string): Promise<number | null> {
  try {
    return (await stat(localPathFor(storageKey))).size;
  } catch {
    return null;
  }
}

export function localObjectPath(storageKey: string): string {
  return localPathFor(storageKey);
}

/** Removes a stored object. Best effort — a missing file is already the goal. */
export async function deleteObject(storageKey: string): Promise<void> {
  if (config.storageDriver !== "local") return;
  await rm(localPathFor(storageKey), { force: true }).catch(() => {});
}

/* ------------------------------------------------------------------ *
 * The R2 driver
 * ------------------------------------------------------------------ */

/**
 * A presigned PUT for Cloudflare R2, which speaks the S3 API.
 *
 * Signed here rather than with the AWS SDK because this is the only S3
 * operation the platform performs, and SigV4 for a single PUT is forty lines
 * against a dependency that pulls in several megabytes.
 */
function presignR2(storageKey: string, contentType: string): PresignedPut {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = config;

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    // Unreachable: `config.ts` only resolves the driver to r2 when all four are
    // present. Stated anyway, because the alternative is a signature made from
    // the string "undefined".
    throw new Error("STORAGE_DRIVER=r2 but the R2_* variables are not all set");
  }

  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/auto/s3/aws4_request`;

  const query = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${R2_ACCESS_KEY_ID}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(TICKET_SECONDS),
    "X-Amz-SignedHeaders": "host",
  });

  const canonicalRequest = [
    "PUT",
    `/${R2_BUCKET}/${storageKey}`,
    query.toString(),
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");

  const hmac = (key: Buffer | string, data: string) =>
    createHmac("sha256", key).update(data).digest();

  const signature = hmac(
    hmac(hmac(hmac(hmac(`AWS4${R2_SECRET_ACCESS_KEY}`, dateStamp), "auto"), "s3"), "aws4_request"),
    stringToSign,
  ).toString("hex");

  query.set("X-Amz-Signature", signature);

  return {
    uploadUrl: `https://${host}/${R2_BUCKET}/${storageKey}?${query.toString()}`,
    headers: { "Content-Type": contentType },
  };
}

/** For the health endpoint and the startup log: what is actually in use. */
export function storageDescription(): string {
  return config.storageDriver === "r2"
    ? `r2 (${config.R2_BUCKET})`
    : `local (${resolve(config.STORAGE_LOCAL_DIR)})`;
}

/** Ensures the media directory exists, so the first upload is not the test. */
export async function prepareStorage(): Promise<void> {
  if (config.storageDriver === "local") {
    await mkdir(resolve(config.STORAGE_LOCAL_DIR), { recursive: true });
  }
}

export { join as joinStoragePath };
