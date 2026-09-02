/**
 * File uploads.
 *
 * Today a chosen file never leaves the browser — `URL.createObjectURL` makes it
 * visible in the form and that is the end of it. This module exists so that
 * stops being true in one place rather than in every form.
 *
 * The real flow is deliberately the one this mirrors: ask the backend for a
 * short-lived upload ticket, PUT the bytes straight at storage, then send the
 * returned asset id with the form. Bytes never pass through the application
 * server, which is what keeps a twenty-photo stage submission from timing out.
 */
import type { MediaAsset } from "@repo/types";
import { USING_API, api } from "./client";

/** What the file is for. Drives where it is stored and who may read it back. */
export type UploadPurpose =
  | "requirement_photo"
  | "milestone_proof"
  | "portfolio_item"
  | "vendor_document";

/** Per-purpose limits, enforced before a byte is sent. */
const RULES: Record<UploadPurpose, { maxBytes: number; accept: string[]; maxFiles: number }> = {
  requirement_photo: { maxBytes: 10_000_000, accept: ["image/"], maxFiles: 6 },
  milestone_proof: { maxBytes: 10_000_000, accept: ["image/"], maxFiles: 8 },
  portfolio_item: { maxBytes: 10_000_000, accept: ["image/"], maxFiles: 20 },
  vendor_document: {
    maxBytes: 20_000_000,
    accept: ["image/", "application/pdf"],
    maxFiles: 10,
  },
};

export class UploadError extends Error {
  constructor(
    readonly fileName: string,
    message: string,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

export interface UploadTicket {
  /** Where to PUT the bytes. */
  uploadUrl: string;
  /** Headers the storage provider requires on that PUT. */
  headers: Record<string, string>;
  /** The id to send with the form once the PUT succeeds. */
  assetId: string;
  /** Where the file will be readable from afterwards. */
  publicUrl: string;
}

/**
 * Checks a file against its purpose before anything is sent.
 *
 * Separate from `uploadFile` so a form can grey out an over-sized file at the
 * moment it is picked, rather than after a failed upload.
 */
export function checkFile(file: File, purpose: UploadPurpose): string | null {
  const rule = RULES[purpose];
  if (!rule.accept.some((prefix) => file.type.startsWith(prefix))) {
    return `${file.name} is not a supported file type`;
  }
  if (file.size > rule.maxBytes) {
    return `${file.name} is larger than ${Math.round(rule.maxBytes / 1_000_000)} MB`;
  }
  return null;
}

export function maxFilesFor(purpose: UploadPurpose): number {
  return RULES[purpose].maxFiles;
}

/**
 * Uploads one file and returns the asset to attach to a form.
 *
 * With no backend configured this resolves immediately to a local object URL,
 * which is exactly what the forms did before — the difference is that they now
 * go through the seam, so connecting real storage changes this function and
 * nothing else.
 */
export async function uploadFile(
  file: File,
  purpose: UploadPurpose,
  options: { signal?: AbortSignal } = {},
): Promise<MediaAsset> {
  const problem = checkFile(file, purpose);
  if (problem) throw new UploadError(file.name, problem);

  if (!USING_API) {
    return {
      id: `local-${Math.random().toString(36).slice(2, 10)}`,
      url: URL.createObjectURL(file),
      type: file.type === "application/pdf" ? "document" : "photo",
      caption: file.name,
    };
  }

  const ticket = await api<UploadTicket>("/uploads/tickets", {
    method: "POST",
    body: {
      purpose,
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    },
    signal: options.signal,
  });

  const response = await fetch(ticket.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type, ...ticket.headers },
    body: file,
    signal: options.signal,
  });

  if (!response.ok) {
    throw new UploadError(file.name, `Upload failed (${response.status})`);
  }

  return {
    id: ticket.assetId,
    url: ticket.publicUrl,
    type: file.type === "application/pdf" ? "document" : "photo",
    caption: file.name,
  };
}

/**
 * Uploads several files, reporting each as it lands.
 *
 * Sequential rather than parallel: a vendor submitting eight site photographs
 * is usually on mobile data, and eight concurrent PUTs there is slower than
 * eight sequential ones, not faster.
 */
export async function uploadFiles(
  files: File[],
  purpose: UploadPurpose,
  onEach?: (asset: MediaAsset, index: number) => void,
): Promise<MediaAsset[]> {
  const assets: MediaAsset[] = [];
  for (const [index, file] of files.entries()) {
    const asset = await uploadFile(file, purpose);
    assets.push(asset);
    onEach?.(asset, index);
  }
  return assets;
}
