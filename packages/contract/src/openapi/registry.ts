/**
 * Which schemas become named components in the OpenAPI document.
 *
 * This matters more than it looks. A generator handed an inlined schema emits
 * an anonymous class per occurrence — `ProfessionalSummary` would arrive in the
 * Dart client a dozen times over under names like `LeadDomainViewAssignments-
 * ItemProfessional`, and nothing would be assignable to anything else. Naming
 * them here is what makes the generated client have `ProfessionalSummary` once.
 *
 * The list is derived from the export names rather than hand-written, so a
 * schema added to `@repo/types/schema` is a component the next time this runs.
 * There is no list to forget to update.
 */
import type { z } from "zod";
import * as entities from "@repo/types/schema";
import * as responses from "../responses";

/** `professionalSummarySchema` -> `ProfessionalSummary`. */
function componentName(exportName: string): string {
  const stem = exportName.replace(/Schema$/, "");
  return stem.charAt(0).toUpperCase() + stem.slice(1);
}

function isZodSchema(value: unknown): value is z.ZodTypeAny {
  return (
    typeof value === "object" &&
    value !== null &&
    "_def" in value &&
    typeof (value as { parse?: unknown }).parse === "function"
  );
}

/**
 * Primitive aliases stay inline.
 *
 * `idSchema` is `z.string()`. Emitting it as a named component would give the
 * Dart client a one-field wrapper class around a string and make every id in
 * the API that type — technically faithful, miserable to use, and not what the
 * TypeScript side does either, where `ID = string`.
 */
const INLINE = new Set([
  "idSchema",
  "timestampSchema",
  "dateOnlySchema",
  "rupeesSchema",
  "actorRoleSchema",
  "paginatedSchema",
  "okSchema",
  "countSchema",
]);

export interface Component {
  name: string;
  schema: z.ZodTypeAny;
}

function collect(module: Record<string, unknown>): Component[] {
  return Object.entries(module)
    .filter(([name, value]) => !INLINE.has(name) && isZodSchema(value))
    .map(([name, value]) => ({ name: componentName(name), schema: value as z.ZodTypeAny }));
}

/**
 * Every named component, entities first.
 *
 * `@repo/contract/responses` re-exports several entity schemas for the
 * manifest's convenience, so the two modules overlap. De-duplicated by name,
 * keeping the entity definition — they are the same object either way, but the
 * ordering makes that explicit rather than incidental.
 */
export const components: Component[] = (() => {
  const byName = new Map<string, Component>();
  for (const entry of [...collect(entities), ...collect(responses)]) {
    if (!byName.has(entry.name)) byName.set(entry.name, entry);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
})();

