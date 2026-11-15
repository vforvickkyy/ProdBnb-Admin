"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { LineChart } from "./LineChart";

export interface Metric {
  key: string;
  label: string;
  /** Formatted total for the range. */
  value: string;
  /** Change vs the previous period as a fraction (0.12 = +12%), or null when there is nothing to compare. */
  delta: number | null;
  current: number[];
  previous?: number[];
  formatValue: (v: number) => string;
}

/** "+12.4%" / "−3%" with an arrow -- direction is in the glyph and sign, not only the colour. */
export function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null || !Number.isFinite(delta)) return <span className="text-xs text-slate-400">—</span>;
  const up = delta > 0;
  const flat = Math.abs(delta) < 0.0005;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const pct = Math.abs(delta * 100);
  const text = `${up ? "+" : flat ? "" : "−"}${pct >= 10 || flat ? pct.toFixed(0) : pct.toFixed(1)}%`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1 py-px text-xs font-medium tabular-nums",
        flat ? "bg-slate-100 text-slate-600" : up ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700",
      )}
    >
      {!flat && <Icon aria-hidden className="h-3 w-3" />}
      {text}
    </span>
  );
}

/**
 * The Overview's hero (Framer-style): a strip of headline figures that double as tabs, and one
 * chart for the selected figure -- this period as a blue line with a soft wash, the previous period
 * as a dashed grey line behind it.
 */
export function MetricChart({
  metrics,
  selected,
  onSelect,
  labels,
  formatLabel,
  toolbar,
  loading,
}: {
  metrics: Metric[];
  selected: string;
  onSelect: (key: string) => void;
  labels: string[];
  formatLabel: (label: string) => string;
  toolbar?: React.ReactNode;
  loading?: boolean;
}) {
  const active = metrics.find((m) => m.key === selected) ?? metrics[0];
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      <div role="tablist" aria-label="Headline figures" className="grid grid-cols-2 border-b border-slate-200 lg:grid-cols-4">
        {metrics.map((metric, index) => {
          const isActive = metric.key === active?.key;
          return (
            <button
              key={metric.key}
              type="button"
              role="tab"
              id={`metric-${metric.key}`}
              aria-selected={isActive}
              aria-controls="metric-chart"
              onClick={() => onSelect(metric.key)}
              className={cn(
                "relative px-5 py-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-400",
                index % 2 === 1 && "border-l border-slate-200",
                index >= 2 && "border-t border-slate-200 lg:border-t-0",
                index >= 1 && "lg:border-l",
                isActive ? "bg-slate-50" : "hover:bg-slate-50/60",
              )}
            >
              {isActive && <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-accent-500" />}
              <span className="block text-[13px] text-slate-500">{metric.label}</span>
              <span className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{metric.value}</span>
                <DeltaBadge delta={metric.delta} />
              </span>
            </button>
          );
        })}
      </div>
      <div id="metric-chart" role="tabpanel" aria-labelledby={active ? `metric-${active.key}` : undefined} className="p-5">
        {toolbar && <div className="mb-2 flex flex-wrap items-center justify-between gap-3">{toolbar}</div>}
        {active && (
          <div className={cn("transition-opacity", loading && "opacity-50")}>
            <LineChart
              hideTitle
              title={active.label}
              labels={labels}
              formatLabel={formatLabel}
              formatValue={active.formatValue}
              height={260}
              series={[
                { key: "current", label: "This period", color: "var(--viz-1)", values: active.current },
                ...(active.previous ? [{ key: "previous", label: "Previous period", color: "", values: active.previous, variant: "compare" as const }] : []),
              ]}
            />
          </div>
        )}
      </div>
    </section>
  );
}
