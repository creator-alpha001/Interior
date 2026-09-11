"use client";

import { useRef, useState, useTransition } from "react";
import { UploadError, maxFilesFor, uploadFile } from "@repo/data";
import { Button, cn } from "@repo/ui";
import { issueUploadTicketAction } from "@/app/actions";

export interface PickedImage {
  id: string;
  url: string;
  caption?: string;
}

/**
 * Choosing the pictures for a catalogue item.
 *
 * Uploads happen here, in the browser, because the file has to be streamed and
 * a server action would mean sending it twice. `uploadFile` gets a ticket through
 * a server action — the browser holds no session the API can see — and PUTs
 * straight at storage; what comes back is an asset id, and that
 * id — not a URL — is what the form submits. An asset never bound to an owner
 * is what the orphan sweep deletes, so a URL here would produce a picture that
 * worked all afternoon and vanished overnight.
 *
 * Order is the point of the reordering arrows, not decoration: every card in
 * the product shows `media[0]`, so first is the one customers see.
 */
export function ImagePicker({
  value,
  onChange,
  purpose = "catalogue_image",
  disabled,
}: {
  value: PickedImage[];
  onChange: (next: PickedImage[]) => void;
  purpose?: "catalogue_image";
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startUpload] = useTransition();
  const limit = maxFilesFor(purpose);

  function choose(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    const room = limit - value.length;
    if (room <= 0) {
      setError(`That is the maximum of ${limit} images.`);
      return;
    }

    const chosen = Array.from(files).slice(0, room);

    startUpload(async () => {
      const added: PickedImage[] = [];
      for (const file of chosen) {
        try {
          const asset = await uploadFile(file, purpose, { requestTicket: issueUploadTicketAction });
          added.push({ id: asset.id, url: asset.url, caption: asset.caption });
        } catch (cause) {
          // Named, because "upload failed" with eight files selected tells
          // somebody nothing about which one to fix.
          setError(
            cause instanceof UploadError
              ? cause.message
              : `${file.name} could not be uploaded.`,
          );
          break;
        }
      }
      if (added.length > 0) onChange([...value, ...added]);
    });

    // Cleared so choosing the same file again still fires a change event.
    if (input.current) input.current.value = "";
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    onChange(next);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {value.map((image, index) => (
          <figure
            key={image.id}
            className="relative w-28 overflow-hidden rounded-lg border border-line bg-paper"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- the URL is
                an R2 public URL on a domain Next is not configured to optimise,
                and an ops thumbnail does not need it. */}
            <img
              src={image.url}
              alt={image.caption ?? ""}
              className="h-24 w-28 object-cover"
            />
            <figcaption
              className={cn(
                "px-1.5 py-1 text-center text-[11px]",
                index === 0 ? "bg-brand text-white" : "text-ink-3",
              )}
            >
              {index === 0 ? "On the card" : `#${index + 1}`}
            </figcaption>
            <div className="flex border-t border-line">
              <button
                type="button"
                onClick={() => move(index, index - 1)}
                disabled={index === 0 || disabled}
                aria-label="Move earlier"
                className="flex-1 py-1 text-[13px] text-ink-3 hover:bg-surface-2 disabled:opacity-30"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v.id !== image.id))}
                disabled={disabled}
                aria-label="Remove"
                className="flex-1 border-x border-line py-1 text-[13px] text-danger hover:bg-surface-2"
              >
                ✕
              </button>
              <button
                type="button"
                onClick={() => move(index, index + 1)}
                disabled={index === value.length - 1 || disabled}
                aria-label="Move later"
                className="flex-1 py-1 text-[13px] text-ink-3 hover:bg-surface-2 disabled:opacity-30"
              >
                →
              </button>
            </div>
          </figure>
        ))}

        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={disabled || busy || value.length >= limit}
          className="grid h-[calc(6rem+3.25rem)] w-28 place-items-center rounded-lg border border-dashed border-line-strong text-[13px] text-ink-3 hover:border-ink-4 hover:bg-surface-2 disabled:opacity-40"
        >
          {busy ? "Uploading…" : "+ Add"}
        </button>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => choose(e.target.files)}
      />

      {error ? (
        <p role="alert" className="mt-2 text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      <p className="mt-2 text-[12.5px] text-ink-4">
        The first image is the one shown on cards across the site and the app.
        Up to {limit}.
      </p>
    </div>
  );
}

/**
 * A single image, for a trade banner or a category shelf.
 *
 * Hands back the asset **id**, not the URL, even though those two rows store a
 * URL in a column. The server attaches the asset and derives the URL from it;
 * sending a URL would leave the asset owned by nothing, which is exactly what
 * the orphan sweep deletes — a banner that worked all afternoon and was gone by
 * morning, with the column still pointing at it.
 *
 * `existingUrl` is only for showing what is already there. It has no id to give
 * back, so leaving it alone reports `undefined`: unchanged, rather than cleared.
 */
export function SingleImagePicker({
  existingUrl,
  onChange,
  disabled,
}: {
  existingUrl: string | null;
  onChange: (assetId: string | null | undefined) => void;
  disabled?: boolean;
}) {
  const [picked, setPicked] = useState<PickedImage[]>(
    existingUrl ? [{ id: EXISTING, url: existingUrl }] : [],
  );

  return (
    <ImagePicker
      value={picked}
      disabled={disabled}
      onChange={(next) => {
        const last = next.slice(-1);
        setPicked(last);

        const chosen = last[0];
        if (!chosen) {
          onChange(null);
          return;
        }
        onChange(chosen.id === EXISTING ? undefined : chosen.id);
      }}
    />
  );
}

/** Stands in for an image already saved, which has no asset id to hand back. */
const EXISTING = "__existing__";

export { Button };
