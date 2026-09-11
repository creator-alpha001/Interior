/**
 * Uploading and serving files when there is no bucket.
 *
 * Registered only under the local storage driver. With R2 configured, neither
 * of these routes exists — the phone PUTs straight at Cloudflare and reads
 * straight from the public base, which is the arrangement worth having in
 * production and the reason bytes do not pass through this process.
 *
 * The PUT is authorised by the signature in its own URL rather than by a
 * session, exactly as the R2 presigned PUT is. That is what lets a visitor
 * attach photographs of their room before they have an account, and what lets a
 * vendor's upload queue retry twenty minutes later from a lift.
 *
 * These routes are wrapped in their own plugin scope so the wildcard body
 * parser below — which hands the raw stream through untouched — applies here
 * and nowhere else. Registering it on the root instance would stop every other
 * route parsing JSON.
 */
import { createReadStream } from "node:fs";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import * as t from "../db/schema";
import { config } from "../lib/config";
import { NotFoundError, ValidationError } from "../lib/errors";
import {
  isPrivateKey,
  localObjectPath,
  localObjectSize,
  verifyLocalReadSignature,
  verifyLocalSignature,
  writeLocalObject,
} from "../lib/storage";
import { RULES } from "../modules/uploads/repository";

/** The largest any purpose allows, as the hard cap on an unparsed body. */
const MAX_BYTES = Math.max(...Object.values(RULES).map((r) => r.maxBytes));

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".pdf": "application/pdf",
};

function contentTypeFor(key: string): string {
  const dot = key.lastIndexOf(".");
  return (dot === -1 ? undefined : CONTENT_TYPES[key.slice(dot)]) ?? "application/octet-stream";
}

export async function registerMediaRoutes(app: FastifyInstance) {
  if (config.storageDriver !== "local") return;

  await app.register(async (media) => {
    // Everything arriving here is a file. Hand the stream straight through
    // rather than buffering it into memory to be parsed and immediately
    // written back out.
    media.addContentTypeParser("*", (_request, payload, done) => done(null, payload));

    /**
     * Redeems an upload ticket.
     *
     * The signature covers the key and the expiry, so a ticket writes exactly
     * one object and only for as long as it is good for. The row was written
     * when the ticket was issued; this fills in what actually arrived, and
     * `attachMedia` later binds it to the record that references it.
     */
    media.put<{ Params: { "*": string } }>("/media/*", async (request, reply) => {
      const storageKey = request.params["*"];
      const { expires, signature } = request.query as { expires?: string; signature?: string };

      verifyLocalSignature(storageKey, expires, signature);

      const written = await writeLocalObject(storageKey, request.raw, MAX_BYTES);
      if (written === 0) throw new ValidationError("That file was empty");

      // The declared size was checked when the ticket was issued; this is what
      // was actually received, and the two are worth being able to compare.
      await db
        .update(t.mediaAssets)
        .set({ sizeBytes: written, updatedAt: new Date().toISOString() })
        .where(eq(t.mediaAssets.storageKey, storageKey))
        .catch(() => {});

      reply.code(200);
      return { ok: true, bytes: written };
    });

    /**
     * Serves a stored file.
     *
     * Public for photographs, which matches how they read from R2's public
     * base. Private purposes — vendor documents and signed agreements — need
     * the signed, expiring link `readUrlFor` issues, and are never cached.
     */
    media.get<{ Params: { "*": string } }>("/media/*", async (request, reply) => {
      const storageKey = request.params["*"];
      const privateFile = isPrivateKey(storageKey);

      if (privateFile) {
        const { expires, signature } = request.query as { expires?: string; signature?: string };
        verifyLocalReadSignature(storageKey, expires, signature);
      }

      const size = await localObjectSize(storageKey);
      if (size === null) throw new NotFoundError("That file is not available");

      reply
        .header("Content-Type", contentTypeFor(storageKey))
        .header("Content-Length", String(size))
        // Keys are content-addressed by a uuid that is never reused, so this
        // can be cached hard. It is the difference between a catalogue screen
        // costing one round trip and costing thirty.
        .header(
          "Cache-Control",
          privateFile ? "private, no-store" : "public, max-age=31536000, immutable",
        );

      return reply.send(createReadStream(localObjectPath(storageKey)));
    });
  });
}
