"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Domain, PriceUnit, Product, ProductCategory, ServicePackage } from "@repo/types";
import { Button, cn } from "@repo/ui";
import {
  createCategoryAction,
  createPackageAction,
  createProductAction,
  updateCategoryAction,
  updatePackageAction,
  updateProductAction,
} from "@/app/actions";
import { ImagePicker, SingleImagePicker, type PickedImage } from "./image-picker";

/**
 * The catalogue editor.
 *
 * One panel that opens in place rather than a dialog: these forms are long —
 * a package has inclusions and exclusions, a product has specs and tags — and a
 * modal that scrolls internally on a 13-inch laptop is worse than a section of
 * the page. It also means the browser's back button does the obvious thing.
 *
 * Every save routes through a server action that returns `{ error }` rather
 * than throwing, so a failure keeps the form and its contents. Losing five
 * minutes of typing to an unhandled throw is the specific outcome being avoided.
 */

/* ------------------------------------------------------------------ *
 * Shared field furniture
 * ------------------------------------------------------------------ */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-ink">{label}</span>
      {hint ? <span className="ml-1.5 text-[12.5px] text-ink-4">{hint}</span> : null}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-line bg-paper px-3 py-2 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-brand";

function Text(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, props.className)} />;
}

function Area(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputClass, "min-h-24", props.className)} />;
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputClass, props.className)} />;
}

/**
 * A list of short lines — inclusions, exclusions, tags.
 *
 * One per line in a textarea rather than a repeating row of inputs. The content
 * is genuinely a list of sentences, people paste it from a quote or a brief,
 * and a paste into a row-based editor puts everything in the first box.
 */
function Lines({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  return (
    <Area
      value={value.join("\n")}
      placeholder={placeholder}
      onChange={(e) =>
        onChange(
          e.target.value
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
        )
      }
    />
  );
}

function Actions({
  busy,
  error,
  onCancel,
  submitLabel,
}: {
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <>
      {error ? (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2.5 text-[13.5px] text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </>
  );
}

/** Wraps the transition, the error state and the refresh every form repeats. */
function useSave(onDone: () => void) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const save = (run: () => Promise<{ error?: string }>) => {
    setError(null);
    start(async () => {
      const result = await run();
      if (result?.error) {
        setError(result.error);
        return;
      }
      // The action revalidates the path; this makes the open panel close and
      // the table below it show the new row without a manual reload.
      router.refresh();
      onDone();
    });
  };

  return { save, busy, error };
}

/* ------------------------------------------------------------------ *
 * Categories
 * ------------------------------------------------------------------ */

export function CategoryForm({
  domains,
  existing,
  onDone,
}: {
  domains: Domain[];
  existing?: ProductCategory;
  onDone: () => void;
}) {
  const [domainId, setDomainId] = useState(existing?.domainId ?? domains[0]?.id ?? "");
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [imageMediaId, setImageMediaId] = useState<string | null | undefined>(undefined);
  const { save, busy, error } = useSave(onDone);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save(() =>
          existing
            ? updateCategoryAction(existing.id, { name, description, imageMediaId })
            : createCategoryAction({ domainId, name, description, imageMediaId }),
        );
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Service">
          {/* Locked when editing: moving a category to another trade would
              orphan every product filed under it, which the API refuses. */}
          <Select
            value={domainId}
            onChange={(e) => setDomainId(e.target.value)}
            disabled={Boolean(existing)}
            required
          >
            {domains.map((domain) => (
              <option key={domain.id} value={domain.id}>
                {domain.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Name">
          <Text
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Modular kitchens"
            required
            maxLength={80}
          />
        </Field>
      </div>

      <Field label="Description" hint="one or two lines">
        <Area value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
      </Field>

      <Field label="Shelf image">
        <SingleImagePicker
          existingUrl={existing?.imageUrl ?? null}
          onChange={setImageMediaId}
          disabled={busy}
        />
      </Field>

      <Actions
        busy={busy}
        error={error}
        onCancel={onDone}
        submitLabel={existing ? "Save category" : "Create category"}
      />
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * Packages
 * ------------------------------------------------------------------ */

export function PackageForm({
  domains,
  existing,
  existingImages = [],
  onDone,
}: {
  domains: Domain[];
  existing?: ServicePackage;
  existingImages?: PickedImage[];
  onDone: () => void;
}) {
  const [domainId, setDomainId] = useState(existing?.domainId ?? domains[0]?.id ?? "");
  const [name, setName] = useState(existing?.name ?? "");
  const [shortDescription, setShort] = useState(existing?.shortDescription ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [price, setPrice] = useState(String(existing?.price ?? ""));
  const [priceBasis, setPriceBasis] = useState(existing?.priceBasis ?? "");
  const [durationDays, setDuration] = useState(String(existing?.durationDays ?? 0));
  const [inclusions, setInclusions] = useState<string[]>(existing?.inclusions ?? []);
  const [exclusions, setExclusions] = useState<string[]>(existing?.exclusions ?? []);
  const [badge, setBadge] = useState(existing?.badge ?? "");
  const [isFeatured, setFeatured] = useState(existing?.isFeatured ?? false);
  const [images, setImages] = useState<PickedImage[]>(existingImages);
  const { save, busy, error } = useSave(onDone);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const body = {
          name,
          shortDescription,
          description,
          price: Number(price) || 0,
          priceBasis,
          durationDays: Number(durationDays) || 0,
          inclusions,
          exclusions,
          badge: badge.trim() || null,
          isFeatured,
          mediaIds: images.map((image) => image.id),
        };
        save(() =>
          existing
            ? updatePackageAction(existing.id, body)
            : createPackageAction({ ...body, domainId }),
        );
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Service">
          <Select
            value={domainId}
            onChange={(e) => setDomainId(e.target.value)}
            disabled={Boolean(existing)}
            required
          >
            {domains.map((domain) => (
              <option key={domain.id} value={domain.id}>
                {domain.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Name">
          <Text
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="2BHK full home repaint"
            required
            maxLength={120}
          />
        </Field>
      </div>

      <Field label="One-line summary" hint="shown on the card">
        <Text value={shortDescription} onChange={(e) => setShort(e.target.value)} maxLength={300} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Indicative price" hint="₹">
          <Text
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            required
          />
        </Field>
        <Field label="Priced per" hint="what the number covers">
          <Text
            value={priceBasis}
            onChange={(e) => setPriceBasis(e.target.value)}
            placeholder="per 2BHK"
            required
            maxLength={80}
          />
        </Field>
        <Field label="Typical duration" hint="days">
          <Text
            value={durationDays}
            onChange={(e) => setDuration(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
          />
        </Field>
      </div>

      <Field label="Full description">
        <Area
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={4000}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="What is included" hint="one per line">
          <Lines
            value={inclusions}
            onChange={setInclusions}
            placeholder={"Two coats of premium emulsion\nSurface putty and primer"}
          />
        </Field>
        <Field label="What is not" hint="one per line">
          <Lines value={exclusions} onChange={setExclusions} placeholder={"Furniture shifting"} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Badge" hint="optional, e.g. Most chosen">
          <Text value={badge} onChange={(e) => setBadge(e.target.value)} maxLength={40} />
        </Field>
        <label className="flex items-end gap-2 pb-2 text-[13.5px] text-ink">
          <input
            type="checkbox"
            checked={isFeatured}
            onChange={(e) => setFeatured(e.target.checked)}
          />
          Show on the home page
        </label>
      </div>

      <Field label="Photographs">
        <ImagePicker value={images} onChange={setImages} disabled={busy} />
      </Field>

      <Actions
        busy={busy}
        error={error}
        onCancel={onDone}
        submitLabel={existing ? "Save package" : "Create package"}
      />
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * Products
 * ------------------------------------------------------------------ */

const PRICE_UNITS: Array<{ value: PriceUnit; label: string }> = [
  { value: "per_piece", label: "Per piece" },
  { value: "per_sqft", label: "Per sq.ft" },
  { value: "per_running_ft", label: "Per running ft" },
  { value: "per_kg", label: "Per kg" },
  { value: "per_room", label: "Per room" },
  { value: "per_project", label: "Per project" },
];

export function ProductForm({
  domains,
  categories,
  existing,
  existingImages = [],
  onDone,
}: {
  domains: Domain[];
  categories: ProductCategory[];
  existing?: Product;
  existingImages?: PickedImage[];
  onDone: () => void;
}) {
  const [domainId, setDomainId] = useState(existing?.domainId ?? domains[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? "");
  const [name, setName] = useState(existing?.name ?? "");
  const [shortDescription, setShort] = useState(existing?.shortDescription ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [basePrice, setBasePrice] = useState(String(existing?.basePrice ?? ""));
  const [priceUnit, setPriceUnit] = useState<PriceUnit>(existing?.priceUnit ?? "per_piece");
  const [leadTimeDays, setLeadTime] = useState(String(existing?.leadTimeDays ?? 0));
  const [isCustomisable, setCustomisable] = useState(existing?.isCustomisable ?? true);
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [isFeatured, setFeatured] = useState(existing?.isFeatured ?? false);
  const [images, setImages] = useState<PickedImage[]>(existingImages);
  const { save, busy, error } = useSave(onDone);

  // Only the chosen trade's shelves. The API refuses a mismatch outright, so
  // offering the others would be offering a choice that cannot be saved.
  const available = categories.filter((category) => category.domainId === domainId);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const body = {
          categoryId,
          name,
          shortDescription,
          description,
          basePrice: Number(basePrice) || 0,
          priceUnit,
          leadTimeDays: Number(leadTimeDays) || 0,
          isCustomisable,
          specs: existing?.specs ?? {},
          tags,
          isFeatured,
          mediaIds: images.map((image) => image.id),
        };
        save(() =>
          existing
            ? updateProductAction(existing.id, body)
            : createProductAction({ ...body, domainId }),
        );
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Service">
          <Select
            value={domainId}
            onChange={(e) => {
              setDomainId(e.target.value);
              // Cleared on purpose: the previous shelf belongs to the previous
              // trade, and keeping it is a save that fails on submit.
              setCategoryId("");
            }}
            disabled={Boolean(existing)}
            required
          >
            {domains.map((domain) => (
              <option key={domain.id} value={domain.id}>
                {domain.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Category">
          <Select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
            disabled={available.length === 0}
          >
            <option value="">
              {available.length === 0 ? "No categories in this service yet" : "Choose a category"}
            </option>
            {available.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Name">
        <Text
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="L-shaped modular kitchen"
          required
          maxLength={160}
        />
      </Field>

      <Field label="One-line summary" hint="shown on the card">
        <Text value={shortDescription} onChange={(e) => setShort(e.target.value)} maxLength={300} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Starting price" hint="₹">
          <Text
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            required
          />
        </Field>
        <Field label="Priced">
          <Select value={priceUnit} onChange={(e) => setPriceUnit(e.target.value as PriceUnit)}>
            {PRICE_UNITS.map((unit) => (
              <option key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Lead time" hint="days">
          <Text
            value={leadTimeDays}
            onChange={(e) => setLeadTime(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
          />
        </Field>
      </div>

      <Field label="Full description">
        <Area
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={4000}
        />
      </Field>

      <Field label="Tags" hint="one per line, used by search">
        <Lines value={tags} onChange={setTags} placeholder={"modular\nkitchen\nlaminate"} />
      </Field>

      <div className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2 text-[13.5px] text-ink">
          <input
            type="checkbox"
            checked={isCustomisable}
            onChange={(e) => setCustomisable(e.target.checked)}
          />
          Made to order
        </label>
        <label className="flex items-center gap-2 text-[13.5px] text-ink">
          <input
            type="checkbox"
            checked={isFeatured}
            onChange={(e) => setFeatured(e.target.checked)}
          />
          Show on the home page
        </label>
      </div>

      <Field label="Photographs">
        <ImagePicker value={images} onChange={setImages} disabled={busy} />
      </Field>

      <Actions
        busy={busy}
        error={error}
        onCancel={onDone}
        submitLabel={existing ? "Save product" : "Create product"}
      />
    </form>
  );
}
