/**
 * The errors this API raises, and how they become responses.
 *
 * `packages/data/src/client.ts` maps status codes onto `ApiError.isUnauthorised`,
 * `isForbidden`, `isNotFound` and `isRetryable`, and the UI branches on those.
 * So the status code is part of the contract, not an implementation detail.
 */

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** Nobody is signed in, or the session expired. The UI sends them to sign in. */
export class NotAuthenticatedError extends HttpError {
  constructor(message = "Please sign in to continue") {
    super(401, "not_authenticated", message);
  }
}

/**
 * Signed in, but not allowed.
 *
 * Distinct from 404 on purpose: a customer asking for another customer's lead
 * gets 404, not 403, because 403 would confirm the record exists.
 */
export class ForbiddenError extends HttpError {
  constructor(message = "You do not have access to this") {
    super(403, "forbidden", message);
  }
}

export class NotFoundError extends HttpError {
  constructor(what = "That") {
    super(404, "not_found", `${what} could not be found`);
  }
}

/** The request was well-formed but the operation is not valid right now. */
export class ConflictError extends HttpError {
  constructor(message: string, details?: unknown) {
    super(409, "conflict", message, details);
  }
}

export class ValidationError extends HttpError {
  constructor(message: string, details?: unknown) {
    super(422, "invalid_request", message, details);
  }
}

export class RateLimitedError extends HttpError {
  constructor(retryAfterSeconds: number) {
    super(429, "rate_limited", "Too many attempts. Try again shortly.", {
      retryAfterSeconds,
    });
  }
}

/**
 * Turns a Postgres constraint violation into a readable conflict.
 *
 * The unique indexes in this schema are business rules, so hitting one is not
 * an internal error — it means somebody tried to bill an agreement twice, or
 * two quote submissions raced. The caller deserves to be told which.
 */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  uq_invoice_agreement: "This agreement has already been invoiced",
  uq_project_lead_domain: "A project already exists for this service",
  uq_review_project: "This project has already been reviewed",
  uq_assignment: "That professional is already assigned to this service",
  uq_quote_version: "Another quote was submitted at the same time. Please try again.",
  uq_quote_live: "You already have a live quote for this service",
  uq_agreement_lead_professional: "An agreement already exists for this professional on this lead",
  uq_agreement_lead_domain: "This service is already covered by an agreement",
  uq_partner_agreement_live: "This vendor already has a live partner agreement",
  uq_users_mobile: "An account already exists for that mobile number",
  ck_message_channel: "That message would cross the client and vendor channels",
  fk_lead_domain_selected_quote: "That quote does not belong to this service",
};

interface PostgresError {
  code?: string;
  constraint_name?: string;
  constraint?: string;
  detail?: string;
  message?: string;
}

export function translateDatabaseError(error: unknown): HttpError | null {
  const pg = error as PostgresError;
  if (!pg?.code) return null;

  const constraint = pg.constraint_name ?? pg.constraint ?? "";
  const known = CONSTRAINT_MESSAGES[constraint];

  // 23505 unique violation, 23514 check violation, 23503 foreign key violation.
  if (pg.code === "23505" || pg.code === "23514" || pg.code === "23503") {
    return new ConflictError(known ?? "That change conflicts with existing data", {
      constraint,
    });
  }

  // Raised by the triggers in 0002_invariants.sql.
  if (pg.code === "P0001") {
    return new ConflictError(pg.message ?? "That change is not allowed");
  }

  return null;
}
