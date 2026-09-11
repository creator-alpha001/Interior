"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type {
  HardcopyMethod,
  MediaAsset,
  VendorDocumentSlot,
  VendorVerification,
} from "@repo/types";
import { Badge, formatDate, formatDateTime } from "@repo/ui";
import {
  receiveHardcopyAction,
  reviewSignedCopyAction,
  reviewVendorDocumentAction,
} from "@/app/actions";

type Result = Promise<{ error?: string }>;

/**
 * The reviewer's side of verification.
 *
 * Everything a vendor sent, each with its own decision, and the list of what is
 * still missing at the top — the same list the "Verified" button is refused on,
 * so nobody has to work out why it will not press.
 */
export function VendorVerificationReview({
  professionalId,
  verification,
}: {
  professionalId: string;
  verification: VendorVerification;
}) {
  const { agreement, outstanding } = verification;
  const verified = verification.verificationStatus === "verified";

  return (
    <div className="rounded-lg border border-line bg-surface">
      <div className="border-b border-line px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[14px] font-semibold text-ink">Verification paperwork</h2>
          {verification.canBeVerified ? (
            <Badge tone="positive">Complete</Badge>
          ) : (
            <Badge tone="warning">{outstanding.length} outstanding</Badge>
          )}
        </div>

        {verification.canBeVerified ? (
          <p className="mt-1 text-[12.5px] text-ink-3">
            {verified
              ? "Verified, with the signed original and documents on record."
              : "Everything is accepted and the original is in. They can now be marked verified."}
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {outstanding.map((item) => (
              <li key={item} className="text-[12.5px] text-ink-2">
                · {item}
              </li>
            ))}
          </ul>
        )}

        {verified && !verification.canBeVerified ? (
          <p className="mt-2 text-[12px] text-clay">
            Verified before signed paperwork was required. Chase the items above, or move them to
            pending — which takes them out of every lead pool.
          </p>
        ) : null}
      </div>

      <div className="divide-y divide-line">
        <Section title="Terms accepted online">
          {agreement?.status === "signed" ? (
            <p className="text-[13px] text-ink-2">
              Version {agreement.termsVersion} · {agreement.signatoryName}
              {agreement.signatoryRole ? `, ${agreement.signatoryRole}` : ""}
              {agreement.signedAt ? ` · ${formatDateTime(agreement.signedAt)}` : ""}
            </p>
          ) : (
            <p className="text-[13px] text-ink-3">Not accepted yet.</p>
          )}
        </Section>

        <Section
          title="Signed agreement copy"
          badge={<ReviewBadge status={agreement?.signedCopyStatus ?? "not_submitted"} />}
        >
          {verification.signedCopy.length > 0 ? (
            <>
              <p className="text-[12.5px] text-ink-4">
                {agreement?.signedCopySubmittedAt
                  ? `Uploaded ${formatDateTime(agreement.signedCopySubmittedAt)}`
                  : "Uploaded"}
                {agreement?.stampCertificateNumber
                  ? ` · e-stamp ${agreement.stampCertificateNumber}`
                  : " · no e-stamp number given"}
              </p>
              <FileLinks files={verification.signedCopy} />
            </>
          ) : (
            <p className="text-[13px] text-ink-3">Nothing uploaded yet.</p>
          )}
          {agreement?.signedCopyReviewNote ? (
            <p className="mt-2 text-[12.5px] text-ink-3">Note to vendor: {agreement.signedCopyReviewNote}</p>
          ) : null}
          {agreement?.signedCopyStatus === "submitted" ? (
            <Decide
              what="the signed copy"
              hint="Check every page is signed, both witnesses are filled in, and the business name matches."
              onDecide={(decision, note) => reviewSignedCopyAction(professionalId, decision, note)}
            />
          ) : null}
        </Section>

        <HardcopySection professionalId={professionalId} verification={verification} />

        <Section title="Business documents">
          <ul className="-mx-4 -mb-3 divide-y divide-line border-t border-line">
            {verification.documents.map((slot) => (
              <DocumentReview key={slot.kind} professionalId={professionalId} slot={slot} />
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}

function HardcopySection({
  professionalId,
  verification,
}: {
  professionalId: string;
  verification: VendorVerification;
}) {
  const router = useRouter();
  const { agreement } = verification;
  const status = agreement?.hardcopyStatus ?? "not_sent";

  const [method, setMethod] = useState<HardcopyMethod>(agreement?.hardcopyMethod ?? "courier");
  const [receivedOn, setReceivedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function receive() {
    setError(undefined);
    startTransition(async () => {
      const result = await receiveHardcopyAction(professionalId, {
        method,
        receivedOn,
        note: note.trim() || null,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setNote("");
      router.refresh();
    });
  }

  return (
    <Section
      title="Signed original"
      badge={
        status === "received" ? (
          <Badge tone="positive">Received</Badge>
        ) : status === "dispatched" ? (
          <Badge tone="brand">{agreement?.hardcopyMethod === "in_person" ? "Handover arranged" : "Dispatched"}</Badge>
        ) : (
          <Badge tone="neutral">Not sent</Badge>
        )
      }
    >
      {status === "received" ? (
        <p className="text-[13px] text-ink-2">
          Received {agreement?.hardcopyReceivedAt ? formatDate(agreement.hardcopyReceivedAt) : ""}
          {agreement?.hardcopyMethod === "in_person" ? " in person" : " by courier or post"}.
          File it with the vendor&apos;s records.
        </p>
      ) : status === "dispatched" ? (
        <p className="text-[13px] text-ink-2">
          {agreement?.hardcopyMethod === "courier"
            ? `Sent by ${agreement.hardcopyCourier} · tracking ${agreement.hardcopyTrackingNumber}`
            : "The vendor will hand it over in person — call them to arrange a time."}
          {agreement?.hardcopyDispatchedAt ? ` · ${formatDate(agreement.hardcopyDispatchedAt)}` : ""}
        </p>
      ) : (
        <p className="text-[13px] text-ink-3">The vendor has not told us it is on its way.</p>
      )}
      {agreement?.hardcopyNote ? (
        <p className="mt-1 text-[12.5px] text-ink-3">Note: {agreement.hardcopyNote}</p>
      ) : null}

      {agreement && status !== "received" ? (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-line bg-paper p-3">
          <label className="text-[11.5px] uppercase tracking-wider text-ink-4">
            How it arrived
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as HardcopyMethod)}
              className="mt-1 block rounded-md border border-line bg-surface px-2 py-1.5 text-[12.5px] normal-case tracking-normal text-ink"
            >
              <option value="courier">Courier or post</option>
              <option value="in_person">In person</option>
            </select>
          </label>
          <label className="text-[11.5px] uppercase tracking-wider text-ink-4">
            Received on
            <input
              type="date"
              value={receivedOn}
              onChange={(e) => setReceivedOn(e.target.value)}
              className="mt-1 block rounded-md border border-line bg-surface px-2 py-1 text-[12.5px] text-ink"
            />
          </label>
          <label className="min-w-[180px] flex-1 text-[11.5px] uppercase tracking-wider text-ink-4">
            Note
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Where it is filed, who received it"
              className="mt-1 block w-full rounded-md border border-line bg-surface px-2 py-1.5 text-[12.5px] normal-case tracking-normal text-ink outline-none focus:border-brand"
            />
          </label>
          <button
            type="button"
            disabled={pending || !receivedOn}
            onClick={receive}
            className="rounded-md bg-brand px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {pending ? "Saving…" : "Mark original received"}
          </button>
          {error ? (
            <p role="alert" className="w-full text-[12px] text-danger">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </Section>
  );
}

function DocumentReview({
  professionalId,
  slot,
}: {
  professionalId: string;
  slot: VendorDocumentSlot;
}) {
  const document = slot.document;

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium text-ink">{slot.label}</span>
          {slot.required ? null : <Badge tone="neutral">Optional</Badge>}
        </div>
        <ReviewBadge status={document?.status ?? "not_submitted"} />
      </div>

      {document ? (
        <>
          <p className="mt-1 text-[12.5px] text-ink-4">
            {document.documentNumber ? `${slot.numberLabel}: ${document.documentNumber} · ` : ""}
            Sent {formatDateTime(document.submittedAt)}
          </p>
          <FileLinks files={slot.files} />
          {document.reviewNote ? (
            <p className="mt-1.5 text-[12.5px] text-ink-3">Note to vendor: {document.reviewNote}</p>
          ) : null}
          {document.status === "submitted" ? (
            <Decide
              what={slot.label.toLowerCase()}
              hint="Check the name and number match the business, and nothing is cropped or edited."
              onDecide={(decision, note) =>
                reviewVendorDocumentAction(professionalId, document.id, decision, note)
              }
            />
          ) : null}
        </>
      ) : (
        <p className="mt-1 text-[12.5px] text-ink-4">Not sent.</p>
      )}
    </li>
  );
}

/** Accept in one press; reject only with a reason the vendor will read. */
function Decide({
  what,
  hint,
  onDecide,
}: {
  what: string;
  hint: string;
  onDecide: (decision: "accept" | "reject", note: string | null) => Result;
}) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function run(decision: "accept" | "reject") {
    setError(undefined);
    startTransition(async () => {
      const result = await onDecide(decision, decision === "reject" ? note.trim() : null);
      if (result.error) {
        setError(result.error);
        return;
      }
      setRejecting(false);
      setNote("");
      router.refresh();
    });
  }

  return (
    <div className="mt-2.5">
      <p className="text-[12px] text-ink-4">{hint}</p>
      {rejecting ? (
        <div className="mt-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            autoFocus
            placeholder={`What is wrong with ${what}? The vendor reads this.`}
            className="w-full rounded-md border border-line bg-paper px-3 py-2 text-[12.5px] outline-none focus:border-brand"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending || note.trim().length < 10}
              onClick={() => run("reject")}
              className="rounded-md bg-danger-soft px-3 py-1.5 text-[12.5px] font-medium text-danger hover:brightness-95 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Send back"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setRejecting(false)}
              className="rounded-md px-2.5 py-1.5 text-[12.5px] text-ink-3 hover:text-ink"
            >
              Cancel
            </button>
            {note.trim().length < 10 ? (
              <span className="text-[12px] text-ink-4">A sentence at least.</span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => run("accept")}
            className="rounded-md bg-brand px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {pending ? "Saving…" : "Accept"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setRejecting(true)}
            className="rounded-md bg-surface-2 px-3 py-1.5 text-[12.5px] text-ink-2 hover:text-ink disabled:opacity-50"
          >
            Send back
          </button>
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-[12px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const REVIEW = {
  not_submitted: { label: "Not sent", tone: "neutral" },
  submitted: { label: "Waiting for review", tone: "warning" },
  accepted: { label: "Accepted", tone: "positive" },
  rejected: { label: "Sent back", tone: "danger" },
} as const;

function ReviewBadge({ status }: { status: keyof typeof REVIEW }) {
  return <Badge tone={REVIEW[status].tone}>{REVIEW[status].label}</Badge>;
}

function Section({ title, badge, children }: { title: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <div className="px-4 py-3">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[12px] font-semibold uppercase tracking-wider text-ink-3">{title}</h3>
        {badge}
      </div>
      {children}
    </div>
  );
}

function FileLinks({ files }: { files: MediaAsset[] }) {
  if (files.length === 0) return null;
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1.5">
      {files.map((file, index) => (
        <li key={file.id}>
          <a
            href={file.url}
            target="_blank"
            rel="noreferrer"
            className="inline-block rounded-md bg-surface-2 px-2.5 py-1 text-[12px] text-ink-2 hover:text-brand"
          >
            {file.caption ?? `File ${index + 1}`} ↗
          </a>
        </li>
      ))}
    </ul>
  );
}
