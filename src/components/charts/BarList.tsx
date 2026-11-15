import Link from "next/link";

/**
 * Ranked horizontal bars (a "meter list", Framer/Plausible style): each row's bar sits behind its
 * name as a soft wash of one hue, all bars growing from the same left baseline so parts compare
 * exactly; 24px bars with a rounded data end; the value printed at every row in text ink, never the
 * bar colour.
 */
export function BarList({
  title,
  rows,
  formatValue,
  color = "var(--viz-1)",
  emptyText = "No data for this range.",
  valueHeader,
}: {
  /** Omit when the surrounding card already names the list (e.g. under pill tabs). */
  title?: string;
  rows: { label: string; value: number; href?: string; hint?: string }[];
  formatValue: (v: number) => string;
  color?: string;
  emptyText?: string;
  /** Small right-aligned column heading, e.g. "Bookings". */
  valueHeader?: string;
}) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  return (
    <div>
      {title && <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>}
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">{emptyText}</p>
      ) : (
        <>
          {valueHeader && (
            <div className="mb-1.5 flex justify-end px-1 text-2xs font-medium uppercase tracking-wider text-slate-400">{valueHeader}</div>
          )}
          <ul className="space-y-1">
            {rows.map((row) => {
              const name = row.href ? (
                <Link href={row.href} className="truncate hover:underline">
                  {row.label}
                </Link>
              ) : (
                <span className="truncate">{row.label}</span>
              );
              return (
                <li key={row.label} className="flex items-center gap-3 text-[13px]" title={`${row.label}: ${formatValue(row.value)}`}>
                  <div className="relative flex h-7 min-w-0 flex-1 items-center">
                    <span
                      aria-hidden
                      className="absolute inset-y-0.5 left-0 rounded-r-[4px]"
                      style={{ width: max > 0 ? `${Math.max(1.5, (row.value / max) * 100)}%` : "0%", background: color, opacity: 0.22 }}
                    />
                    <span className="relative flex min-w-0 items-baseline gap-2 px-2.5 text-slate-800">
                      {name}
                      {row.hint && <span className="shrink-0 text-xs text-slate-500">{row.hint}</span>}
                    </span>
                  </div>
                  <span className="w-16 shrink-0 text-right font-medium text-slate-900" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatValue(row.value)}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
