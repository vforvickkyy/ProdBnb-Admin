"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/** Multi-select as toggleable chips -- each chip is a checkbox for assistive tech. */
export function ChipSelect({
  label,
  options,
  selected,
  onChange,
  max,
}: {
  label: string;
  options: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  max?: number;
}) {
  const atMax = max !== undefined && selected.length >= max;
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-slate-700">
        {label}
        <span className="ml-2 text-xs font-normal text-slate-500">
          {selected.length} selected{max !== undefined ? ` · up to ${max}` : ""}
        </span>
      </legend>
      {options.length === 0 ? (
        <p className="text-sm text-slate-500">No options yet — add some in Catalog.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const on = selected.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                disabled={!on && atMax}
                onClick={() => onChange(on ? selected.filter((id) => id !== option.id) : [...selected, option.id])}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-40",
                  on ? "border-brand-500 bg-brand-50 text-brand-800" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400",
                )}
              >
                {on && <Check aria-hidden className="h-3.5 w-3.5" />}
                {option.name}
              </button>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
