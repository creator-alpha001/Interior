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

/**
 * Purposes whose files are nobody's business but the uploader's and ours.
 *
 * A PAN card behind an unguessable URL is still a PAN card that anyone holding
 * the link can open, for ever — and links end up in chat threads and browser
 * histories. These are read through links that expire instead, and the local
 * driver refuses them without one.
 *
 * On R2 the bucket's public domain is outside this process: block this prefix
 * there too (a WAF rule on the custom domain), or the object stays reachable to
 * anyone who learns its key.
 */
const PRIVATE_PREFIXES = ["vendor_document/"];

export function isPrivateKey(storageKey: string): boolean {
  const key = storageKey.replace(/^\//, "");
  return PRIVATE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/** Long enough to review a document, too short to be worth forwarding. */
const READ_SECONDS = 1800;

/**
 * Where a stored file can be read from by whoever is being shown it now.
 *
 * Public files get their permanent URL. Private ones get a signed link that
 * lapses, which is why no private URL is ever stored on a row.
 */
export function readUrlFor(storageKey: string): string {
  if (!isPrivateKey(storageKey)) return publicUrlFor(storageKey);

  const key = storageKey.replace(/^\//, "");
  if (config.storageDriver === "r2") return signR2Url("GET", key, READ_SECONDS);

  const expiresAt = Math.floor(Date.now() / 1000) + READ_SECONDS;
  const query = new URLSearchParams({
    expires: String(expiresAt),
    signature: signLocalRead(key, expiresAt),
  });
  return `${apiBaseUrl()}/media/${key}?${query.toString()}`;
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

/**
 * Signs a *read* of a private file.
 *
 * Signs different input from `signLocal`, so a link handed out for viewing a
 * document cannot be replayed as an upload ticket to overwrite it.
 */
function signLocalRead(storageKey: string, expiresAt: number): string {
  return createHmac("sha256", signingKey)
    .update(`read\n${storageKey}\n${expiresAt}`)
    .digest("hex");
}

/** Checks a private read link. Constant-time, and expiry first. */
export function verifyLocalReadSignature(
  storageKey: string,
  expires: string | undefined,
  signature: string | undefined,
): void {
  if (!expires || !signature) throw new ForbiddenError("That file is not available");

  const expiresAt = Number(expires);
  if (!Number.isFinite(expiresAt) || expiresAt * 1000 < Date.now()) {
    throw new ForbiddenError("This link has expired. Reload the page for a new one.");
  }

  const expected = Buffer.from(signLocalRead(storageKey, expiresAt), "hex");
  const supplied = Buffer.from(signature, "hex");

  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    throw new ForbiddenError("That file is not available");
  }
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
/**
 * Removes a stored file.
 *
 * This used to return early for anything that was not the local driver, so on
 * R2 it did nothing at all — no request, no error, no log line. Nothing calls it
 * today, which is the only reason that has not already cost anything, but it is
 * the wrong thing to leave behind: the first caller to arrive would be a feature
 * that deletes a customer's photograph, and it would report success while the
 * file stayed publicly readable at its URL for ever.
 *
 * Placeholder keys are not files. The seed uses them and the frontends render
 * them as designed tiles, so there is nothing to delete.
 */
export async function deleteObject(storageKey: string): Promise<void> {
  if (storageKey.startsWith("ph:")) return;

  if (config.storageDriver === "local") {
    await rm(localPathFor(storageKey), { force: true }).catch(() => {});
    return;
  }

  const response = await fetch(signR2Url("DELETE", storageKey), { method: "DELETE" });

  // S3 deletes are idempotent: 204 when it went, 404 when it was already gone.
  // Anything else is a real failure and should not be swallowed — a caller
  // deleting on somebody's behalf needs to know it did not happen.
  if (!response.ok && response.status !== 404) {
    throw new Error(
      `Could not delete ${storageKey} from R2: ${response.status} ${response.statusText}`,
    );
  }
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
  return {
    uploadUrl: signR2Url("PUT", storageKey),
    headers: { "Content-Type": contentType },
  };
}

/**
 * A presigned URL for one S3 operation on one object.
 *
 * Takes the method because the signature covers it: a URL signed for PUT is
 * rejected for DELETE, which is the point. Everything else — the canonical
 * request, the scope, the derived key — is identical, so both callers share it
 * rather than keeping two copies of SigV4 in step by hand.
 */
function signR2Url(
  method: "PUT" | "DELETE" | "GET",
  storageKey: string,
  expiresSeconds = TICKET_SECONDS,
): string {
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
    "X-Amz-Expires": String(expiresSeconds),
    "X-Amz-SignedHeaders": "host",
  });

  const canonicalRequest = [
    method,
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

  return `https://${host}/${R2_BUCKET}/${storageKey}?${query.toString()}`;
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
