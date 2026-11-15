/**
 * Ranked horizontal bars (a "meter list"): a name, a bar and a figure per row, bars sharing one
 * baseline so parts compare exactly. One hue; 10px bars with a rounded data end; the value is
 * printed at every row (this form labels each row by design), in text ink, not the bar colour.
 */
export function BarList({
  title,
  rows,
  formatValue,
  color = "#2a78d6",
  emptyText = "No data for this range.",
}: {
  title: string;
  rows: { label: string; value: number; href?: string }[];
  formatValue: (v: number) => string;
  color?: string;
  emptyText?: string;
}) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-slate-800">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">{emptyText}</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((row) => (
            // Fixed name and value columns, so every bar track is the same length and all bars share one baseline.
            <li key={row.label} className="grid grid-cols-[minmax(0,9rem)_1fr_4.5rem] items-center gap-3 text-sm" title={`${row.label}: ${formatValue(row.value)}`}>
              <span className="truncate text-slate-700">{row.label}</span>
              <span className="h-2.5 rounded-r bg-slate-100">
                <span
                  className="block h-2.5 rounded-r"
                  style={{ width: max > 0 ? `${Math.max(2, (row.value / max) * 100)}%` : "0%", background: color }}
                />
              </span>
              <span className="text-right text-slate-800" style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatValue(row.value)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
