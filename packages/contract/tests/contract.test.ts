/**
 * The contract, checked without a database.
 *
 * These assertions are about the manifest and the document generated from it,
 * so none of them needs Postgres — which is the point. They gate a pull request
 * cheaply, where the API's integration suite needs a service container.
 *
 * `apps/api/src/routes/conformance.ts` is the other half of this: it proves the
 * handlers still *return* what the manifest promises. Together they cover both
 * directions — the manifest describes reality, and reality matches the manifest.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { routes, type Audience, type RouteDefinition } from "../src/index";
import { buildOpenApiDocument } from "../src/openapi/generate";
import { OPENAPI_PATH, serialise } from "../src/openapi/write";

const entries = Object.entries(routes) as Array<[string, RouteDefinition]>;

/**
 * The surfaces the mobile app consumes.
 *
 * Staff routes are deliberately excluded: `MOBILE.md` is explicit that admin
 * stays on the web, with no mobile surface now or planned, so the ops manifest
 * is being backfilled rather than blocking.
 */
const MOBILE_AUDIENCES: Audience[] = ["public", "client", "professional"];

describe("the route manifest", () => {
  it("gives every mobile-facing endpoint a response schema", () => {
    const missing = entries
      .filter(([, route]) => MOBILE_AUDIENCES.includes(route.audience))
      .filter(([, route]) => !route.response)
      .map(([name]) => name);

    expect(
      missing,
      "these endpoints reach the mobile client but declare no response shape, " +
        "so nothing can be generated for them",
    ).toEqual([]);
  });

  it("declares a unique path and method for each entry", () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const [name, route] of entries) {
      const key = `${route.method} ${route.path}`;
      const existing = seen.get(key);
      if (existing) clashes.push(`${existing} and ${name} both claim ${key}`);
      else seen.set(key, name);
    }
    expect(clashes).toEqual([]);
  });

  it("never puts a body on a GET", () => {
    const offenders = entries
      .filter(([, route]) => route.method === "GET" && route.body)
      .map(([name]) => name);
    expect(offenders).toEqual([]);
  });
});

describe("the generated OpenAPI document", () => {
  const document = buildOpenApiDocument();
  const schemas = (document["components"] as { schemas: Record<string, unknown> }).schemas;
  const serialised = JSON.stringify(document);

  it("resolves every $ref it emits", () => {
    const referenced = [
      ...serialised.matchAll(/#\/components\/schemas\/([A-Za-z0-9_]+)/g),
    ].map((match) => match[1]!);

    const dangling = [...new Set(referenced)].filter((name) => !(name in schemas));
    expect(dangling, "refs pointing at components that were never emitted").toEqual([]);
  });

  it("names the shared view models rather than inlining them", () => {
    // If these stop being components, the generated Dart gets an anonymous
    // class per occurrence and nothing is assignable to anything else.
    for (const name of [
      "ProfessionalSummary",
      "MaskedClientSummary",
      "LeadView",
      "LeadDomainView",
      "QuoteView",
      "VendorLeadCard",
      "Domain",
      "City",
    ]) {
      expect(schemas, `${name} should be a named component`).toHaveProperty(name);
    }
  });

  it("describes query parameters instead of an empty object", () => {
    const products = (document["paths"] as Record<string, Record<string, { parameters: Array<{ name: string }> }>>)[
      "/products"
    ]!["get"]!;
    const names = products.parameters.map((p) => p.name);
    // `paginationSchema.extend(...)` wraps its shape in enough zod machinery
    // that a naive conversion yields no parameters at all.
    expect(names).toEqual(
      expect.arrayContaining(["limit", "cursor", "domain", "category", "search", "sort"]),
    );
  });

  it("marks the authenticated surfaces as requiring a session", () => {
    const paths = document["paths"] as Record<string, Record<string, { security?: unknown }>>;
    expect(paths["/me/requirements"]!["get"]!.security).toBeDefined();
    expect(paths["/vendor/leads"]!["get"]!.security).toBeDefined();
    expect(paths["/products"]!["get"]!.security).toBeUndefined();
  });
});

/**
 * Masking, asserted against the contract itself.
 *
 * `apps/api/tests/masking.test.ts` walks real vendor responses looking for seed
 * phone numbers, which catches a leaking query. This catches something that
 * test cannot: a *schema* that grows a field capable of carrying contact
 * details. It matters more now than it did, because these schemas generate the
 * mobile client's models — a field added here would reach a vendor's phone.
 */
describe("no vendor-facing response can carry customer contact details", () => {
  const document = buildOpenApiDocument();
  const schemas = (document["components"] as { schemas: Record<string, unknown> }).schemas;
  const paths = document["paths"] as Record<string, Record<string, unknown>>;

  const FORBIDDEN = ["mobile", "email", "phone", "phoneNumber", "contactNumber"];

  function propertyNames(node: unknown, into: Set<string> = new Set()): Set<string> {
    if (Array.isArray(node)) {
      for (const item of node) propertyNames(item, into);
      return into;
    }
    if (!node || typeof node !== "object") return into;

    const record = node as Record<string, unknown>;
    if (record["$ref"] && typeof record["$ref"] === "string") {
      const name = record["$ref"].split("/").pop()!;
      const target = schemas[name];
      // Guard against a cycle even though the contract has none today.
      if (target && !seenRefs.has(name)) {
        seenRefs.add(name);
        propertyNames(target, into);
      }
      return into;
    }
    if (record["properties"] && typeof record["properties"] === "object") {
      for (const key of Object.keys(record["properties"] as object)) into.add(key);
    }
    for (const value of Object.values(record)) propertyNames(value, into);
    return into;
  }

  let seenRefs = new Set<string>();

  it("MaskedClientSummary has no field to put one in", () => {
    const masked = schemas["MaskedClientSummary"] as { properties: Record<string, unknown> };
    for (const field of FORBIDDEN) {
      expect(masked.properties, `MaskedClientSummary must not have '${field}'`).not.toHaveProperty(
        field,
      );
    }
    expect(masked.properties).toHaveProperty("contactReleased");
  });

  it("no /vendor response reaches a contact field, however deeply nested", () => {
    const offenders: string[] = [];

    for (const [path, operations] of Object.entries(paths)) {
      if (!path.startsWith("/vendor")) continue;

      for (const [method, operation] of Object.entries(operations)) {
        const success = (operation as { responses: Record<string, unknown> }).responses;
        seenRefs = new Set();
        const found = propertyNames(success);
        const bad = FORBIDDEN.filter((field) => found.has(field));
        if (bad.length) offenders.push(`${method.toUpperCase()} ${path}: ${bad.join(", ")}`);
      }
    }

    expect(
      offenders,
      "a vendor endpoint can now return a customer's contact details",
    ).toEqual([]);
  });
});

describe("the committed document", () => {
  it("matches what the manifest generates", () => {
    let committed: string;
    try {
      committed = readFileSync(OPENAPI_PATH, "utf8");
    } catch {
      throw new Error("openapi.json is missing at the repository root. Run `npm run openapi`.");
    }

    expect(
      committed === serialise(),
      "openapi.json is stale. Run `npm run openapi` and commit the result.",
    ).toBe(true);
  });
});
