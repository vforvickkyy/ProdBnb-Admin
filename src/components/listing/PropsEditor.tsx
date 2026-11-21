"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { INPUT_CLASS } from "@/components/ui/Field";
import type { components } from "@/types/admin-api";

export type ListingProp = components["schemas"]["ListingProp"];
export type PropUnit = "per_booking" | "per_hour" | "per_day";

/** One prop as typed in the form: the price in rupees, as text. */
export interface PropRow {
  key: string;
  name: string;
  kind: "included" | "addon";
  price: string;
  unit: PropUnit;
  note: string;
}

export const MAX_PROPS = 40;

let counter = 0;
const newKey = () => `prop-${Date.now()}-${counter++}`;

export function emptyProp(kind: PropRow["kind"] = "included"): PropRow {
  return { key: newKey(), name: "", kind, price: "", unit: "per_booking", note: "" };
}

const rupees = (minor: number) => String(Number.isInteger(minor / 100) ? minor / 100 : (minor / 100).toFixed(2));

export function propsFromListing(props: ListingProp[] | undefined): PropRow[] {
  return (props ?? []).map((p) => ({
    key: newKey(),
    name: p.name,
    kind: p.kind,
    price: p.price_minor_units === null ? "" : rupees(p.price_minor_units),
    unit: p.price_unit ?? "per_booking",
    note: p.note ?? "",
  }));
}

/** Rows -> the API's body. Blank rows are dropped; the price counts only for add-ons. */
export function propsToBody(rows: PropRow[]): ListingProp[] {
  return rows
    .filter((r) => r.name.trim() !== "")
    .map((r) => {
      const price = r.kind === "addon" && r.price.trim() !== "" ? Math.round(Number(r.price) * 100) : null;
      return {
        name: r.name.trim(),
        kind: r.kind,
        price_minor_units: price,
        price_unit: price === null ? null : r.unit,
        note: r.note.trim() || null,
      };
    });
}

export function validateProps(rows: PropRow[]): string | undefined {
  const filled = rows.filter((r) => r.name.trim() !== "");
  const seen = new Set<string>();
  for (const row of filled) {
    const name = row.name.trim().toLowerCase();
    if (seen.has(name)) return `“${row.name.trim()}” is listed twice.`;
    seen.add(name);
    if (row.kind === "addon" && row.price.trim() !== "" && (!Number.isFinite(Number(row.price)) || Number(row.price) < 0)) {
      return `Check the price for “${row.name.trim()}”.`;
    }
  }
  if (filled.length > MAX_PROPS) return `At most ${MAX_PROPS} props.`;
  return undefined;
}

const UNIT_LABEL: Record<PropUnit, string> = { per_booking: "per booking", per_hour: "per hour", per_day: "per day" };

function Section({
  title,
  description,
  kind,
  rows,
  onChange,
}: {
  title: string;
  description: string;
  kind: PropRow["kind"];
  rows: PropRow[];
  onChange: (rows: PropRow[]) => void;
}) {
  const mine = rows.filter((r) => r.kind === kind);
  const update = (key: string, patch: Partial<PropRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mb-3 text-xs text-slate-500">{description}</p>
      {mine.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500">None added yet.</p>
      ) : (
        <ul className="space-y-3">
          {mine.map((row) => (
            <li key={row.key} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  aria-label="Prop name"
                  className={INPUT_CLASS}
                  placeholder={kind === "included" ? "e.g. Sofa set" : "e.g. Fog machine"}
                  maxLength={80}
                  value={row.name}
                  onChange={(e) => update(row.key, { name: e.target.value })}
                />
                <button
                  type="button"
                  aria-label={`Remove ${row.name || "this prop"}`}
                  onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
                  className="justify-self-end rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 aria-hidden className="h-4 w-4" />
                </button>
              </div>
              {kind === "addon" && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs text-slate-600">
                    Price (₹) — leave empty for “ask the host”
                    <input
                      aria-label={`Price in rupees for ${row.name || "this prop"}`}
                      className={`${INPUT_CLASS} mt-1`}
                      inputMode="decimal"
                      value={row.price}
                      placeholder="e.g. 1500"
                      onChange={(e) => update(row.key, { price: e.target.value.replace(/[^\d.]/g, "") })}
                    />
                  </label>
                  <label className="block text-xs text-slate-600">
                    Charged
                    <select
                      aria-label={`How ${row.name || "this prop"} is charged`}
                      className={`${INPUT_CLASS} mt-1`}
                      value={row.unit}
                      onChange={(e) => update(row.key, { unit: e.target.value as PropUnit })}
                    >
                      {(Object.keys(UNIT_LABEL) as PropUnit[]).map((u) => (
                        <option key={u} value={u}>
                          {UNIT_LABEL[u]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              <input
                aria-label={`Note for ${row.name || "this prop"}`}
                className={`${INPUT_CLASS} mt-3`}
                placeholder="Optional note, e.g. “2 available”"
                maxLength={200}
                value={row.note}
                onChange={(e) => update(row.key, { note: e.target.value })}
              />
            </li>
          ))}
        </ul>
      )}
      <Button type="button" className="mt-3" onClick={() => onChange([...rows, emptyProp(kind)])} disabled={rows.length >= MAX_PROPS}>
        <Plus aria-hidden className="h-4 w-4" /> Add {kind === "included" ? "an included prop" : "a prop for hire"}
      </Button>
    </section>
  );
}

/** Props that come with the place, and props the host can provide for a price. */
export function PropsEditor({ rows, onChange }: { rows: PropRow[]; onChange: (rows: PropRow[]) => void }) {
  return (
    <div className="space-y-8">
      <Section
        title="Props included"
        description="Furniture and set dressing that comes with the booking at no extra charge."
        kind="included"
        rows={rows}
        onChange={onChange}
      />
      <Section
        title="Props available for an extra price"
        description="Things the host can bring or arrange. Add a price, or leave it empty for bookers to ask."
        kind="addon"
        rows={rows}
        onChange={onChange}
      />
    </div>
  );
}
