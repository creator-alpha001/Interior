"use client";

import { useState, useTransition } from "react";
import type {
  City,
  Domain,
  MaterialSource,
  MediaAsset,
  SiteAccessibilityTag,
  Urgency,
} from "@repo/types";
import { UploadError, formatRupeesShort, maxFilesFor, uploadFile } from "@repo/data";
import { createRequirementAction } from "@/app/actions";
import { Badge, Button, cn } from "@repo/ui";

interface PrefillItem {
  domainId: string;
  productId?: string;
  packageId?: string;
  itemName: string;
  quantity: number;
  selectedOptions: Record<string, string>;
  indicativePrice: number;
  label: string;
  sublabel: string;
}

export interface RequestedProfessional {
  id: string;
  name: string;
  companyName: string;
  domainIds: string[];
  domainNames: string[];
}

export interface RequirementFormProps {
  domains: Domain[];
  cities: City[];
  prefill: { domainId?: string; item: PrefillItem | null } | null;
  /** Set when the client arrived from a professional's profile asking for them. */
  requestedProfessional?: RequestedProfessional | null;
}

const urgencies: Array<{ value: Urgency; label: string; hint: string }> = [
  { value: "immediate", label: "Immediate", hint: "Ready to start now" },
  { value: "within_month", label: "Within a month", hint: "Planning ahead" },
  { value: "exploring", label: "Just exploring", hint: "Gathering prices" },
];

const materialOptions: Array<{ value: MaterialSource; label: string; hint: string }> = [
  { value: "vendor_supplied", label: "Vendor supplies", hint: "Quote covers materials and labour" },
  { value: "customer_supplied", label: "I'll supply my own", hint: "Quote is labour only" },
  { value: "undecided", label: "Not sure yet", hint: "We'll work it out on the call" },
];

const accessTags: Array<{ value: SiteAccessibilityTag; label: string }> = [
  { value: "parking", label: "Parking available" },
  { value: "lift", label: "Lift available" },
  { value: "timing_restriction", label: "Society timing restriction" },
  { value: "other", label: "Something else" },
];

const budgetStops = [50_000, 150_000, 300_000, 600_000, 1_000_000, 2_000_000, 5_000_000];

export function RequirementForm({
  domains,
  cities,
  prefill,
  requestedProfessional = null,
}: RequirementFormProps) {
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();

  const [domainIds, setDomainIds] = useState<string[]>(
    prefill?.domainId
      ? [prefill.domainId]
      : requestedProfessional?.domainIds.length === 1
        ? [requestedProfessional.domainIds[0]]
        : [],
  );
  const [description, setDescription] = useState(
    prefill?.item ? `Interested in: ${prefill.item.itemName}. ` : "",
  );
  const [cityId, setCityId] = useState(cities[0]?.id ?? "");
  const [urgency, setUrgency] = useState<Urgency>("within_month");
  const [materialSource, setMaterialSource] = useState<Record<string, MaterialSource>>({});
  const [tags, setTags] = useState<SiteAccessibilityTag[]>([]);
  const [budgetIndex, setBudgetIndex] = useState(2);
  const [budgetSet, setBudgetSet] = useState(false);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [photos, setPhotos] = useState<MediaAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Photos go up as they are chosen rather than being held as raw files until
  // submit, so a too-large photo is rejected while the customer is still on
  // that step instead of after they have filled in everything else.
  async function addPhotos(files: File[]) {
    setUploadError(null);
    setUploading(true);
    try {
      for (const file of files) {
        const asset = await uploadFile(file, "requirement_photo");
        setPhotos((prev) => [...prev, asset]);
      }
    } catch (error) {
      setUploadError(
        error instanceof UploadError ? error.message : "That photo could not be uploaded.",
      );
    } finally {
      setUploading(false);
    }
  }

  const selectedDomains = domains.filter((d) => domainIds.includes(d.id));

  const steps = [
    { label: "Service" },
    { label: "Details" },
    { label: "Materials" },
    { label: "Contact" },
  ];

  const canContinue = [
    domainIds.length > 0,
    description.trim().length >= 5 && Boolean(cityId),
    selectedDomains.every((d) => materialSource[d.id]),
    name.trim().length >= 2 && /^[0-9]{10}$/.test(mobile),
  ][step];

  function toggleDomain(id: string) {
    setDomainIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  }

  function submit() {
    startTransition(async () => {
      await createRequirementAction({
        name,
        mobile,
        cityId,
        domainIds,
        description,
        urgency,
        materialSource,
        siteAccessibilityTags: tags,
        budgetMin: budgetSet ? Math.round(budgetStops[budgetIndex] * 0.7) : null,
        budgetMax: budgetSet ? budgetStops[budgetIndex] : null,
        preferredProfessionalId: requestedProfessional?.id ?? null,
        catalogueItems: prefill?.item
          ? [
              {
                domainId: prefill.item.domainId,
                productId: prefill.item.productId,
                packageId: prefill.item.packageId,
                itemName: prefill.item.itemName,
                quantity: prefill.item.quantity,
                selectedOptions: prefill.item.selectedOptions,
                indicativePrice: prefill.item.indicativePrice,
                notes: null,
              },
            ]
          : undefined,
      });
    });
  }

  return (
    <div className="rounded-xl border border-line bg-surface">
      {/* Progress */}
      <div className="flex items-center gap-1 border-b border-line px-6 py-4">
        {steps.map((s, i) => (
          <div key={s.label} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={cn(
                "flex items-center gap-2 text-[13.5px] sm:text-[12.5px] transition-colors",
                i === step ? "font-semibold text-brand" : i < step ? "text-ink-2" : "text-ink-4",
                i < step && "cursor-pointer hover:text-brand",
              )}
            >
              <span
                className={cn(
                  "grid h-6 w-6 place-items-center rounded-full text-[12px] sm:text-[11px] font-semibold",
                  i === step
                    ? "bg-brand text-white"
                    : i < step
                      ? "bg-brand-soft text-brand"
                      : "bg-surface-2 text-ink-4",
                )}
              >
                {i < step ? "✓" : i + 1}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < steps.length - 1 ? <span className="h-px flex-1 bg-line" /> : null}
          </div>
        ))}
      </div>

      <div className="p-6 sm:p-8">
        {requestedProfessional ? (
          <div className="mb-6 rounded-lg border border-brand-line bg-brand-soft p-4">
            <p className="text-[14px] sm:text-[13px] font-medium text-ink">
              You asked for {requestedProfessional.companyName}
            </p>
            <p className="mt-1 text-[13.5px] sm:text-[12.5px] leading-relaxed text-ink-2">
              We will try to include {requestedProfessional.name.split(" ")[0]} among your three
              quotes for{" "}
              {requestedProfessional.domainNames.length === 1
                ? requestedProfessional.domainNames[0].toLowerCase()
                : "the services they cover"}
              . If they are booked or do not cover your area, we will tell you and assign three
              others — you are never left waiting on one person.
            </p>
          </div>
        ) : null}

        {prefill?.item ? (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-clay-line bg-clay-soft p-4">
            <svg viewBox="0 0 16 16" className="mt-0.5 h-4 w-4 shrink-0 fill-clay" aria-hidden="true">
              <path d="M8 1l6 3v5c0 3.5-2.6 5.6-6 6.9C4.6 14.6 2 12.5 2 9V4l6-3z" />
            </svg>
            <div className="min-w-0">
              <p className="text-[14px] sm:text-[13px] font-medium text-ink">
                Carrying your selection: {prefill.item.label}
              </p>
              <p className="mt-0.5 text-[13.5px] sm:text-[12.5px] text-ink-3">
                {prefill.item.sublabel}
                {prefill.item.quantity > 1 ? ` · quantity ${prefill.item.quantity}` : ""}
                {Object.keys(prefill.item.selectedOptions).length > 0
                  ? ` · ${Object.entries(prefill.item.selectedOptions)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(", ")}`
                  : ""}
              </p>
              <p className="mt-1.5 text-[13px] sm:text-[12px] text-ink-4">
                Vendors will quote against this exact selection.
              </p>
            </div>
          </div>
        ) : null}

        {/* ---------------- Step 1: services ---------------- */}
        {step === 0 ? (
          <div>
            <h2 className="font-display text-[24px]">What do you need?</h2>
            <p className="mt-2 text-[15px] sm:text-[14px] text-ink-3">
              Pick one or several. Each service you select gets its own three professionals and its
              own set of quotes.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {domains.map((domain) => {
                const active = domainIds.includes(domain.id);
                return (
                  <button
                    key={domain.id}
                    type="button"
                    onClick={() => toggleDomain(domain.id)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-all",
                      active
                        ? "border-brand bg-brand-soft"
                        : "border-line bg-paper hover:border-ink-4",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={cn(
                          "text-[15px] font-semibold",
                          active ? "text-brand" : "text-ink",
                        )}
                      >
                        {domain.name}
                      </span>
                      <span
                        className={cn(
                          "grid h-5 w-5 shrink-0 place-items-center rounded border text-[12px] sm:text-[11px]",
                          active
                            ? "border-brand bg-brand text-white"
                            : "border-line-strong bg-surface",
                        )}
                      >
                        {active ? "✓" : ""}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[14px] sm:text-[13px] leading-relaxed text-ink-3">
                      {domain.tagline}
                    </p>
                  </button>
                );
              })}
            </div>
            {domainIds.length > 1 ? (
              <p className="mt-4 rounded-lg bg-surface-2 p-3 text-[14px] sm:text-[13px] leading-relaxed text-ink-2">
                You selected {domainIds.length} services. They are handled independently — separate
                professionals, separate quotes, and separate agreements unless one professional
                turns out to cover more than one of them.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* ---------------- Step 2: details ---------------- */}
        {step === 1 ? (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-[24px]">Describe what you want</h2>
              <p className="mt-2 text-[15px] sm:text-[14px] text-ink-3">
                In your own words. No need to be precise — exact sizes and finishes get worked out
                on the call and the site visit.
              </p>
            </div>

            <div>
              <label htmlFor="description" className="text-[14px] sm:text-[13px] font-medium text-ink">
                Brief description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="e.g. wardrobe for the master bedroom and the whole flat repainted"
                className="mt-2 w-full rounded-lg border border-line bg-paper px-3.5 py-3 text-[15.5px] sm:text-[14.5px] text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-brand"
              />
            </div>

            <div>
              <span className="text-[14px] sm:text-[13px] font-medium text-ink">City</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {cities.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCityId(c.id)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-[14px] sm:text-[13px] transition-colors",
                      cityId === c.id
                        ? "border-brand bg-brand text-white"
                        : "border-line bg-paper text-ink-2 hover:border-ink-4",
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[13px] sm:text-[12px] text-ink-4">
                Only professionals who actually service this city will be assigned.
              </p>
            </div>

            <div>
              <span className="text-[14px] sm:text-[13px] font-medium text-ink">When do you want to start?</span>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {urgencies.map((u) => (
                  <button
                    key={u.value}
                    type="button"
                    onClick={() => setUrgency(u.value)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      urgency === u.value
                        ? "border-brand bg-brand-soft"
                        : "border-line bg-paper hover:border-ink-4",
                    )}
                  >
                    <div
                      className={cn(
                        "text-[14.5px] sm:text-[13.5px] font-medium",
                        urgency === u.value ? "text-brand" : "text-ink",
                      )}
                    >
                      {u.label}
                    </div>
                    <div className="mt-0.5 text-[13px] sm:text-[12px] text-ink-3">{u.hint}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {/* ---------------- Step 3: materials + optional ---------------- */}
        {step === 2 ? (
          <div className="space-y-7">
            <div>
              <h2 className="font-display text-[24px]">Who supplies the material?</h2>
              <p className="mt-2 text-[15px] sm:text-[14px] text-ink-3">
                Asked once per service, because the answer genuinely changes the quote — materials
                plus labour if the vendor sources it, labour only if you do.
              </p>
            </div>

            {selectedDomains.map((domain) => (
              <div key={domain.id}>
                <div className="flex items-center gap-2">
                  <Badge tone="brand">{domain.name}</Badge>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {materialOptions.map((option) => {
                    const active = materialSource[domain.id] === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setMaterialSource((prev) => ({ ...prev, [domain.id]: option.value }))
                        }
                        className={cn(
                          "rounded-lg border p-3 text-left transition-colors",
                          active ? "border-brand bg-brand-soft" : "border-line bg-paper hover:border-ink-4",
                        )}
                      >
                        <div
                          className={cn(
                            "text-[14.5px] sm:text-[13.5px] font-medium",
                            active ? "text-brand" : "text-ink",
                          )}
                        >
                          {option.label}
                        </div>
                        <div className="mt-0.5 text-[13px] sm:text-[12px] leading-snug text-ink-3">
                          {option.hint}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="border-t border-line pt-6">
              <div className="flex items-baseline justify-between">
                <span className="text-[14px] sm:text-[13px] font-medium text-ink">Site access</span>
                <span className="text-[13px] sm:text-[12px] text-ink-4">Optional</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {accessTags.map((tag) => {
                  const active = tags.includes(tag.value);
                  return (
                    <button
                      key={tag.value}
                      type="button"
                      onClick={() =>
                        setTags((prev) =>
                          active ? prev.filter((t) => t !== tag.value) : [...prev, tag.value],
                        )
                      }
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-[14px] sm:text-[13px] transition-colors",
                        active
                          ? "border-brand bg-brand-soft font-medium text-brand"
                          : "border-line bg-paper text-ink-2 hover:border-ink-4",
                      )}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[13px] sm:text-[12px] text-ink-4">
                A fourth-floor walk-up genuinely changes a delivery or installation quote.
              </p>
            </div>

            <div className="border-t border-line pt-6">
              <div className="flex items-baseline justify-between">
                <span className="text-[14px] sm:text-[13px] font-medium text-ink">Photos</span>
                <span className="text-[13px] sm:text-[12px] text-ink-4">Optional</span>
              </div>
              <p className="mt-1 text-[13px] sm:text-[12px] leading-relaxed text-ink-4">
                A photo of the space, a damaged area, or a reference you like. It saves a whole
                round of questions later.
              </p>

              <div className="mt-3 flex flex-wrap gap-3">
                {photos.map((photo, i) => (
                  <div
                    key={photo.id}
                    className="group relative h-20 w-20 overflow-hidden rounded-lg border border-line"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={photo.caption ?? "Site photo"}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setPhotos((prev) => prev.filter((_, index) => index !== i))
                      }
                      className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-[12px] sm:text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label={`Remove ${photo.caption ?? "photo"}`}
                    >
                      ×
                    </button>
                  </div>
                ))}

                <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-lg border border-dashed border-line-strong bg-paper text-center text-[12.5px] sm:text-[11.5px] text-ink-3 transition-colors hover:border-brand hover:text-brand">
                  <span>
                    <span className="block text-[18px] leading-none">+</span>
                    Add
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []).slice(
                        0,
                        maxFilesFor("requirement_photo") - photos.length,
                      );
                      e.target.value = "";
                      void addPhotos(files);
                    }}
                  />
                </label>
              </div>
              {uploadError ? (
                <p className="mt-2 text-[13px] sm:text-[12px] text-danger">{uploadError}</p>
              ) : uploading ? (
                <p className="mt-2 text-[13px] sm:text-[12px] text-ink-4">Uploading…</p>
              ) : photos.length > 0 ? (
                <p className="mt-2 text-[13px] sm:text-[12px] text-ink-4">
                  {photos.length} of {maxFilesFor("requirement_photo")} uploaded
                </p>
              ) : null}
            </div>

            <div className="border-t border-line pt-6">
              <div className="flex items-baseline justify-between">
                <span className="text-[14px] sm:text-[13px] font-medium text-ink">Rough budget</span>
                <span className="text-[13px] sm:text-[12px] text-ink-4">Optional</span>
              </div>
              <div className="mt-3 flex items-center gap-4">
                <input
                  type="range"
                  min={0}
                  max={budgetStops.length - 1}
                  value={budgetIndex}
                  onChange={(e) => {
                    setBudgetIndex(Number(e.target.value));
                    setBudgetSet(true);
                  }}
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-surface-2 accent-[var(--color-brand)]"
                />
                <span className="w-28 text-right font-display text-[19px] text-ink">
                  {budgetSet ? `up to ${formatRupeesShort(budgetStops[budgetIndex])}` : "—"}
                </span>
              </div>
              <p className="mt-2 text-[13px] sm:text-[12px] text-ink-4">
                A range is enough. Most people do not know a precise figure at this stage, and
                pretending otherwise just produces a worse quote.
              </p>
            </div>
          </div>
        ) : null}

        {/* ---------------- Step 4: contact & review ---------------- */}
        {step === 3 ? (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-[24px]">Where do we reach you?</h2>
              <p className="mt-2 text-[15px] sm:text-[14px] text-ink-3">
                One call to confirm the details, then we assign professionals. We do not pass your
                number to anyone who has not been assigned to your requirement.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="text-[14px] sm:text-[13px] font-medium text-ink">
                  Your name
                </label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Priya Sharma"
                  className="mt-2 h-11 w-full rounded-lg border border-line bg-paper px-3.5 text-[15.5px] sm:text-[14.5px] text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-brand"
                />
              </div>
              <div>
                <label htmlFor="mobile" className="text-[14px] sm:text-[13px] font-medium text-ink">
                  Mobile number
                </label>
                <div className="mt-2 flex items-center rounded-lg border border-line bg-paper focus-within:border-brand">
                  <span className="pl-3.5 text-[15.5px] sm:text-[14.5px] text-ink-4">+91</span>
                  <input
                    id="mobile"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="98XXXXXXXX"
                    inputMode="numeric"
                    className="h-11 w-full bg-transparent px-2.5 text-[15.5px] sm:text-[14.5px] text-ink outline-none placeholder:text-ink-4"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-line bg-paper p-5">
              <h3 className="text-[14px] sm:text-[13px] font-semibold uppercase tracking-[0.1em] text-ink-4">
                Your requirement
              </h3>
              <dl className="mt-3 space-y-2.5 text-[14.5px] sm:text-[13.5px]">
                <div className="flex justify-between gap-6">
                  <dt className="text-ink-3">Services</dt>
                  <dd className="text-right font-medium text-ink">
                    {selectedDomains.map((d) => d.name).join(", ")}
                  </dd>
                </div>
                <div className="flex justify-between gap-6">
                  <dt className="text-ink-3">City</dt>
                  <dd className="text-right font-medium text-ink">
                    {cities.find((c) => c.id === cityId)?.name}
                  </dd>
                </div>
                <div className="flex justify-between gap-6">
                  <dt className="text-ink-3">Urgency</dt>
                  <dd className="text-right font-medium text-ink">
                    {urgencies.find((u) => u.value === urgency)?.label}
                  </dd>
                </div>
                {selectedDomains.map((d) => (
                  <div key={d.id} className="flex justify-between gap-6">
                    <dt className="text-ink-3">Material — {d.name}</dt>
                    <dd className="text-right font-medium text-ink">
                      {materialOptions.find((m) => m.value === materialSource[d.id])?.label}
                    </dd>
                  </div>
                ))}
                {requestedProfessional ? (
                  <div className="flex justify-between gap-6">
                    <dt className="text-ink-3">You asked for</dt>
                    <dd className="text-right font-medium text-ink">
                      {requestedProfessional.companyName}
                      <span className="ml-1 font-normal text-ink-4">(if available)</span>
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-6 border-t border-line pt-2.5">
                  <dt className="text-ink-3">Professionals assigned</dt>
                  <dd className="text-right font-medium text-ink">
                    {selectedDomains.length * 3} ({selectedDomains.length} × 3)
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-[14px] sm:text-[13px] leading-relaxed text-ink-3">
                “{description.trim()}”
              </p>
            </div>
          </div>
        ) : null}

        {/* ---------------- Navigation ---------------- */}
        <div className="mt-8 flex items-center justify-between border-t border-line pt-6">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || pending}
          >
            Back
          </Button>

          {step < steps.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canContinue}>
              Continue
            </Button>
          ) : (
            <Button onClick={submit} disabled={!canContinue || pending} size="lg">
              {pending ? "Submitting…" : "Submit requirement"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
