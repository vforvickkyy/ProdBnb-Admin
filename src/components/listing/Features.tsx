"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { INPUT_CLASS } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

export interface FeatureOption {
  id: string;
  name: string;
  kind?: "amenity" | "rule";
  group_name?: string | null;
  position?: number;
}

/** Options of one kind, in the catalog's order, split under their group headings. */
export function groupFeatures(options: FeatureOption[], kind: "amenity" | "rule"): { heading: string; items: FeatureOption[] }[] {
  const wanted = options
    .filter((o) => (o.kind ?? "amenity") === kind)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name));
  const groups: { heading: string; items: FeatureOption[] }[] = [];
  for (const option of wanted) {
    const heading = option.group_name?.trim() || "Other";
    const found = groups.find((g) => g.heading === heading);
    if (found) found.items.push(option);
    else groups.push({ heading, items: [option] });
  }
  return groups;
}

/** Tick-boxes under group headings (Rooms and facilities, Power and internet, ...). */
export function GroupedChecks({
  label,
  hint,
  options,
  kind,
  selected,
  onChange,
  emptyText,
}: {
  label: string;
  hint?: string;
  options: FeatureOption[];
  kind: "amenity" | "rule";
  selected: string[];
  onChange: (ids: string[]) => void;
  emptyText?: string;
}) {
  const groups = groupFeatures(options, kind);
  const chosen = options.filter((o) => (o.kind ?? "amenity") === kind && selected.includes(o.id)).length;
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-slate-700">
        {label}
        <span className="ml-2 text-xs font-normal text-slate-500">{chosen} ticked</span>
      </legend>
      {hint && <p className="mb-3 text-xs text-slate-500">{hint}</p>}
      {groups.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyText ?? "No options yet — add some in Catalog."}</p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.heading}>
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{group.heading}</h4>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((item) => {
                  const on = selected.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => onChange(on ? selected.filter((id) => id !== item.id) : [...selected, item.id])}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400",
                        on ? "border-accent-500 bg-accent-50 text-accent-700" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                          on ? "border-accent-500 bg-accent-500 text-snow" : "border-slate-300 bg-white",
                        )}
                      >
                        {on && <Check className="h-3 w-3" />}
                      </span>
                      {item.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </fieldset>
  );
}

/** Free-text points the tick-boxes don't cover ("Rooftop water tank", "No shoes inside"). */
export function CustomPoints({
  label,
  hint,
  values,
  onChange,
  placeholder,
  max = 20,
}: {
  label: string;
  hint?: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  max?: number;
}) {
  const [draft, setDraft] = useState("");
  const text = draft.trim();
  const duplicate = text !== "" && values.some((v) => v.toLowerCase() === text.toLowerCase());
  const full = values.length >= max;

  function add() {
    if (!text || duplicate || full) return;
    onChange([...values, text]);
    setDraft("");
  }

  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-slate-700">
        {label}
        <span className="ml-2 text-xs font-normal text-slate-500">
          {values.length} of {max}
        </span>
      </legend>
      {hint && <p className="mb-2 text-xs text-slate-500">{hint}</p>}
      {values.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2">
          {values.map((value) => (
            <li
              key={value}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-1.5 text-sm text-slate-800"
            >
              {value}
              <button
                type="button"
                aria-label={`Remove ${value}`}
                onClick={() => onChange(values.filter((v) => v !== value))}
                className="rounded-full p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
              >
                <X aria-hidden className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          aria-label={`Add to ${label}`}
          className={INPUT_CLASS}
          value={draft}
          maxLength={120}
          placeholder={placeholder ?? "Type a point and press Enter"}
          disabled={full}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" onClick={add} disabled={!text || duplicate || full}>
          <Plus aria-hidden className="h-4 w-4" /> Add
        </Button>
      </div>
      {duplicate && <p className="mt-1.5 text-xs text-red-700">That one is already listed.</p>}
    </fieldset>
  );
}
