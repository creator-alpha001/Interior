"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { UploadError, uploadFile } from "@repo/data";
import type {
  HardcopyMethod,
  MediaAsset,
  VendorDocumentSlot,
  VendorVerification,
} from "@repo/types";
import { Badge, cn, formatDate } from "@repo/ui";
import {
  issueUploadTicketAction,
  reportHardcopyAction,
  submitSignedCopyAction,
  submitVendorDocumentAction,
} from "@/app/partner/actions";

/**
 * The paperwork between approval and the verified tag.
 *
 * Three things, in the order they happen: the printed agreement signed and
 * photographed, the original sent to us, and the documents identifying the
 * business. Each shows what our team decided and why — "sent back" with nothing
 * attached leaves a vendor no way to fix it.
 */
export function VerificationPanel({ verification }: { verification: VendorVerification }) {
  const verified = verification.verificationStatus === "verified";
  const complete = verification.outstanding.length === 0;

  return (
    <section className="space-y-4">
      <div
        className={cn(
          "rounded-lg border p-4",
          verified ? "border-positive/25 bg-positive-soft" : "border-warning/30 bg-warning-soft",
        )}
      >
        <p
          className={cn(
            "text-[13px] font-semibold uppercase tracking-wider",
            verified ? "text-positive" : "text-warning",
          )}
        >
          {verified ? "Verified" : "Getting verified"}
        </p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
          {verified
            ? complete
              ? "Our team holds your signed agreement and has checked your documents. Customers see the verified badge on your profile."
              : "You are verified. Please send the paperwork below too, so your agreement is on record."
            : "You are approved, but you will not receive leads or the verified badge until our team has your signed agreement, the original copy and your business documents. You are verified automatically as soon as all of them are accepted."}
        </p>
        {complete ? (
          verified ? null : (
            <p className="mt-2 text-[13px] font-medium text-positive">
              Everything is accepted. Refresh the page to see your verified status.
            </p>
          )
        ) : (
          <ul className="mt-3 space-y-1.5">
            {verification.outstanding.map((item) => (
              <li key={item} className="flex gap-2 text-[13px] text-ink-2">
                <span aria-hidden className="text-warning">
                  •
                </span>
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>

      <SignedCopyStep verification={verification} />
      <HardcopyStep verification={verification} />
      <DocumentsStep verification={verification} />
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * 1. The signed copy
 * ------------------------------------------------------------------ */

function SignedCopyStep({ verification }: { verification: VendorVerification }) {
  const router = useRouter();
  const { agreement, terms, signedCopy } = verification;
  const status = agreement?.signedCopyStatus ?? "not_submitted";
  const acceptedOnline = agreement?.status === "signed";

  const [editing, setEditing] = useState(status === "not_submitted" || status === "rejected");
  const [files, setFiles] = useState<MediaAsset[]>([]);
  const [stamp, setStamp] = useState(agreement?.stampCertificateNumber ?? "");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(undefined);
    startTransition(async () => {
      const result = await submitSignedCopyAction({
        files,
        stampCertificateNumber: stamp.trim() || null,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setFiles([]);
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <Step number={1} title="Sign the printed agreement" badge={<ReviewBadge status={status} />}>
      {terms.documentUrl ? (
        <a
          href={terms.documentUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center rounded-full bg-brand px-4 text-[13.5px] font-medium text-white hover:bg-brand-hover"
        >
          Download the agreement (PDF)
        </a>
      ) : (
        <p className="rounded-md bg-surface-2 px-3 py-2 text-[13px] text-ink-3">
          Our team is preparing the agreement document. It will be ready to download here.
        </p>
      )}

      <ol className="mt-3 list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-ink-2">
        <li>Print every page, single-sided.</li>
        <li>
          Sign at the foot of every page, and in full where marked. A company or partnership also
          uses its business stamp.
        </li>
        <li>Two witnesses sign where marked, with their names and addresses.</li>
        <li>Photograph or scan every page, in order, and upload them here.</li>
      </ol>

      {status === "rejected" && agreement?.signedCopyReviewNote ? (
        <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">
          Sent back by our team: {agreement.signedCopyReviewNote}
        </p>
      ) : null}

      {status !== "not_submitted" && signedCopy.length > 0 ? (
        <div className="mt-3">
          <p className="text-[12.5px] text-ink-4">
            {agreement?.signedCopySubmittedAt
              ? `Uploaded ${formatDate(agreement.signedCopySubmittedAt)}`
              : "Uploaded"}
            {agreement?.stampCertificateNumber ? ` · e-stamp ${agreement.stampCertificateNumber}` : ""}
          </p>
          <FileLinks files={signedCopy} />
        </div>
      ) : null}

      {!acceptedOnline ? (
        <p className="mt-3 text-[13px] text-warning">Accept the partner terms above first.</p>
      ) : status === "accepted" ? null : editing ? (
        <div className="mt-4 rounded-md border border-line bg-paper p-3">
          <span className="text-[12px] uppercase tracking-wider text-ink-4">Signed pages</span>
          <FilePicker files={files} onChange={setFiles} max={20} />

          <label className="mt-3 block text-[12px] uppercase tracking-wider text-ink-4">
            E-stamp certificate number
            <input
              value={stamp}
              onChange={(e) => setStamp(e.target.value)}
              placeholder="Leave blank if it is not on stamp paper"
              className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-[14px] normal-case tracking-normal text-ink outline-none placeholder:text-ink-4 focus:border-brand"
            />
          </label>

          <div className="mt-3 flex items-center justify-end gap-2">
            {status === "submitted" ? (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-md px-3 py-1.5 text-[13px] text-ink-3"
              >
                Cancel
              </button>
            ) : null}
            <button
              type="button"
              disabled={pending || files.length === 0}
              onClick={submit}
              className="rounded-full bg-brand px-4 py-1.5 text-[13px] font-medium text-white hover:bg-brand-hover disabled:opacity-50"
            >
              {pending ? "Sending…" : "Send for review"}
            </button>
          </div>
          {error ? (
            <p role="alert" className="mt-2 text-right text-[12.5px] text-danger">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-3 rounded-md bg-surface-2 px-3 py-1.5 text-[12.5px] text-ink-2 hover:text-ink"
        >
          Replace the uploaded pages
        </button>
      )}
    </Step>
  );
}

/* ------------------------------------------------------------------ *
 * 2. The original
 * ------------------------------------------------------------------ */

function HardcopyStep({ verification }: { verification: VendorVerification }) {
  const router = useRouter();
  const { agreement, terms } = verification;
  const status = agreement?.hardcopyStatus ?? "not_sent";

  const [editing, setEditing] = useState(status === "not_sent");
  const [method, setMethod] = useState<HardcopyMethod>(agreement?.hardcopyMethod ?? "courier");
  const [courier, setCourier] = useState(agreement?.hardcopyCourier ?? "");
  const [tracking, setTracking] = useState(agreement?.hardcopyTrackingNumber ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const courierReady = method === "in_person" || (courier.trim() && tracking.trim());

  function submit() {
    setError(undefined);
    startTransition(async () => {
      const result = await reportHardcopyAction({
        method,
        courier: method === "courier" ? courier.trim() : null,
        trackingNumber: method === "courier" ? tracking.trim() : null,
        note: note.trim() || null,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  const badge =
    status === "received" ? (
      <Badge tone="positive">Received</Badge>
    ) : status === "dispatched" ? (
      <Badge tone="brand">
        {agreement?.hardcopyMethod === "in_person" ? "Handover arranged" : "On its way"}
      </Badge>
    ) : (
      <Badge tone="neutral">Not sent</Badge>
    );

  return (
    <Step number={2} title="Send us the signed original" badge={badge}>
      <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-2">
        {terms.hardcopyInstructions ||
          "Courier the signed original to our office, or hand it over in person if you are nearby. Our team will confirm the address."}
      </p>
      <p className="mt-2 text-[12.5px] text-ink-4">
        The photographs let us check it quickly; the original is what we keep on file. Keep a
        photocopy for yourself.
      </p>

      {status === "received" ? (
        <p className="mt-3 text-[13px] font-medium text-positive">
          Received
          {agreement?.hardcopyReceivedAt ? ` on ${formatDate(agreement.hardcopyReceivedAt)}` : ""}.
          Thank you.
        </p>
      ) : null}

      {status === "dispatched" && !editing ? (
        <p className="mt-3 text-[13px] text-ink-2">
          {agreement?.hardcopyMethod === "courier"
            ? `Sent by ${agreement.hardcopyCourier} · tracking ${agreement.hardcopyTrackingNumber}`
            : "You will hand it over in person. Our team will call to arrange a time."}
          {agreement?.hardcopyDispatchedAt ? ` · ${formatDate(agreement.hardcopyDispatchedAt)}` : ""}
          <button type="button" onClick={() => setEditing(true)} className="ml-2 text-brand">
            Change
          </button>
        </p>
      ) : null}

      {status !== "received" && editing ? (
        agreement?.status !== "signed" ? (
          <p className="mt-3 text-[13px] text-warning">Accept the partner terms above first.</p>
        ) : (
          <div className="mt-4 rounded-md border border-line bg-paper p-3">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["courier", "Courier or post"],
                  ["in_person", "Hand over in person"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={method === value}
                  onClick={() => setMethod(value)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-[13px] transition-colors",
                    method === value ? "bg-brand text-white" : "bg-surface-2 text-ink-3 hover:text-ink",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {method === "courier" ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <TextField label="Courier or post office" value={courier} onChange={setCourier} placeholder="DTDC, India Post…" />
                <TextField label="Tracking number" value={tracking} onChange={setTracking} />
              </div>
            ) : null}

            <label className="mt-3 block text-[12px] uppercase tracking-wider text-ink-4">
              Anything we should know
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder={method === "in_person" ? "When you could come by, and a number to call." : "Optional."}
                className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-[13.5px] normal-case tracking-normal outline-none placeholder:text-ink-4 focus:border-brand"
              />
            </label>

            <div className="mt-3 flex items-center justify-end gap-2">
              {status === "dispatched" ? (
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-md px-3 py-1.5 text-[13px] text-ink-3"
                >
                  Cancel
                </button>
              ) : null}
              <button
                type="button"
                disabled={pending || !courierReady}
                onClick={submit}
                className="rounded-full bg-brand px-4 py-1.5 text-[13px] font-medium text-white hover:bg-brand-hover disabled:opacity-50"
              >
                {pending ? "Saving…" : method === "courier" ? "I have sent it" : "Arrange a handover"}
              </button>
            </div>
            {error ? (
              <p role="alert" className="mt-2 text-right text-[12.5px] text-danger">
                {error}
              </p>
            ) : null}
          </div>
        )
      ) : null}
    </Step>
  );
}

/* ------------------------------------------------------------------ *
 * 3. Documents
 * ------------------------------------------------------------------ */

function DocumentsStep({ verification }: { verification: VendorVerification }) {
  const required = verification.documents.filter((d) => d.required);
  const accepted = required.filter((d) => d.document?.status === "accepted").length;

  return (
    <Step
      number={3}
      title="Business documents"
      badge={
        <Badge tone={accepted === required.length ? "positive" : "neutral"}>
          {accepted} of {required.length} accepted
        </Badge>
      }
    >
      <p className="text-[13px] leading-relaxed text-ink-2">
        Clear photos or PDFs, with every corner visible. Only our team sees these.
      </p>
      <ul className="-mx-4 -mb-4 mt-3 divide-y divide-line border-t border-line">
        {verification.documents.map((slot) => (
          <DocumentRow key={slot.kind} slot={slot} />
        ))}
      </ul>
    </Step>
  );
}

function DocumentRow({ slot }: { slot: VendorDocumentSlot }) {
  const router = useRouter();
  const status = slot.document?.status ?? "not_submitted";

  const [editing, setEditing] = useState(false);
  const [number, setNumber] = useState(
    slot.document?.status === "rejected" ? (slot.document.documentNumber ?? "") : "",
  );
  const [files, setFiles] = useState<MediaAsset[]>([]);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(undefined);
    startTransition(async () => {
      const result = await submitVendorDocumentAction({
        kind: slot.kind,
        documentNumber: slot.numberLabel ? number.trim() || null : null,
        files,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setFiles([]);
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-medium text-ink">{slot.label}</span>
            {slot.required ? null : <Badge tone="neutral">Optional</Badge>}
          </div>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-3">{slot.description}</p>
        </div>
        <ReviewBadge status={status} />
      </div>

      {slot.document ? (
        <div className="mt-1.5">
          <p className="text-[12.5px] text-ink-4">
            {slot.document.documentNumber ? `${slot.numberLabel}: ${slot.document.documentNumber} · ` : ""}
            Sent {formatDate(slot.document.submittedAt)}
          </p>
          <FileLinks files={slot.files} />
        </div>
      ) : null}

      {status === "rejected" && slot.document?.reviewNote ? (
        <p className="mt-2 rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">
          Sent back by our team: {slot.document.reviewNote}
        </p>
      ) : null}

      {status === "accepted" ? null : editing ? (
        <div className="mt-3 rounded-md border border-line bg-paper p-3">
          {slot.numberLabel ? (
            <TextField label={slot.numberLabel} value={number} onChange={setNumber} />
          ) : null}
          <div className="mt-2">
            <FilePicker files={files} onChange={setFiles} max={6} />
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md px-3 py-1.5 text-[13px] text-ink-3"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending || files.length === 0}
              onClick={submit}
              className="rounded-full bg-brand px-4 py-1.5 text-[13px] font-medium text-white hover:bg-brand-hover disabled:opacity-50"
            >
              {pending ? "Sending…" : "Send for review"}
            </button>
          </div>
          {error ? (
            <p role="alert" className="mt-2 text-right text-[12.5px] text-danger">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-2 rounded-md bg-surface-2 px-3 py-1.5 text-[12.5px] text-ink-2 hover:text-ink"
        >
          {status === "not_submitted" ? "Upload" : status === "rejected" ? "Upload again" : "Replace"}
        </button>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ *
 * Pieces
 * ------------------------------------------------------------------ */

const REVIEW = {
  not_submitted: { label: "Not sent", tone: "neutral" },
  submitted: { label: "With our team", tone: "brand" },
  accepted: { label: "Accepted", tone: "positive" },
  rejected: { label: "Sent back", tone: "danger" },
} as const;

function ReviewBadge({ status }: { status: keyof typeof REVIEW }) {
  return <Badge tone={REVIEW[status].tone}>{REVIEW[status].label}</Badge>;
}

function Step({
  number,
  title,
  badge,
  children,
}: {
  number: number;
  title: string;
  badge: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h3 className="text-[15px] font-semibold text-ink">
          <span className="mr-2 text-ink-4">{number}.</span>
          {title}
        </h3>
        {badge}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-[12px] uppercase tracking-wider text-ink-4">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-[14px] normal-case tracking-normal text-ink outline-none placeholder:text-ink-4 focus:border-brand"
      />
    </label>
  );
}

function FileLinks({ files }: { files: MediaAsset[] }) {
  if (files.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {files.map((file, index) => (
        <li key={file.id}>
          <a
            href={file.url}
            target="_blank"
            rel="noreferrer"
            className="inline-block rounded-md bg-surface-2 px-2.5 py-1 text-[12.5px] text-ink-2 hover:text-brand"
          >
            {file.caption ?? `Page ${index + 1}`}
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * Uploads as files are picked, so a bad photo fails at once rather than after
 * the vendor has filled in the rest of the form.
 */
function FilePicker({
  files,
  onChange,
  max,
}: {
  files: MediaAsset[];
  onChange: (next: MediaAsset[]) => void;
  max: number;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(chosen: File[]) {
    setError(null);
    setUploading(true);
    const next = [...files];
    try {
      for (const file of chosen) {
        next.push(
          await uploadFile(file, "vendor_document", { requestTicket: issueUploadTicketAction }),
        );
        onChange([...next]);
      }
    } catch (cause) {
      setError(cause instanceof UploadError ? cause.message : "That file could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-1.5">
      {files.length > 0 ? (
        <ul className="mb-2 space-y-1">
          {files.map((file, index) => (
            <li
              key={file.id}
              className="flex items-center justify-between gap-2 rounded-md bg-surface px-2.5 py-1.5 text-[12.5px] text-ink-2"
            >
              <span className="truncate">
                {index + 1}. {file.caption ?? "File"}
              </span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                aria-label={`Remove ${file.caption ?? "file"}`}
                className="text-ink-4 hover:text-danger"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {files.length < max ? (
        <label
          className={cn(
            "inline-flex cursor-pointer items-center rounded-md border border-dashed border-line-strong bg-surface px-3 py-2 text-[12.5px] text-ink-3 hover:border-brand hover:text-brand",
            uploading && "pointer-events-none opacity-60",
          )}
        >
          {uploading ? "Uploading…" : files.length === 0 ? "+ Add photos or a PDF" : "+ Add more"}
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              const chosen = Array.from(e.target.files ?? []).slice(0, max - files.length);
              e.target.value = "";
              void add(chosen);
            }}
          />
        </label>
      ) : null}

      {error ? <p className="mt-1.5 text-[12px] text-danger">{error}</p> : null}
    </div>
  );
}
