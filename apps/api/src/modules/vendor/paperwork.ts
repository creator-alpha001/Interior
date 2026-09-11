/**
 * The time rule behind a vendor's ID documents.
 *
 * Kept on its own so the verification view and anything else that needs "when
 * are this vendor's documents due" read one definition. The same 7 days is in
 * the `eligible_vendors` view in migration 0015, which is what actually pauses
 * leads; change both together.
 */

/** Days after the signed original is received within which every ID document must be sent. */
export const DOCUMENT_GRACE_DAYS = 7;

/**
 * Postgres hands timestamps back as "2026-09-11 06:30:00+00", which is not a
 * format every JavaScript engine promises to parse. Normalised to ISO first.
 */
export function parseTimestamp(value: string): Date {
  const iso = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(/[+-]\d{2}$/.test(iso) ? `${iso}:00` : iso);
}

/** When documents are due, given when the original was received. */
export function documentsDueBy(receivedAt: string | null): string | null {
  if (!receivedAt) return null;
  const received = parseTimestamp(receivedAt);
  if (Number.isNaN(received.getTime())) return null;
  return new Date(received.getTime() + DOCUMENT_GRACE_DAYS * 86_400_000).toISOString();
}
