"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { UploadError, uploadFile } from "@repo/data";
import type {
  City,
  Domain,
  MediaAsset,
  PortfolioItem,
  VendorAchievement,
  VendorAchievementKind,
} from "@repo/types";
import { Badge, Media, cn } from "@repo/ui";
import {
  addAchievementAction,
  addPortfolioItemAction,
  issueUploadTicketAction,
  removeAchievementAction,
  removePortfolioItemAction,
} from "@/app/partner/actions";
import { RichText } from "./rich-text";

/**
 * A vendor's work and achievements, as they manage them.
 *
 * **Posting publishes.** This used to hold everything for approval, so a
 * vendor photographed a finished kitchen, posted it, and looked at an empty
 * profile — which reads as a broken feature rather than a queue. Our team can
 * still take something down, and when they do the reason is on the card, so
 * the vendor can fix it or remove it.
 */

const MODERATION = {
  // Only reachable for items posted before publishing became immediate.
  pending: { label: "Waiting on our team", tone: "warning" },
  approved: { label: "Live on your profile", tone: "positive" },
  rejected: { label: "Taken down", tone: "danger" },
} as const;

export const ACHIEVEMENT_KINDS: Array<{ value: VendorAchievementKind; label: string }> = [
  { value: "award", label: "Award" },
  { value: "certification", label: "Certification" },
  { value: "membership", label: "Membership" },
  { value: "press", label: "Press or media" },
  { value: "other", label: "Other" },
];

/* ------------------------------------------------------------------ *
 * Work
 * ------------------------------------------------------------------ */

export function PortfolioManager({
  items,
  trades,
  cities,
}: {
  items: PortfolioItem[];
  /** Only trades the vendor is approved for can carry posted work. */
  trades: Domain[];
  cities: City[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [domainId, setDomainId] = useState(trades[0]?.id ?? "");
  const [cityId, setCityId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [highlights, setHighlights] = useState<string[]>([""]);
  const [details, setDetails] = useState("");
  const [photos, setPhotos] = useState<MediaAsset[]>([]);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(0);
  const [pending, startTransition] = useTransition();

  /**
   * `again` keeps the form open with the trade and city still chosen.
   *
   * A vendor posting their work posts *all* of it in one sitting, and closing
   * the form after each one made that ten clicks longer than it needed to be.
   */
  function submit(again: boolean) {
    setError(undefined);
    startTransition(async () => {
      const result = await addPortfolioItemAction({
        domainId,
        cityId: cityId || null,
        title: title.trim(),
        description: description.trim(),
        highlights: highlights.map((line) => line.trim()).filter(Boolean),
        details,
        media: photos,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setTitle("");
      setDescription("");
      setHighlights([""]);
      setDetails("");
      setPhotos([]);
      setSaved((n) => n + 1);
      setOpen(again);
      router.refresh();
    });
  }

  const tradeName = (id: string) => trades.find((t) => t.id === id)?.name ?? "";

  return (
    <Section
      title={`Your work (${items.length})`}
      action={
        trades.length > 0 && !open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full bg-brand px-3.5 py-1.5 text-[12.5px] font-medium text-white hover:bg-brand-hover"
          >
            + Add work
          </button>
        ) : null
      }
    >
      {trades.length === 0 ? (
        <p className="mb-3 text-[13px] text-ink-3">
          You can post work once our team has approved you for a trade.
        </p>
      ) : null}

      {saved > 0 ? (
        <p className="mb-3 rounded bg-positive-soft px-2.5 py-1.5 text-[12.5px] text-positive">
          {saved === 1 ? "Posted, and live on your profile." : `${saved} posted, and live on your profile.`}
        </p>
      ) : null}

      {open ? (
        <div className="mb-4 rounded-md border border-line bg-paper p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Trade">
              <select
                value={domainId}
                onChange={(e) => setDomainId(e.target.value)}
                className={inputClass}
              >
                {trades.map((trade) => (
                  <option key={trade.id} value={trade.id}>
                    {trade.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="District (optional)">
              <select value={cityId} onChange={(e) => setCityId(e.target.value)} className={inputClass}>
                <option value="">Not specified</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Title" className="mt-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="3BHK modular kitchen, Gomti Nagar"
              className={inputClass}
            />
          </Field>
          <Field label="One-line summary" className="mt-3">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Full modular kitchen in birch ply, finished in three weeks."
              className={inputClass}
            />
          </Field>

          <div className="mt-3">
            <span className="text-[12px] uppercase tracking-wider text-ink-4">
              Highlights
            </span>
            <HighlightFields value={highlights} onChange={setHighlights} />
            <p className="mt-1 text-[11.5px] text-ink-4">
              The short lines a customer skims: materials, size, how long it took.
            </p>
          </div>

          <Field label="Details" className="mt-3">
            <RichText
              value={details}
              onChange={setDetails}
              placeholder="What the job involved, what you used, anything that made it hard."
            />
          </Field>
          <div className="mt-3">
            <span className="text-[12px] uppercase tracking-wider text-ink-4">Photos</span>
            <PhotoPicker files={photos} onChange={setPhotos} max={10} />
            <p className="mt-1 text-[11.5px] text-ink-4">
              Only photos of work you did yourself. The first one is the cover.
            </p>
          </div>
          <FormFooter
            pending={pending}
            disabled={!domainId || title.trim().length === 0 || photos.length === 0}
            submitLabel="Publish"
            onCancel={() => setOpen(false)}
            onSubmit={() => submit(false)}
            onSubmitAndAdd={() => submit(true)}
            addLabel="Save and add more"
            error={error}
          />
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-ink-3">
          Nothing posted yet. Photos of completed jobs are what customers look at first.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <figure key={item.id} className="overflow-hidden rounded-md border border-line bg-surface">
              <div className="aspect-[4/3]">
                <Media src={item.media[0]?.url ?? "ph:default:x"} alt={item.title} rounded={false} />
              </div>
              <figcaption className="p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={MODERATION[item.moderationStatus].tone}>
                    {MODERATION[item.moderationStatus].label}
                  </Badge>
                  {tradeName(item.domainId) ? <Badge tone="neutral">{tradeName(item.domainId)}</Badge> : null}
                </div>
                <p className="mt-2 text-[13px] font-medium text-ink">{item.title}</p>
                {item.description ? (
                  <p className="mt-0.5 line-clamp-2 text-[12px] text-ink-3">{item.description}</p>
                ) : null}
                {item.moderationStatus === "rejected" && item.reviewNote ? (
                  <p className="mt-2 rounded bg-danger-soft px-2 py-1.5 text-[12px] text-danger">
                    From our team: {item.reviewNote}
                  </p>
                ) : null}
                <RemoveButton
                  label="Remove"
                  onRemove={() => removePortfolioItemAction(item.id)}
                  onDone={() => router.refresh()}
                />
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <p className="mt-3 text-[11.5px] text-ink-4">
        Work appears on your public profile as soon as you post it. Our team can
        take something down if it is not yours, and will tell you why.
      </p>
    </Section>
  );
}

/* ------------------------------------------------------------------ *
 * Achievements
 * ------------------------------------------------------------------ */

export function AchievementsManager({ items }: { items: VendorAchievement[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<VendorAchievementKind>("award");
  const [title, setTitle] = useState("");
  const [issuer, setIssuer] = useState("");
  const [year, setYear] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<MediaAsset[]>([]);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit(again: boolean) {
    setError(undefined);
    startTransition(async () => {
      const result = await addAchievementAction({
        kind,
        title: title.trim(),
        issuer: issuer.trim(),
        year: year ? Number(year) : null,
        description: description.trim(),
        media: photo,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setTitle("");
      setIssuer("");
      setYear("");
      setDescription("");
      setPhoto([]);
      setOpen(again);
      router.refresh();
    });
  }

  const kindLabel = (value: VendorAchievementKind) =>
    ACHIEVEMENT_KINDS.find((k) => k.value === value)?.label ?? value;

  return (
    <Section
      title={`Achievements (${items.length})`}
      action={
        !open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full bg-brand px-3.5 py-1.5 text-[12.5px] font-medium text-white hover:bg-brand-hover"
          >
            + Add achievement
          </button>
        ) : null
      }
    >
      {open ? (
        <div className="mb-4 rounded-md border border-line bg-paper p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Type">
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as VendorAchievementKind)}
                className={inputClass}
              >
                {ACHIEVEMENT_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Awarded or issued by">
              <input
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                placeholder="IIID, a manufacturer, a newspaper…"
                className={inputClass}
              />
            </Field>
            <Field label="Year">
              <input
                value={year}
                onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                placeholder="2025"
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Title" className="mt-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Best Residential Interior, Lucknow 2025"
              className={inputClass}
            />
          </Field>
          <Field label="Details (optional)" className="mt-3">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={inputClass}
            />
          </Field>
          <div className="mt-3">
            <span className="text-[12px] uppercase tracking-wider text-ink-4">
              Photo of the certificate or award (optional)
            </span>
            <PhotoPicker files={photo} onChange={setPhoto} max={1} />
          </div>
          <FormFooter
            pending={pending}
            disabled={title.trim().length === 0 || (year !== "" && year.length !== 4)}
            submitLabel="Publish"
            onCancel={() => setOpen(false)}
            onSubmit={() => submit(false)}
            onSubmitAndAdd={() => submit(true)}
            addLabel="Save and add more"
            error={error}
          />
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-ink-3">
          Awards, certifications and memberships you add appear on your public profile straight away.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <li key={item.id} className="flex gap-3 py-3">
              {item.media[0] ? (
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-line">
                  <Media src={item.media[0].url} alt={item.title} rounded={false} />
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={MODERATION[item.moderationStatus].tone}>
                    {MODERATION[item.moderationStatus].label}
                  </Badge>
                  <Badge tone="neutral">{kindLabel(item.kind)}</Badge>
                </div>
                <p className="mt-1.5 text-[13.5px] font-medium text-ink">{item.title}</p>
                <p className="text-[12px] text-ink-3">
                  {[item.issuer, item.year].filter(Boolean).join(" · ")}
                </p>
                {item.moderationStatus === "rejected" && item.reviewNote ? (
                  <p className="mt-1.5 rounded bg-danger-soft px-2 py-1.5 text-[12px] text-danger">
                    From our team: {item.reviewNote}
                  </p>
                ) : null}
                <RemoveButton
                  label="Remove"
                  onRemove={() => removeAchievementAction(item.id)}
                  onDone={() => router.refresh()}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ *
 * Pieces
 * ------------------------------------------------------------------ */

const inputClass =
  "mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-[13.5px] normal-case tracking-normal text-ink outline-none placeholder:text-ink-4 focus:border-brand";

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <h2 className="text-[12px] font-semibold uppercase tracking-wider text-ink-3">{title}</h2>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block text-[12px] uppercase tracking-wider text-ink-4", className)}>
      {label}
      {children}
    </label>
  );
}

function FormFooter({
  pending,
  disabled,
  submitLabel,
  onCancel,
  onSubmit,
  onSubmitAndAdd,
  addLabel,
  error,
}: {
  pending: boolean;
  disabled: boolean;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: () => void;
  /** Saves and leaves the form open, for somebody posting a batch. */
  onSubmitAndAdd?: () => void;
  addLabel?: string;
  error?: string;
}) {
  return (
    <>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md px-3 py-1.5 text-[13px] text-ink-3">
          Cancel
        </button>
        {onSubmitAndAdd ? (
          <button
            type="button"
            disabled={pending || disabled}
            onClick={onSubmitAndAdd}
            className="rounded-full border border-line px-4 py-1.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-2 disabled:opacity-50"
          >
            {addLabel ?? "Save and add more"}
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending || disabled}
          onClick={onSubmit}
          className="rounded-full bg-brand px-4 py-1.5 text-[13px] font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-right text-[12.5px] text-danger">
          {error}
        </p>
      ) : null}
    </>
  );
}

/**
 * The short lines under a job, as a growing list of single-line fields.
 *
 * A textarea split on newlines would be fewer components and the wrong shape:
 * these are separate values, stored separately and rendered as separate lines,
 * and a vendor who pastes a paragraph into a textarea has no way to tell that
 * it will be cut up.
 */
function HighlightFields({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const MAX = 6;

  function set(index: number, text: string) {
    const next = [...value];
    next[index] = text;
    // A last line with something in it grows the list, so there is always an
    // empty one to type in and never a button to press first.
    if (index === value.length - 1 && text.trim().length > 0 && value.length < MAX) {
      next.push("");
    }
    onChange(next);
  }

  return (
    <div className="mt-1 grid gap-1.5">
      {value.map((line, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="text-ink-4">
            •
          </span>
          <input
            value={line}
            onChange={(e) => set(index, e.target.value)}
            placeholder={index === 0 ? "Birch ply carcass, matte laminate" : ""}
            aria-label={`Highlight ${index + 1}`}
            className={inputClass}
          />
          {value.length > 1 ? (
            <button
              type="button"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              aria-label={`Remove highlight ${index + 1}`}
              className="grid h-7 w-7 shrink-0 place-items-center rounded text-ink-4 hover:bg-surface-2 hover:text-ink"
            >
              ✕
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Two presses, so a thumb on a phone cannot take down a portfolio by accident. */
function RemoveButton({
  label,
  onRemove,
  onDone,
}: {
  label: string;
  onRemove: () => Promise<{ error?: string }>;
  onDone: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-2">
      {confirming ? (
        <span className="flex items-center gap-2 text-[12px]">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await onRemove();
                if (result.error) {
                  setError(result.error);
                  return;
                }
                onDone();
              })
            }
            className="font-medium text-danger disabled:opacity-50"
          >
            {pending ? "Removing…" : "Yes, remove"}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="text-ink-3">
            Keep
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="text-[12px] text-ink-4 hover:text-danger">
          {label}
        </button>
      )}
      {error ? <p className="mt-1 text-[12px] text-danger">{error}</p> : null}
    </div>
  );
}

function PhotoPicker({
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
        next.push(await uploadFile(file, "portfolio_item", { requestTicket: issueUploadTicketAction }));
        onChange([...next]);
      }
    } catch (cause) {
      setError(cause instanceof UploadError ? cause.message : "That photo could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-1.5">
      <div className="flex flex-wrap gap-2">
        {files.map((file, index) => (
          <div key={file.id} className="relative h-20 w-20 overflow-hidden rounded-md border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={file.url} alt={file.caption ?? "Photo"} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(files.filter((_, i) => i !== index))}
              aria-label={`Remove ${file.caption ?? "photo"}`}
              className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-[11px] text-white"
            >
              ×
            </button>
          </div>
        ))}
        {files.length < max ? (
          <label
            className={cn(
              "grid h-20 w-20 cursor-pointer place-items-center rounded-md border border-dashed border-line-strong bg-surface text-center text-[11.5px] text-ink-3 hover:border-brand hover:text-brand",
              uploading && "pointer-events-none opacity-60",
            )}
          >
            <span>{uploading ? "Uploading…" : "+ Photo"}</span>
            <input
              type="file"
              accept="image/*"
              multiple={max > 1}
              className="hidden"
              onChange={(e) => {
                const chosen = Array.from(e.target.files ?? []).slice(0, max - files.length);
                e.target.value = "";
                void add(chosen);
              }}
            />
          </label>
        ) : null}
      </div>
      {error ? <p className="mt-1.5 text-[12px] text-danger">{error}</p> : null}
    </div>
  );
}
