/**
 * Builds the OpenAPI document from the route manifest.
 *
 * Generated from `@repo/contract` rather than by introspecting a running
 * Fastify instance, for one reason: the manifest is what both sides already
 * read. `@repo/data` builds its URLs from it and the API registers its handlers
 * against it, so a document derived from it cannot describe an endpoint that
 * does not exist or miss one that does. Introspection would describe whatever
 * happened to be registered, which is the same thing only when nothing is
 * wrong.
 *
 * What comes out is the input to the mobile client's Dart models. Its shape is
 * therefore load-bearing: see `registry.ts` for why schemas are named
 * components rather than inlined.
 */
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { routes, type Audience, type RouteDefinition } from "../index";
import { components } from "./registry";

type JsonSchema = Record<string, unknown>;

const COMPONENT_PATH = "#/components/schemas/";

/**
 * Fully expanded JSON Schema for one zod schema. No `$ref` anywhere.
 *
 * Neither of `zod-to-json-schema`'s ref strategies does what this document
 * needs, so refs are applied afterwards by `refify` instead:
 *
 *   - `"root"` emits a `$ref` for any schema *object* seen twice, and zod
 *     reuses field instances heavily — `idSchema` is one object behind thirty
 *     id fields, and `.extend()` shares the parent's field objects with the
 *     child. That produced refs named after whichever field was serialised
 *     first (`.../userId`, `.../avatarUrl`) pointing at definitions never
 *     emitted: 22 dangling references.
 *   - `"none"` fixed the dangling refs by inlining everything — including the
 *     registered components, which is the one thing that must stay a ref.
 *
 * Expanding here and substituting structurally below gives exact control, and
 * is safe only because nothing in this contract is recursive:
 * `ProductCategory.parentId` is an id, not a nested category.
 */
function expand(schema: z.ZodTypeAny): JsonSchema {
  const out = zodToJsonSchema(schema, {
    $refStrategy: "none",
    target: "openApi3",
    errorMessages: false,
  }) as JsonSchema;
  delete out["$schema"];
  delete out["definitions"];
  return describeBooleanLiterals(out) as JsonSchema;
}

/**
 * A `z.literal(true)` becomes prose rather than a one-value enum.
 *
 * `{ type: "boolean", enum: [false] }` is correct OpenAPI, and it is what
 * `contactReleased` and the `ok` acknowledgement genuinely are. But generators
 * reach for an enum *class* on seeing `enum`, and swagger_parser's boolean case
 * is broken — it emits `valueTrue('true')` against a `bool?` field, which does
 * not compile.
 *
 * A single-value boolean carries no information a `bool` does not, so the
 * constraint moves into the description. Nothing is lost that was being
 * enforced here: zod still refuses `contactReleased: true` at runtime, and
 * `packages/contract/tests/contract.test.ts` asserts exactly that.
 */
function describeBooleanLiterals(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(describeBooleanLiterals);
  if (!node || typeof node !== "object") return node;

  const record = node as Record<string, unknown>;
  const values = record["enum"];

  if (record["type"] === "boolean" && Array.isArray(values) && values.length === 1) {
    const { enum: _enum, description, ...rest } = record;
    return {
      ...rest,
      description: description
        ? `${String(description)} Always ${String(values[0])}.`
        : `Always ${String(values[0])}.`,
    };
  }

  return Object.fromEntries(
    Object.entries(record).map(([k, v]) => [k, describeBooleanLiterals(v)]),
  );
}

/** Key-sorted JSON, so two structurally equal schemas compare equal as text. */
function canonical(value: unknown): string {
  const sort = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(sort);
    if (node && typeof node === "object") {
      return Object.fromEntries(
        Object.entries(node as Record<string, unknown>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, sort(v)]),
      );
    }
    return node;
  };
  return JSON.stringify(sort(value));
}

/**
 * Discriminated unions, split into named variants.
 *
 * zod-to-json-schema renders `z.discriminatedUnion` as a bare `anyOf`, which
 * carries no hint that the branches are mutually exclusive or what tells them
 * apart. A generator handed that produces `ActorUnion.variant1` with an enum
 * called `ActorUnionVariant1Role` — technically a union, useless to switch on.
 *
 * Emitting OpenAPI's `oneOf` + `discriminator` instead gives every branch a
 * name derived from its discriminator value (`ActorClient`,
 * `ActorSalesAgent`), which is what makes the four-way role check in the mobile
 * client a readable, compiler-checked switch.
 */
interface UnionSplit {
  /** `Actor` -> the oneOf + discriminator wrapper. */
  base: JsonSchema;
  /** `ActorClient`, `ActorProfessional`, ... expanded in full. */
  variants: Map<string, JsonSchema>;
}

function splitDiscriminatedUnion(name: string, schema: z.ZodTypeAny): UnionSplit | null {
  if (!(schema instanceof z.ZodDiscriminatedUnion)) return null;

  const key = schema.discriminator as string;
  const variants = new Map<string, JsonSchema>();
  const mapping: Record<string, string> = {};

  for (const option of schema.options as z.ZodObject<z.ZodRawShape>[]) {
    const literal = option.shape[key];
    // The discriminator is a literal on every branch; that is what
    // `z.discriminatedUnion` guarantees and what makes the mapping possible.
    const value = (literal as z.ZodLiteral<string>).value;
    const variantName = `${name}${pascal(value)}`;
    variants.set(variantName, expand(option));
    mapping[value] = `${COMPONENT_PATH}${variantName}`;
  }

  return {
    base: {
      oneOf: Object.values(mapping).map(($ref) => ({ $ref })),
      discriminator: { propertyName: key, mapping },
    },
    variants,
  };
}

/** `sales_agent` -> `SalesAgent`. */
function pascal(value: string): string {
  return value
    .split(/[_-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

const unionSplits = new Map<string, UnionSplit>();
for (const { name, schema } of components) {
  const split = splitDiscriminatedUnion(name, schema);
  if (split) unionSplits.set(name, split);
}

/** Every component, expanded once. Built before any substitution happens. */
const expanded = new Map<string, JsonSchema>(
  components.flatMap(({ name, schema }) => {
    const split = unionSplits.get(name);
    if (!split) return [[name, expand(schema)] as const];
    // The variants are components in their own right; the base is assembled
    // after substitution, since its branches are pure refs already.
    return [...split.variants].map(([variantName, body]) => [variantName, body] as const);
  }),
);

/**
 * Expanded form -> component name.
 *
 * Two components with identical structure would collide here. That is reported
 * rather than resolved silently, because the right fix is a distinguishing
 * field in the schema, not a coin toss in the generator.
 */
const componentByShape = (() => {
  const map = new Map<string, string>();
  const collisions: string[] = [];
  for (const [name, schema] of [...expanded].sort(([a], [b]) => a.localeCompare(b))) {
    const key = canonical(schema);
    const existing = map.get(key);
    if (existing) collisions.push(`${existing} == ${name}`);
    else map.set(key, name);
  }
  if (collisions.length) {
    console.warn(
      `openapi: components with identical shapes, the first name wins: ${collisions.join(", ")}`,
    );
  }
  return map;
})();

/**
 * Replaces any subtree that *is* a known component with a `$ref` to it.
 *
 * `self` keeps a component from being replaced by a reference to itself when
 * its own definition is being emitted.
 *
 * The `nullable` handling is not a detail. `quoteSchema.nullable()` expands to
 * the whole quote shape *plus* `nullable: true`, which no longer compares equal
 * to the `Quote` component — so a first version of this missed every optional
 * relationship in the contract and the Dart generator emitted an anonymous
 * class for each one. Seven components' worth of duplicates
 * (`Invoice2`, `Review2`, ...) came from exactly this.
 *
 * OpenAPI 3.0 has no clean nullable `$ref`: siblings of `$ref` are ignored, so
 * `{ $ref, nullable }` silently drops the null. `allOf` is the form that works.
 */
function refify(node: unknown, self?: string): unknown {
  if (Array.isArray(node)) return node.map((item) => refify(item));
  if (!node || typeof node !== "object") return node;

  const record = node as Record<string, unknown>;

  const direct = componentByShape.get(canonical(record));
  if (direct && direct !== self) return { $ref: `${COMPONENT_PATH}${direct}` };

  if (record["nullable"] === true) {
    const { nullable: _nullable, ...bare } = record;
    const name = componentByShape.get(canonical(bare));
    if (name && name !== self) {
      return { allOf: [{ $ref: `${COMPONENT_PATH}${name}` }], nullable: true };
    }
  }

  return Object.fromEntries(Object.entries(record).map(([k, v]) => [k, refify(v)]));
}

/** Converts a per-route request or response shape, with components ref'd. */
function toJsonSchema(schema: z.ZodTypeAny): JsonSchema {
  // A route answering a whole union answers the named union, not its expansion.
  for (const [name] of unionSplits) {
    const component = components.find((c) => c.name === name);
    if (component && component.schema === schema) {
      return { $ref: `${COMPONENT_PATH}${name}` };
    }
  }
  return refify(expand(schema)) as JsonSchema;
}

/** The `components.schemas` block: each component expanded, its children ref'd. */
function allComponents(): Record<string, unknown> {
  const entries: Array<[string, unknown]> = [...expanded]
    // Drop a component that lost a shape collision. `refify` sends every
    // reference to the winning name, so the loser would be emitted, referenced
    // by nothing, and arrive in the Dart client as a dead class.
    .filter(([name, schema]) => componentByShape.get(canonical(schema)) === name)
    .map(([name, schema]) => [name, refify(schema, name)]);

  // The union wrappers reference their variants and are not expanded.
  for (const [name, split] of unionSplits) entries.push([name, split.base]);

  return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
}

/** "/products/:slug" -> "/products/{slug}" */
function toOpenApiPath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

/**
 * A body of `z.object({})`, which several mutations declare.
 *
 * `POST /me/agreements/:id/sign` takes nothing beyond its path parameter; the
 * empty object is there so the route's shape is uniform, not because a caller
 * has anything to send. Emitting it as a required request body makes every
 * generated client demand `body: {}` at the call site, which reads as though
 * something were missing.
 */
function isEmptyObject(schema: z.ZodTypeAny): boolean {
  if (!(schema instanceof z.ZodObject)) return false;
  return Object.keys(schema.shape as Record<string, unknown>).length === 0;
}

/**
 * Flattens an object schema into one parameter per key.
 *
 * Unwraps the wrappers a query schema accumulates — `.optional()`,
 * `.default()`, and the `.transform()` chains in `common.ts` — far enough to
 * find the shape underneath. Without this, `paginationSchema.extend(...)`
 * describes its parameters as `{}` and the generated client sends none of them.
 */
function parametersFrom(
  schema: z.ZodTypeAny | undefined,
  location: "path" | "query",
): unknown[] {
  if (!schema) return [];

  let unwrapped: z.ZodTypeAny = schema;
  while (
    unwrapped instanceof z.ZodOptional ||
    unwrapped instanceof z.ZodDefault ||
    unwrapped instanceof z.ZodEffects
  ) {
    unwrapped =
      unwrapped instanceof z.ZodEffects
        ? unwrapped.innerType()
        : (unwrapped._def as { innerType: z.ZodTypeAny }).innerType;
  }
  if (!(unwrapped instanceof z.ZodObject)) return [];

  const shape = unwrapped.shape as Record<string, z.ZodTypeAny>;
  return Object.entries(shape).map(([name, field]) => {
    const converted = toJsonSchema(field);
    // A path parameter is required by definition; a query one is required only
    // when zod says the value cannot be absent.
    const required = location === "path" ? true : !field.isOptional();
    const { description, ...rest } = converted as { description?: string };
    return {
      name,
      in: location,
      required,
      ...(description ? { description } : {}),
      schema: rest,
    };
  });
}

/**
 * The error bodies every endpoint can answer with.
 *
 * Declared once and attached to every operation, because they are genuinely
 * universal — `app.setErrorHandler` gives all of them the same
 * `{ code, message, details? }` shape. A generated client gets one error type
 * rather than one per endpoint.
 */
const problemRef = { $ref: `${COMPONENT_PATH}ApiProblem` };

function errorResponses(audience: Audience): Record<string, unknown> {
  const shared: Record<string, unknown> = {
    "422": { description: "The request body or query failed validation", content: json(problemRef) },
    "429": { description: "Rate limited. Retry after the stated time", content: json(problemRef) },
    "500": { description: "Unhandled server error", content: json(problemRef) },
  };

  if (audience !== "public") {
    shared["401"] = { description: "Not signed in, or the session was revoked", content: json(problemRef) };
    shared["403"] = { description: "Signed in, but not permitted", content: json(problemRef) };
  }

  /**
   * 404 means "no such record, or it is not yours".
   *
   * Deliberately indistinguishable: a 403 on somebody else's record would
   * confirm the record exists. Documented here so a client author does not
   * treat the two as different situations.
   */
  shared["404"] = {
    description: "No such record — which also covers a record belonging to somebody else",
    content: json(problemRef),
  };

  return shared;
}

function json(schema: unknown) {
  return { "application/json": { schema } };
}

const AUDIENCE_NOTE: Record<Audience, string> = {
  public: "No session required.",
  client: "Requires a signed-in customer.",
  professional: "Requires a signed-in professional.",
  staff: "Requires staff credentials. Not available to the mobile apps.",
};

function operationFor(name: string, route: RouteDefinition): Record<string, unknown> {
  const successStatus = String(route.successStatus ?? 200);
  const description = [route.summary, AUDIENCE_NOTE[route.audience]]
    .filter(Boolean)
    .join(" ");

  const operation: Record<string, unknown> = {
    operationId: name,
    tags: [route.audience],
    summary: route.summary ?? name,
    description,
    parameters: [
      ...parametersFrom(route.params, "path"),
      ...parametersFrom(route.query, "query"),
    ],
    responses: {
      [successStatus]: route.response
        ? { description: "Success", content: json(toJsonSchema(route.response)) }
        : { description: "Success (response shape not yet declared in the manifest)" },
      ...errorResponses(route.audience),
    },
  };

  if (route.body && route.method !== "GET" && !isEmptyObject(route.body)) {
    operation["requestBody"] = {
      required: true,
      content: json(toJsonSchema(route.body)),
    };
  }

  if (route.audience !== "public") {
    operation["security"] = [{ bearerAuth: [] }, { sessionCookie: [] }];
  }

  return operation;
}

export function buildOpenApiDocument(): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const [name, route] of Object.entries(routes) as Array<[string, RouteDefinition]>) {
    const path = toOpenApiPath(route.path);
    paths[path] ??= {};
    paths[path][route.method.toLowerCase()] = operationFor(name, route);
  }

  const schemas = allComponents();

  schemas["ApiProblem"] = {
    type: "object",
    description:
      "Every failure carries this shape. `code` is stable and machine-readable; `message` is written for a person.",
    properties: {
      code: { type: "string" },
      message: { type: "string" },
      details: {},
    },
    required: ["code", "message"],
  };

  return {
    openapi: "3.0.3",
    info: {
      title: "Aangan API",
      version: "1.0.0",
      description:
        "Generated from the route manifest in `@repo/contract`. Do not edit by hand — " +
        "run `npm run openapi` in apps/api. The mobile client's models are generated from this file.",
    },
    servers: [{ url: "/", description: "The API root" }],
    tags: [
      { name: "public", description: "Readable without a session" },
      { name: "client", description: "The customer surface, under /me" },
      { name: "professional", description: "The vendor portal, under /vendor" },
      { name: "staff", description: "Ops and admin. Web only — no mobile surface" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description:
            "A session token from `POST /auth/otp/verify` with `X-Client: mobile`. " +
            "The same session row as the cookie, revocable immediately — not a JWT.",
        },
        sessionCookie: {
          type: "apiKey",
          in: "cookie",
          name: "aangan_session",
          description: "How the web frontends authenticate.",
        },
      },
      schemas,
    },
    paths,
  };
}
