import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Stat tile: label (sentence case), value (semibold, proportional figures), optional hint.
 * `tone="attention"` marks a number that needs someone to act on it -- always paired with the hint
 * text, never colour alone.
 */
export function StatTile({
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  href?: string;
  tone?: "default" | "attention";
}) {
  const body = (
    <>
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      {hint && <div className={cn("mt-1 text-xs", tone === "attention" ? "font-medium text-brand-700" : "text-slate-500")}>{hint}</div>}
    </>
  );
  const className = cn(
    "block rounded-lg border bg-white p-4 shadow-sm",
    tone === "attention" ? "border-brand-300 ring-1 ring-brand-200" : "border-slate-200",
    href && "transition-colors hover:border-slate-300 hover:bg-slate-50"
  );
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
