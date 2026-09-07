/**
 * Which schemas become named components in the OpenAPI document.
 *
 * This matters more than it looks. A generator handed an inlined schema emits
 * an anonymous class per occurrence — `ProfessionalSummary` would arrive in the
 * Dart client a dozen times over under names like `LeadDomainViewAssignments-
 * ItemProfessional`, and nothing would be assignable to anything else. Naming
 * them here is what makes the generated client have `ProfessionalSummary` once.
 *
 * Three sources, in a fixed order so the result is deterministic:
 *
 *   1. the entity and view-model schemas — the response contract
 *   2. the per-endpoint response envelopes
 *   3. the *input* schemas, which are what a request body is made of
 *
 * (3) was an afterthought and should not have been. With request bodies
 * inlined, the Dart generator invented a class per body and another per nested
 * object inside it — which is where a second `Labels` came from, alongside the
 * response side's `DomainLabels`, describing the identical shape.
 */
import type { z } from "zod";
import * as entities from "@repo/types/schema";
import * as responses from "../responses";
import * as authInput from "../auth";
import * as catalogueInput from "../catalogue";
import * as customerInput from "../customer";
import * as vendorInput from "../vendor";
import * as opsInput from "../ops";
import { routes } from "../index";
import type { RouteDefinition } from "../http";

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
  'idSchema',
  'timestampSchema',
  'dateOnlySchema',
  'rupeesSchema',
  'actorRoleSchema',
  'paginatedSchema',
  // Input primitives, same reasoning.
  'slugSchema',
  'mobileSchema',
  'mediaIdSchema',
  'csvSchema',
  'boolQuerySchema',
  'shortText',
  'longText',
  'optionalText',
  'agreementIdsSchema',
]);

export interface Component {
  name: string;
  schema: z.ZodTypeAny;
}

function collect(module: Record<string, unknown>): Array<[string, z.ZodTypeAny]> {
  return Object.entries(module)
    .filter(([name, value]) => !INLINE.has(name) && isZodSchema(value))
    .map(([name, value]) => [componentName(name), value as z.ZodTypeAny] as const)
    .map(([name, schema]) => [name, schema] as [string, z.ZodTypeAny]);
}

/**
 * Route bodies, named after the operation that accepts them.
 *
 * `CreateRequirementBody` rather than whatever a generator would invent from
 * the path. Only bodies with something in them: several mutations declare
 * `z.object({})` because the route takes no input beyond its path parameter,
 * and a class with no fields helps nobody.
 */
function routeBodies(): Array<[string, z.ZodTypeAny]> {
  const named: Array<[string, z.ZodTypeAny]> = [];

  for (const [routeName, route] of Object.entries(routes) as Array<
    [string, RouteDefinition]
  >) {
    const body = route.body;
    if (!body) continue;

    const shape = (body as z.ZodObject<z.ZodRawShape>)._def?.shape;
    const isEmptyObject = typeof shape === 'function' && Object.keys(shape()).length === 0;
    if (isEmptyObject) continue;

    named.push([`${componentName(routeName)}Body`, body]);
  }

  return named;
}

/**
 * Every named component.
 *
 * De-duplicated by *schema identity* first — several modules re-export the same
 * object for convenience — and then by name. A name taken by an entity and
 * wanted again by an input schema (`reviewSchema` exists as both) gets an
 * `Input` suffix rather than silently overwriting: the response `Review` and
 * the request that creates one are genuinely different shapes.
 */
export const components: Component[] = (() => {
  const byName = new Map<string, Component>();
  const bySchema = new Map<z.ZodTypeAny, string>();

  const sources: Array<[string, Array<[string, z.ZodTypeAny]>]> = [
    ['entity', collect(entities)],
    ['response', collect(responses)],
    ['body', routeBodies()],
    ['input', [
      ...collect(authInput),
      ...collect(catalogueInput),
      ...collect(customerInput),
      ...collect(vendorInput),
      ...collect(opsInput),
    ]],
  ];

  for (const [kind, entries] of sources) {
    for (const [preferred, schema] of entries) {
      // The same object under two export names is one component.
      if (bySchema.has(schema)) continue;

      let name = preferred;
      if (byName.has(name)) {
        if (kind === 'entity' || kind === 'response') continue;
        name = `${preferred}Input`;
        if (byName.has(name)) continue;
      }

      byName.set(name, { name, schema });
      bySchema.set(schema, name);
    }
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
})();
