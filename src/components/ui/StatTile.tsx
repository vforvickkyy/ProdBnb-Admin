import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Stat tile: label (sentence case), value (semibold, tabular figures), optional hint.
 * `tone="attention"` marks a number that needs someone to act on it -- an amber dot plus the hint
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
      <div className="flex items-center gap-1.5 text-[13px] text-slate-500">
        {tone === "attention" && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
        {label}
      </div>
      <div className="mt-2 text-[26px] font-semibold leading-none tracking-tight text-slate-900 tabular-nums">{value}</div>
      {hint && <div className={cn("mt-2 text-xs", tone === "attention" ? "font-medium text-amber-700" : "text-slate-500")}>{hint}</div>}
    </>
  );
  const className = cn(
    "block rounded-xl border border-slate-200 bg-white p-5 shadow-card",
    href && "transition-colors hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
  );
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
