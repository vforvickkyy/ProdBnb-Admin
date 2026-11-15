/** Shared display helpers for the Admin Console. Amounts are always integer minor units. */

export function formatMoney(minorUnits: number, currency = "INR", options: { compact?: boolean } = {}): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: options.compact ? 1 : 2,
    notation: options.compact ? "compact" : "standard",
  }).format(minorUnits / 100);
}

export function formatCount(value: number, options: { compact?: boolean } = {}): string {
  return new Intl.NumberFormat("en-IN", { notation: options.compact ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

export function formatPercent(fraction: number | null | undefined, digits = 1): string {
  if (fraction === null || fraction === undefined) return "—";
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function bpsToPercent(bps: number): number {
  return bps / 100;
}

export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

export function personName(n: { first_name: string | null; last_name: string | null } | null | undefined): string {
  if (!n) return "—";
  return [n.first_name, n.last_name].filter(Boolean).join(" ") || "(no name)";
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

/** "in 12 min" / "3 h ago" -- for hold countdowns and freshness. */
export function relativeTime(value: string, now: number = Date.now()): string {
  const diffMs = new Date(value).getTime() - now;
  const abs = Math.abs(diffMs);
  const minutes = Math.round(abs / 60_000);
  const text = minutes < 60 ? `${minutes} min` : minutes < 48 * 60 ? `${Math.round(minutes / 60)} h` : `${Math.round(minutes / 1440)} d`;
  return diffMs >= 0 ? `in ${text}` : `${text} ago`;
}

export function humanize(value: string): string {
  return value.replace(/_/g, " ").toLowerCase();
}
