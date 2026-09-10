"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { City, Domain, ProfessionalApplication } from "@repo/types";
import { Button, Card, cn } from "@repo/ui";
import { submitApplicationAction } from "@/app/(site)/account/become-a-professional/actions";

/**
 * The form that turns a customer into an applicant.
 *
 * Short on purpose. Documents, work photographs, references and bank details
 * are collected by the partner portal's own setup steps once somebody is in —
 * asking for all of it before a human has looked at the business loses most
 * applicants at a form and tells the reviewer nothing they could not decide
 * without it.
 */
export function ProfessionalApplicationForm({
  domains,
  cities,
  defaultContactName,
  defaultContactMobile,
  /** Set when answering a change request, so nothing is retyped. */
  previous,
}: {
  domains: Domain[];
  cities: City[];
  defaultContactName: string;
  defaultContactMobile: string | null;
  previous?: ProfessionalApplication;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  const [companyName, setCompanyName] = useState(previous?.companyName ?? "");
  const [gstNumber, setGstNumber] = useState(previous?.gstNumber ?? "");
  const [experienceYears, setExperienceYears] = useState(
    previous ? String(previous.experienceYears) : "",
  );
  const [bio, setBio] = useState(previous?.bio ?? "");
  const [contactName, setContactName] = useState(previous?.contactName ?? defaultContactName);
  const [contactMobile, setContactMobile] = useState(
    previous?.contactMobile ?? defaultContactMobile ?? "",
  );
  const [domainIds, setDomainIds] = useState<string[]>(previous?.requestedDomainIds ?? []);
  const [cityIds, setCityIds] = useState<string[]>(previous?.serviceCityIds ?? []);
  const [areaNote, setAreaNote] = useState(previous?.serviceAreaNote ?? "");

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const years = Number(experienceYears);
  const yearsValid = experienceYears.trim() !== "" && Number.isInteger(years) && years >= 0 && years <= 70;

  const ready =
    companyName.trim().length >= 2 &&
    contactName.trim().length >= 2 &&
    bio.trim().length >= 30 &&
    yearsValid &&
    domainIds.length > 0 &&
    cityIds.length > 0;

  function submit() {
    setError(undefined);
    startTransition(async () => {
      const result = await submitApplicationAction({
        companyName: companyName.trim(),
        gstNumber: gstNumber.trim() || null,
        experienceYears: years,
        bio: bio.trim(),
        contactName: contactName.trim(),
        contactMobile: contactMobile.trim() || null,
        requestedDomainIds: domainIds,
        serviceCityIds: cityIds,
        serviceAreaNote: areaNote.trim(),
      });

      if (result.error) {
        setError(result.error);
        return;
      }
      // The page re-reads the application and switches to the status view.
      router.refresh();
    });
  }

  return (
    <Card>
      <h2 className="font-display text-[21px]">
        {previous ? "Update your application" : "Tell us about your business"}
      </h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-3">
        Our team reads every application. Nothing here is published anywhere until you are
        approved.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field
          id="company-name"
          label="Business name"
          value={companyName}
          onChange={setCompanyName}
          placeholder="e.g. Sri Balaji Interiors"
        />
        <Field
          id="experience-years"
          label="Years in the trade"
          value={experienceYears}
          onChange={setExperienceYears}
          placeholder="e.g. 8"
          inputMode="numeric"
          hint={
            experienceYears.trim() !== "" && !yearsValid
              ? "A whole number of years, up to 70"
              : undefined
          }
        />
        <Field
          id="contact-name"
          label="Who should we ask for?"
          value={contactName}
          onChange={setContactName}
          placeholder="The person who takes our calls"
        />
        <Field
          id="contact-mobile"
          label="Best number to reach you"
          value={contactMobile}
          onChange={setContactMobile}
          placeholder="10-digit mobile"
          inputMode="tel"
          hint="Leave blank to use the number on your account."
        />
        <div className="sm:col-span-2">
          <Field
            id="gst-number"
            label="GST number"
            value={gstNumber}
            onChange={setGstNumber}
            placeholder="Optional"
            hint="Not required for smaller workshops. It does not count against you."
          />
        </div>
      </div>

      {/* Trades first among the choices: it is the decision ops actually make. */}
      <div className="mt-6">
        <span className="text-[14px] sm:text-[13px] font-medium text-ink">
          Which trades do you want leads for?
        </span>
        <p className="mt-1 text-[13px] text-ink-4">
          Approval is per trade — a fabricator who also paints can be approved for both.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {domains.map((domain) => {
            const selected = domainIds.includes(domain.id);
            return (
              <button
                key={domain.id}
                type="button"
                onClick={() => setDomainIds((list) => toggle(list, domain.id))}
                aria-pressed={selected}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  selected
                    ? "border-brand bg-brand-soft"
                    : "border-line bg-paper hover:border-ink-4",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "text-[14.5px] sm:text-[13.5px] font-medium",
                      selected ? "text-brand" : "text-ink",
                    )}
                  >
                    {domain.name}
                  </span>
                  <span className="text-[12px] text-ink-4">
                    {domain.defaultCommissionPercent}% commission
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-3">
                  {domain.tagline || domain.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        <span className="text-[14px] sm:text-[13px] font-medium text-ink">Where do you work?</span>
        <p className="mt-1 text-[13px] text-ink-4">
          Leads are matched by city, so only pick the ones you actually travel to.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {cities.map((city) => {
            const selected = cityIds.includes(city.id);
            return (
              <button
                key={city.id}
                type="button"
                onClick={() => setCityIds((list) => toggle(list, city.id))}
                aria-pressed={selected}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[14px] sm:text-[13px] transition-colors",
                  selected
                    ? "border-brand bg-brand-soft font-medium text-brand"
                    : "border-line bg-paper text-ink-2 hover:border-ink-4",
                )}
              >
                {city.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        <label htmlFor="area-note" className="text-[14px] sm:text-[13px] font-medium text-ink">
          Localities, in your own words
        </label>
        <textarea
          id="area-note"
          value={areaNote}
          onChange={(e) => setAreaNote(e.target.value)}
          rows={2}
          placeholder="e.g. Anywhere in south Bengaluru; Whitefield only for jobs over ₹2 lakh"
          className="mt-2 w-full rounded-lg border border-line bg-paper px-3.5 py-3 text-[15px] sm:text-[14px] text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-brand"
        />
      </div>

      <div className="mt-5">
        <label htmlFor="bio" className="text-[14px] sm:text-[13px] font-medium text-ink">
          What kind of work do you do?
        </label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={5}
          placeholder="The jobs you take on, the size of your team, materials you prefer, and a couple of recent projects. This is what our team reads first."
          className="mt-2 w-full rounded-lg border border-line bg-paper px-3.5 py-3 text-[15px] sm:text-[14px] text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-brand"
        />
        <p className="mt-1.5 text-[12.5px] text-ink-4">
          {bio.trim().length < 30
            ? `A few sentences at least — ${30 - bio.trim().length} more characters.`
            : "Good. Specifics get read properly."}
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-lg border border-danger/30 bg-danger-soft px-3.5 py-3 text-[13.5px] leading-relaxed text-danger"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <p className="max-w-sm text-[13px] leading-relaxed text-ink-4">
          Approval switches this account over to the professional portal, where your leads,
          quotes and commission live.
        </p>
        <Button disabled={pending || !ready} onClick={submit}>
          {pending ? "Sending…" : previous ? "Send updated application" : "Send application"}
        </Button>
      </div>
    </Card>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  inputMode?: "numeric" | "tel";
}) {
  return (
    <div>
      <label htmlFor={id} className="text-[14px] sm:text-[13px] font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        value={value}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 h-11 w-full rounded-lg border border-line bg-paper px-3.5 text-[15px] sm:text-[14px] text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-brand"
      />
      {hint ? <p className="mt-1.5 text-[12.5px] text-ink-4">{hint}</p> : null}
    </div>
  );
}
