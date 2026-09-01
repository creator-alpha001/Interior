"use client";

import { useState, useTransition } from "react";
import type { PartnerAgreement, PartnerTerms } from "@repo/types";
import { cn, formatDateTime } from "@repo/ui";
import { signPartnerAgreementAction } from "@/app/actions";

/**
 * Digital signing of the partner agreement.
 *
 * Each clause is ticked separately rather than swept into one "I agree",
 * because these are exactly the clauses vendors later say they never saw —
 * and the typed signature is stored verbatim so consent can be shown clause by
 * clause if it is ever disputed.
 */
export function PartnerAgreementSigner({
  terms,
  agreement,
  defaultName,
}: {
  terms: PartnerTerms;
  agreement: PartnerAgreement | null;
  defaultName: string;
}) {
  const signed = agreement?.status === "signed";
  const [expanded, setExpanded] = useState(!signed);
  const [ticked, setTicked] = useState<string[]>([]);
  const [name, setName] = useState(defaultName);
  const [role, setRole] = useState("");
  const [signature, setSignature] = useState("");
  const [pending, startTransition] = useTransition();

  const allTicked = terms.acknowledgements.every((a) => ticked.includes(a.key));
  const canSign = allTicked && name.trim().length > 2 && signature.trim().length > 2;

  if (signed && agreement) {
    return (
      <div className="rounded-lg border border-positive/25 bg-positive-soft p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-wider text-positive">
              Partner agreement signed
            </p>
            <p className="mt-1.5 text-[14px] text-ink">
              Version {agreement.termsVersion} · signed by {agreement.signatoryName}
              {agreement.signatoryRole ? `, ${agreement.signatoryRole}` : ""}
            </p>
            <p className="mt-0.5 text-[12.5px] text-ink-3">
              {agreement.signedAt ? formatDateTime(agreement.signedAt) : ""} ·{" "}
              {agreement.acknowledgedClauses.length} clauses acknowledged
            </p>
            <p className="mt-2 font-display text-[22px] italic leading-none text-ink">
              {agreement.signatureText}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-md bg-surface px-3 py-1.5 text-[12.5px] text-ink-2 hover:text-ink"
          >
            {expanded ? "Hide terms" : "Read the terms"}
          </button>
        </div>

        {expanded ? <TermsBody terms={terms} /> : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-warning/30 bg-surface">
      <div className="border-b border-line bg-warning-soft px-4 py-3">
        <p className="text-[13px] font-semibold uppercase tracking-wider text-warning">
          Signature required
        </p>
        <h2 className="mt-1 text-[17px] font-semibold text-ink">{terms.title}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{terms.summary}</p>
        <p className="mt-2 text-[12.5px] font-medium text-ink-2">
          You will not be assigned any leads until this is signed.
        </p>
      </div>

      <TermsBody terms={terms} />

      <div className="border-t border-line p-4">
        <p className="text-[13px] font-semibold uppercase tracking-wider text-ink-3">
          Acknowledgements
        </p>
        <p className="mt-1 text-[12.5px] text-ink-4">
          Each of these has to be ticked separately.
        </p>

        <div className="mt-3 space-y-2">
          {terms.acknowledgements.map((clause) => {
            const on = ticked.includes(clause.key);
            return (
              <label
                key={clause.key}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
                  on ? "border-brand bg-brand-soft" : "border-line hover:border-ink-4",
                )}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    setTicked((prev) =>
                      on ? prev.filter((k) => k !== clause.key) : [...prev, clause.key],
                    )
                  }
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand)]"
                />
                <span className="text-[13.5px] leading-relaxed text-ink-2">{clause.label}</span>
              </label>
            );
          })}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-[12px] uppercase tracking-wider text-ink-4">
            Your full name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-paper px-3 py-2 text-[14px] text-ink outline-none focus:border-brand"
            />
          </label>
          <label className="text-[12px] uppercase tracking-wider text-ink-4">
            Your role
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Proprietor, Partner, Director…"
              className="mt-1 w-full rounded-md border border-line bg-paper px-3 py-2 text-[14px] text-ink outline-none placeholder:text-ink-4 focus:border-brand"
            />
          </label>
        </div>

        <label className="mt-3 block text-[12px] uppercase tracking-wider text-ink-4">
          Type your name to sign
          <input
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="Sign here"
            className="mt-1 w-full rounded-md border-2 border-dashed border-line-strong bg-paper px-3 py-3 font-display text-[22px] italic text-ink outline-none placeholder:not-italic placeholder:font-sans placeholder:text-[15px] placeholder:text-ink-4 focus:border-brand"
          />
        </label>

        <p className="mt-2 text-[12px] leading-relaxed text-ink-4">
          Typing your name here is a legally binding signature on version{" "}
          {terms.version} of these terms. The date, time and each clause you ticked are recorded
          with it.
        </p>

        <button
          type="button"
          disabled={pending || !canSign}
          onClick={() =>
            startTransition(async () =>
              signPartnerAgreementAction({
                signatoryName: name.trim(),
                signatoryRole: role.trim() || "Authorised signatory",
                signatureText: signature.trim(),
                acknowledgedClauses: ticked,
              }),
            )
          }
          className="mt-4 h-12 w-full rounded-full bg-brand text-[15px] font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
        >
          {pending
            ? "Signing…"
            : !allTicked
              ? `Tick all ${terms.acknowledgements.length} acknowledgements`
              : "Sign and start receiving leads"}
        </button>
      </div>
    </div>
  );
}

function TermsBody({ terms }: { terms: PartnerTerms }) {
  return (
    <div className="max-h-[420px] overflow-y-auto border-t border-line bg-paper p-4">
      {terms.sections.map((section) => (
        <section key={section.heading} className="mb-4 last:mb-0">
          <h3 className="text-[13.5px] font-semibold text-ink">{section.heading}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{section.body}</p>
        </section>
      ))}
      <p className="mt-4 border-t border-line pt-3 text-[12px] text-ink-4">
        Version {terms.version} · effective {terms.effectiveFrom}
      </p>
    </div>
  );
}
