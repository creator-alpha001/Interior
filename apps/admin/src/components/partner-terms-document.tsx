"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UploadError, uploadFile } from "@repo/data";
import type { PartnerTerms } from "@repo/types";
import { Badge } from "@repo/ui";
import { updatePartnerTermsAction } from "@/app/actions";

/**
 * The standard agreement every vendor prints and signs.
 *
 * One PDF per version of the terms, uploaded here, plus where the signed
 * originals go. The wording of the PDF is a lawyer's job; this only decides
 * which file vendors download.
 */
export function PartnerTermsDocument({ terms }: { terms: PartnerTerms }) {
  const router = useRouter();
  const [instructions, setInstructions] = useState(terms.hardcopyInstructions);
  const [picked, setPicked] = useState<{ id: string; name: string; url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  async function choose(file: File | undefined) {
    if (!file) return;
    setError(undefined);
    setSaved(false);
    setUploading(true);
    try {
      const asset = await uploadFile(file, "agreement_template");
      setPicked({ id: asset.id, name: file.name, url: asset.url });
    } catch (cause) {
      setError(cause instanceof UploadError ? cause.message : "That PDF could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }

  function save() {
    setError(undefined);
    startTransition(async () => {
      const result = await updatePartnerTermsAction({
        documentMediaId: picked?.id,
        previewUrl: picked?.url,
        hardcopyInstructions: instructions.trim(),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setPicked(null);
      setSaved(true);
      router.refresh();
    });
  }

  const dirty = picked !== null || instructions.trim() !== terms.hardcopyInstructions.trim();

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-semibold text-ink">Partner agreement for vendors</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-3">
            Version {terms.version}. Vendors download this, sign it on paper with two witnesses,
            upload photos, and send the original. Nobody is verified without it.
          </p>
        </div>
        {terms.documentUrl ? (
          <Badge tone="positive">PDF uploaded</Badge>
        ) : (
          <Badge tone="warning">No PDF yet</Badge>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {terms.documentUrl ? (
          <a
            href={terms.documentUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-surface-2 px-3 py-1.5 text-[12.5px] text-ink-2 hover:text-brand"
          >
            Open current PDF ↗
          </a>
        ) : null}
        <label className="cursor-pointer rounded-md border border-dashed border-line-strong px-3 py-1.5 text-[12.5px] text-ink-3 hover:border-brand hover:text-brand">
          {uploading ? "Uploading…" : terms.documentUrl ? "Replace with a new PDF" : "Upload the PDF"}
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              void choose(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {picked ? <span className="text-[12.5px] text-ink-2">{picked.name} — save to publish</span> : null}
      </div>

      <label className="mt-3 block text-[11.5px] uppercase tracking-wider text-ink-4">
        Where vendors send the signed original
        <textarea
          value={instructions}
          onChange={(e) => {
            setInstructions(e.target.value);
            setSaved(false);
          }}
          rows={3}
          placeholder="The office address to courier it to, and how to arrange handing it over in person."
          className="mt-1 w-full rounded-md border border-line bg-paper px-3 py-2 text-[13px] normal-case tracking-normal text-ink outline-none focus:border-brand"
        />
      </label>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending || uploading || !dirty}
          onClick={save}
          className="rounded-md bg-brand px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {saved ? <span className="text-[12px] text-positive">Saved. Vendors see this now.</span> : null}
        {error ? (
          <span role="alert" className="text-[12px] text-danger">
            {error}
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-[11.5px] leading-relaxed text-ink-4">
        Have a lawyer review the agreement before publishing it, including whether the original
        should be on e-stamp paper for your state. Replacing the PDF does not change what vendors
        already signed.
      </p>
    </div>
  );
}
