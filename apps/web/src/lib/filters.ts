/**
 * The arithmetic behind the listing filters.
 *
 * Kept apart from the components so the pages and the sidebar agree on what a
 * URL means: the query string is the whole state of a filtered listing.
 */

export interface PriceBucket {
  /** `min-max`, either side may be empty. What the URL carries as `price`. */
  key: string;
  label: string;
  min?: number;
  max?: number;
}

/** Rounds to 1, 2 or 5 times a power of ten, so a bound reads like a price somebody would say. */
function nice(n: number): number {
  if (n <= 0) return 0;
  const power = 10 ** Math.floor(Math.log10(n));
  const f = n / power;
  const step = f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10;
  return step * power;
}

/**
 * Price bands drawn from the prices actually on offer.
 *
 * Fixed bands cannot work across trades: painting is priced per square foot in
 * tens of rupees and furniture per piece in lakhs, so "under ₹10,000" is every
 * painting job and almost no wardrobe. Quartiles of the trade's own prices give
 * four bands that each hold something.
 */
export function priceBuckets(prices: number[], format: (n: number) => string): PriceBucket[] {
  const sorted = prices.filter((p) => p > 0).sort((a, b) => a - b);
  if (sorted.length < 4) return [];

  const at = (f: number) => nice(sorted[Math.floor((sorted.length - 1) * f)]!);
  const cuts = [...new Set([at(0.25), at(0.5), at(0.75)])].filter((c) => c > 0).sort((a, b) => a - b);
  if (cuts.length === 0) return [];

  const buckets: PriceBucket[] = cuts.map((cut, i) => {
    const lower = i === 0 ? undefined : cuts[i - 1];
    return {
      key: `${lower ?? ""}-${cut}`,
      label: lower === undefined ? `Under ${format(cut)}` : `${format(lower)} – ${format(cut)}`,
      min: lower,
      max: cut,
    };
  });

  const top = cuts[cuts.length - 1]!;
  buckets.push({ key: `${top}-`, label: `${format(top)} and above`, min: top });
  return buckets;
}

/** A whole, non-negative number from a query string, or undefined. */
export function toWhole(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** A `min-max` price key back into bounds. */
export function parsePriceKey(key: string | undefined): { min?: number; max?: number } {
  if (!key) return {};
  const [lo, hi] = key.split("-");
  const min = toWhole(lo);
  const max = toWhole(hi);
  return { min: min || undefined, max: max || undefined };
}

/** A rating floor from a query string, only for the values the sidebar offers. */
export function toRating(value: string | undefined): number | undefined {
  const n = Number(value);
  return [3, 3.5, 4, 4.5].includes(n) ? n : undefined;
}

/**
 * A link to this listing with some parameters changed.
 *
 * `undefined` or an empty string removes a parameter, which is how the chips
 * above the results take a single filter away.
 */
export function hrefWith(
  path: string,
  params: Record<string, string | undefined>,
  changes: Record<string, string | undefined> = {},
): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, ...changes })) {
    if (value) next.set(key, value);
  }
  const qs = next.toString();
  return qs ? `${path}?${qs}` : path;
}
