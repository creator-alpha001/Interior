"use client";

import { useState } from "react";
import type { Domain, Product, ProductCategory, ServicePackage } from "@repo/types";
import { Button } from "@repo/ui";
import { CategoryForm, PackageForm, ProductForm } from "./catalogue-forms";
import type { PickedImage } from "./image-picker";

/**
 * The "add" bar above the catalogue table, and the panel it opens.
 *
 * Client state rather than a route, because the table underneath is a server
 * component that already has the data: opening a form should not re-fetch the
 * catalogue, and cancelling should not be a navigation.
 */
type Editing =
  | { kind: "none" }
  | { kind: "category"; existing?: ProductCategory }
  | { kind: "package"; existing?: ServicePackage; images?: PickedImage[] }
  | { kind: "product"; existing?: Product; images?: PickedImage[] };

export function CatalogueEditor({
  domains,
  categories,
}: {
  domains: Domain[];
  categories: ProductCategory[];
}) {
  const [editing, setEditing] = useState<Editing>({ kind: "none" });
  const close = () => setEditing({ kind: "none" });

  if (domains.length === 0) {
    return (
      <p className="rounded-lg border border-line bg-surface px-4 py-3 text-[13.5px] text-ink-2">
        Add a service first — every product, package and category belongs to one.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <span className="mr-1 text-[13px] font-medium text-ink">Add</span>
        <Button size="sm" onClick={() => setEditing({ kind: "product" })}>
          Product
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setEditing({ kind: "package" })}>
          Package
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setEditing({ kind: "category" })}>
          Category
        </Button>

        {editing.kind !== "none" ? (
          <span className="ml-auto text-[12.5px] text-ink-4">
            Editing a {editing.kind}
          </span>
        ) : null}
      </div>

      {editing.kind !== "none" ? (
        <div className="border-t border-line px-4 py-5">
          {editing.kind === "category" ? (
            <CategoryForm domains={domains} existing={editing.existing} onDone={close} />
          ) : null}
          {editing.kind === "package" ? (
            <PackageForm
              domains={domains}
              existing={editing.existing}
              existingImages={editing.images}
              onDone={close}
            />
          ) : null}
          {editing.kind === "product" ? (
            <ProductForm
              domains={domains}
              categories={categories}
              existing={editing.existing}
              existingImages={editing.images}
              onDone={close}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The per-row edit button.
 *
 * Separate from the bar above because the table is a server component and this
 * has to be a client one. Rendering the whole table on the client to get a
 * button would send every product's description to the browser twice.
 */
export function EditRowButton({
  domains,
  categories,
  product,
  servicePackage,
  category,
  images = [],
}: {
  domains: Domain[];
  categories: ProductCategory[];
  product?: Product;
  servicePackage?: ServicePackage;
  category?: ProductCategory;
  images?: PickedImage[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        className="text-[12.5px] font-medium text-brand hover:underline"
      >
        {open ? "Close" : "Edit"}
      </button>

      {open ? (
        <div className="mt-3 rounded-lg border border-line bg-paper p-4">
          {product ? (
            <ProductForm
              domains={domains}
              categories={categories}
              existing={product}
              existingImages={images}
              onDone={() => setOpen(false)}
            />
          ) : null}
          {servicePackage ? (
            <PackageForm
              domains={domains}
              existing={servicePackage}
              existingImages={images}
              onDone={() => setOpen(false)}
            />
          ) : null}
          {category ? (
            <CategoryForm domains={domains} existing={category} onDone={() => setOpen(false)} />
          ) : null}
        </div>
      ) : null}
    </>
  );
}
