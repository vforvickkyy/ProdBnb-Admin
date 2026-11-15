"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

/**
 * A small, dependency-free line chart following the console's dataviz rules:
 * one y-axis only; 2px lines with round joins; end dots (r=4) wearing a 2px surface ring; a ~10%
 * area wash for a single series; hairline solid gridlines; text in text tokens, never series
 * colours; a legend whenever there are 2+ series; a crosshair + one tooltip listing every series at
 * the hovered X (pointer or keyboard); and a table view so no value is hover-only.
 */

export interface LineSeries {
  key: string;
  label: string;
  /** A validated categorical slot (see the analytics page). */
  color: string;
  values: number[];
}

const SURFACE = "#ffffff";
const GRID = "#e1e0d9";
const AXIS = "#c3c2b7";
const MUTED = "#898781";
const SECONDARY = "#52514e";

function niceStep(max: number, ticks = 4): number {
  if (max <= 0) return 1;
  const raw = max / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const residual = raw / magnitude;
  const nice = residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1;
  return Math.max(1, nice * magnitude);
}

export function LineChart({
  title,
  labels,
  series,
  formatValue,
  formatLabel = (l) => l,
  height = 220,
}: {
  title: string;
  labels: string[];
  series: LineSeries[];
  formatValue: (v: number) => string;
  formatLabel?: (label: string) => string;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const titleId = useId();

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => entry && setWidth(Math.max(280, entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const margin = { top: 12, right: 16, bottom: 28, left: 56 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const { step, top } = useMemo(() => {
    const max = Math.max(0, ...series.flatMap((s) => s.values));
    const s = niceStep(max);
    return { step: s, top: Math.max(s, Math.ceil(max / s) * s) };
  }, [series]);

  const n = labels.length;
  const x = (i: number) => (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => innerH - (v / top) * innerH;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  // Show at most ~6 x labels so they never collide.
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 90))));

  function indexFromPointer(clientX: number, rect: DOMRect): number {
    const px = clientX - rect.left - margin.left;
    if (n <= 1) return 0;
    return Math.min(n - 1, Math.max(0, Math.round((px / innerW) * (n - 1))));
  }

  const single = series.length === 1;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 id={titleId} className="text-sm font-semibold text-slate-800">
          {title}
        </h3>
        <div className="flex items-center gap-4">
          {!single && (
            <ul className="flex flex-wrap gap-3 text-xs" style={{ color: SECONDARY }} aria-label="Legend">
              {series.map((s) => (
                <li key={s.key} className="flex items-center gap-1.5">
                  <span aria-hidden className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} />
                  {s.label}
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => setShowTable((v) => !v)} className="text-xs text-slate-500 underline hover:text-slate-800">
            {showTable ? "Show chart" : "Show table"}
          </button>
        </div>
      </div>

      {showTable ? (
        <div className="max-h-72 overflow-auto rounded border border-slate-200">
          <table className="w-full text-sm">
            <caption className="sr-only">{title}</caption>
            <thead className="sticky top-0 bg-slate-50 text-left text-slate-600">
              <tr>
                <th scope="col" className="px-3 py-1.5 font-medium">Period</th>
                {series.map((s) => (
                  <th key={s.key} scope="col" className="px-3 py-1.5 text-right font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100" style={{ fontVariantNumeric: "tabular-nums" }}>
              {labels.map((label, i) => (
                <tr key={label}>
                  <td className="px-3 py-1">{formatLabel(label)}</td>
                  {series.map((s) => (
                    <td key={s.key} className="px-3 py-1 text-right">
                      {formatValue(s.values[i] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={containerRef} className="relative">
          <svg
            width={width}
            height={height}
            role="img"
            aria-labelledby={titleId}
            tabIndex={0}
            className="block max-w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            onPointerMove={(e) => setHover(indexFromPointer(e.clientX, e.currentTarget.getBoundingClientRect()))}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover((h) => h ?? n - 1)}
            onBlur={() => setHover(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n - 1) - 1));
              if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? 0) + 1));
            }}
          >
            <g transform={`translate(${margin.left},${margin.top})`}>
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={0} x2={innerW} y1={y(t)} y2={y(t)} stroke={t === 0 ? AXIS : GRID} strokeWidth={1} />
                  <text x={-8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={MUTED} style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatValue(t)}
                  </text>
                </g>
              ))}
              {labels.map((label, i) =>
                // The last label always shows; a regular one too close to it is dropped so they never collide.
                (i % labelEvery === 0 && n - 1 - i >= Math.ceil(labelEvery / 2)) || i === n - 1 ? (
                  <text key={label} x={x(i)} y={innerH + 18} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize={11} fill={MUTED}>
                    {formatLabel(label)}
                  </text>
                ) : null
              )}

              {series.map((s) => {
                const points = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
                return (
                  <g key={s.key}>
                    {single && n > 1 && (
                      <polygon points={`${x(0)},${y(0)} ${points} ${x(n - 1)},${y(0)}`} fill={s.color} fillOpacity={0.1} />
                    )}
                    <polyline points={points} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                    {n > 0 && (
                      <circle cx={x(n - 1)} cy={y(s.values[n - 1] ?? 0)} r={4} fill={s.color} stroke={SURFACE} strokeWidth={2} />
                    )}
                  </g>
                );
              })}

              {hover !== null && (
                <g pointerEvents="none">
                  <line x1={x(hover)} x2={x(hover)} y1={0} y2={innerH} stroke={AXIS} strokeWidth={1} />
                  {series.map((s) => (
                    <circle key={s.key} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4} fill={s.color} stroke={SURFACE} strokeWidth={2} />
                  ))}
                </g>
              )}
            </g>
          </svg>

          {hover !== null && labels[hover] !== undefined && (
            <div
              role="status"
              className="pointer-events-none absolute top-1 z-10 min-w-[140px] rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md"
              style={{
                left: Math.min(width - 160, Math.max(0, margin.left + x(hover) + 12)),
              }}
            >
              <div className="mb-1 text-slate-500">{formatLabel(labels[hover]!)}</div>
              {series.map((s) => (
                <div key={s.key} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <span aria-hidden className="inline-block h-0.5 w-3 rounded" style={{ background: s.color }} />
                    {s.label}
                  </span>
                  <strong className="text-slate-900">{formatValue(s.values[hover] ?? 0)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
