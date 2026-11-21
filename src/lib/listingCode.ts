/**
 * Listing IDs (HKLS01): a prefix, then a number padded to a set number of digits. The team sets the
 * prefix, the digits and the next number in Settings; the backend hands them out. They are internal:
 * only the host and the team ever see one.
 */
export const LISTING_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,19}$/;

/** HKLS + 7 with 2 digits -> HKLS07. A number that outgrows the digits just gets longer (HKLS100). */
export function formatListingCode(prefix: string, digits: number, n: number): string {
  return `${prefix}${String(n).padStart(digits, "0")}`;
}

/** What the team typed, tidied the way the backend will read it. */
export function normalizeListingCode(value: string): string {
  return value.trim().toUpperCase();
}

export function listingCodeError(value: string): string | undefined {
  const code = normalizeListingCode(value);
  if (!code) return undefined;
  if (!LISTING_CODE_PATTERN.test(code)) return "Use 2–20 letters, numbers or dashes, e.g. HKLS07.";
  return undefined;
}
