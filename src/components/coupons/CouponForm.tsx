"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChipSelect } from "@/components/ui/ChipSelect";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/Switch";
import { HostPicker, type HostCandidate } from "@/components/listing/HostPicker";
import { adminApi, unwrapPaginated } from "@/lib/api";
import type { components } from "@/types/admin-api";
import { BRAND_NAME } from "@/lib/config";

export type Coupon = components["schemas"]["Coupon"];
type Listing = { id: string; title: string; city: string | null; host_id: string };

const TYPES = [
  { id: "hourly", name: "Hourly" },
  { id: "half_day", name: "Half day" },
  { id: "day", name: "Full day" },
  { id: "multi_day", name: "Multi-day" },
];

export interface CouponDraft {
  owner_type: "platform" | "host";
  host: HostCandidate | null;
  code: string;
  title: string;
  description: string;
  discount_type: "percent" | "fixed";
  percent_off: string;
  amount_off: string;
  max_discount: string;
  min_booking: string;
  booking_types: string[];
  starts_on: string;
  ends_on: string;
  usage_limit: string;
  per_user_limit: string;
  first_booking_only: boolean;
  is_public: boolean;
  is_active: boolean;
  location_ids: string[];
}

const rupees = (minor: number | null | undefined) => (minor ? String(minor / 100) : "");
const toMinor = (v: string) => (v.trim() ? Math.round(Number(v) * 100) : null);
const toInt = (v: string) => (v.trim() ? Math.round(Number(v)) : null);
const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");

export function draftFrom(c?: Coupon): CouponDraft {
  return {
    owner_type: c?.owner_type ?? "platform",
    host: c?.host ? ({ id: c.host.id, first_name: c.host.first_name, last_name: c.host.last_name } as HostCandidate) : null,
    code: c?.code ?? "",
    title: c?.title ?? "",
    description: c?.description ?? "",
    discount_type: c?.discount_type ?? "percent",
    percent_off: c?.percent_off ? String(c.percent_off) : "",
    amount_off: rupees(c?.amount_off_minor_units),
    max_discount: rupees(c?.max_discount_minor_units),
    min_booking: rupees(c?.min_booking_minor_units),
    booking_types: c?.booking_types ?? [],
    starts_on: day(c?.starts_at),
    ends_on: day(c?.ends_at),
    usage_limit: c?.usage_limit ? String(c.usage_limit) : "",
    per_user_limit: c?.per_user_limit ? String(c.per_user_limit) : c ? "" : "1",
    first_booking_only: c?.first_booking_only ?? false,
    is_public: c?.is_public ?? false,
    is_active: c?.is_active ?? true,
    location_ids: c?.location_ids ?? [],
  };
}

/** The request body for a draft (dates as the start / end of that day in India). */
export function bodyFrom(d: CouponDraft) {
  return {
    code: d.code.trim().toUpperCase(),
    title: d.title.trim(),
    description: d.description.trim() || null,
    discount_type: d.discount_type,
    percent_off: d.discount_type === "percent" ? toInt(d.percent_off) : null,
    amount_off_minor_units: d.discount_type === "fixed" ? toMinor(d.amount_off) : null,
    max_discount_minor_units: d.discount_type === "percent" ? toMinor(d.max_discount) : null,
    min_booking_minor_units: toMinor(d.min_booking),
    booking_types: d.booking_types.length && d.booking_types.length < 4 ? (d.booking_types as ("hourly" | "half_day" | "day" | "multi_day")[]) : null,
    starts_at: d.starts_on ? `${d.starts_on}T00:00:00+05:30` : null,
    ends_at: d.ends_on ? `${d.ends_on}T23:59:59+05:30` : null,
    usage_limit: toInt(d.usage_limit),
    per_user_limit: toInt(d.per_user_limit),
    first_booking_only: d.first_booking_only,
    is_public: d.is_public,
    is_active: d.is_active,
    location_ids: d.location_ids,
  };
}

export function draftProblem(d: CouponDraft): string | null {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{2,29}$/.test(d.code.trim())) return "Code: 3–30 letters, numbers, - or _.";
  if (!d.title.trim()) return "Give it a title.";
  if (d.owner_type === "host" && !d.host) return "Pick the host.";
  if (d.discount_type === "percent" && !(Number(d.percent_off) >= 1 && Number(d.percent_off) <= 100)) return "Percent off: 1 to 100.";
  if (d.discount_type === "fixed" && !(Number(d.amount_off) > 0)) return "Enter the amount off.";
  if (d.starts_on && d.ends_on && d.ends_on < d.starts_on) return "The end date is before the start.";
  return null;
}

function ListingChooser({ hostId, value, onChange }: { hostId: string | null; value: string[]; onChange: (ids: string[]) => void }) {
  const [search, setSearch] = useState("");
  const key = hostId ? `/v1/admin/locations?host_id=${hostId}&coupon` : search.trim().length >= 2 ? `/v1/admin/locations?search=${search}&coupon` : null;
  const { data } = useSWR(key, () =>
    adminApi
      .GET("/locations", { params: { query: { page: 1, pageSize: 100, ...(hostId ? { host_id: hostId } : { search: search.trim() }) } as never } })
      .then((r) => unwrapPaginated<Listing>(r).data),
  );
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (data) setNames((n) => ({ ...n, ...Object.fromEntries(data.map((l) => [l.id, l.title])) }));
  }, [data]);

  if (hostId) {
    return <ChipSelect label="Listings it covers (none selected = all of this host's listings)" options={(data ?? []).map((l) => ({ id: l.id, name: l.title }))} selected={value} onChange={onChange} />;
  }
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium text-slate-700">Listings it covers</p>
      <p className="mb-2 text-xs text-slate-500">Leave empty for every listing on the site.</p>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-2.5 pr-1 text-xs text-slate-700">
              {names[id] ?? id.slice(0, 8)}
              <button type="button" aria-label="Remove" onClick={() => onChange(value.filter((x) => x !== id))} className="rounded-full p-0.5 hover:bg-slate-200">
                <X aria-hidden className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <TextField label="Add a listing" placeholder="Search listings by name" value={search} onChange={(e) => setSearch(e.target.value)} />
      {data && search.trim().length >= 2 && (
        <ul className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200">
          {data.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">No listings found.</li>}
          {data.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                disabled={value.includes(l.id)}
                onClick={() => onChange([...value, l.id])}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-40"
              >
                <span className="truncate">{l.title}</span>
                <span className="text-xs text-slate-500">{l.city}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Every setting of a coupon, used to create one and to edit it. */
export function CouponForm({ draft, onChange, editing }: { draft: CouponDraft; onChange: (d: CouponDraft) => void; editing?: boolean }) {
  const set = (patch: Partial<CouponDraft>) => onChange({ ...draft, ...patch });
  return (
    <div className="space-y-6">
      <Card title="The offer">
        <div className="grid gap-4 sm:grid-cols-2">
          {!editing && (
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-[13px] font-medium text-slate-700">Who it&apos;s from</p>
              <Segmented<"platform" | "host">
                label="Who it's from"
                value={draft.owner_type}
                onChange={(v) => set({ owner_type: v, host: v === "platform" ? null : draft.host, location_ids: [] })}
                options={[
                  { value: "platform", label: `${BRAND_NAME} (we pay the discount)` },
                  { value: "host", label: "A host (comes out of their earning)" },
                ]}
              />
              {draft.owner_type === "host" && (
                <div className="mt-3">
                  <HostPicker value={draft.host} onChange={(host) => set({ host, location_ids: [] })} />
                </div>
              )}
            </div>
          )}
          <TextField label="Code" value={draft.code} onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/\s/g, "") })} maxLength={30} placeholder="MONSOON20" hint="What bookers type at checkout." />
          <TextField label="Title" value={draft.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} placeholder="Monsoon 20% off" />
          <TextAreaField label="Description (optional)" className="sm:col-span-2" rows={2} value={draft.description} onChange={(e) => set({ description: e.target.value })} maxLength={500} />
        </div>
      </Card>

      <Card title="Discount" description="Comes off the listing price. The service fee and tax are then worked out on the lower price.">
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Type" value={draft.discount_type} onChange={(e) => set({ discount_type: e.target.value as "percent" | "fixed" })}>
            <option value="percent">Percentage</option>
            <option value="fixed">Fixed amount</option>
          </SelectField>
          {draft.discount_type === "percent" ? (
            <>
              <TextField label="Percent off" inputMode="numeric" value={draft.percent_off} onChange={(e) => set({ percent_off: e.target.value.replace(/\D/g, "") })} placeholder="20" />
              <TextField label="Up to ₹ (optional cap)" inputMode="decimal" value={draft.max_discount} onChange={(e) => set({ max_discount: e.target.value.replace(/[^\d.]/g, "") })} placeholder="1000" />
            </>
          ) : (
            <TextField label="Amount off (₹)" inputMode="decimal" value={draft.amount_off} onChange={(e) => set({ amount_off: e.target.value.replace(/[^\d.]/g, "") })} placeholder="500" />
          )}
          <TextField label="Minimum booking (₹, optional)" inputMode="decimal" value={draft.min_booking} onChange={(e) => set({ min_booking: e.target.value.replace(/[^\d.]/g, "") })} hint="On the listing price, before fees." />
        </div>
        <div className="mt-5">
          <ChipSelect label="Booking types (none selected = all)" options={TYPES} selected={draft.booking_types} onChange={(ids) => set({ booking_types: ids })} />
        </div>
      </Card>

      <Card title="When and how often">
        <div className="grid gap-4 sm:grid-cols-4">
          <TextField label="Starts (optional)" type="date" value={draft.starts_on} onChange={(e) => set({ starts_on: e.target.value })} />
          <TextField label="Ends (optional)" type="date" value={draft.ends_on} onChange={(e) => set({ ends_on: e.target.value })} />
          <TextField label="Total uses (optional)" inputMode="numeric" value={draft.usage_limit} onChange={(e) => set({ usage_limit: e.target.value.replace(/\D/g, "") })} placeholder="Unlimited" />
          <TextField label="Uses per person" inputMode="numeric" value={draft.per_user_limit} onChange={(e) => set({ per_user_limit: e.target.value.replace(/\D/g, "") })} placeholder="Unlimited" />
        </div>
        <div className="mt-5 space-y-4">
          <Switch label="First booking only" description="Only for people who haven't paid for a booking before." checked={draft.first_booking_only} onChange={(v) => set({ first_booking_only: v })} />
          <Switch label="Show publicly" description="Listed on the Offers page and on the listings it covers. Otherwise only people you give the code to can use it." checked={draft.is_public} onChange={(v) => set({ is_public: v })} />
          <Switch label="Active" description="Turn off to pause it. Bookings already made keep their discount." checked={draft.is_active} onChange={(v) => set({ is_active: v })} />
        </div>
      </Card>

      <Card title="Where it works">
        <ListingChooser hostId={draft.owner_type === "host" ? (draft.host?.id ?? null) : null} value={draft.location_ids} onChange={(ids) => set({ location_ids: ids })} />
        {draft.owner_type === "host" && !draft.host && <p className="text-sm text-slate-500">Pick the host first.</p>}
      </Card>
    </div>
  );
}

export function SaveBar({ problem, busy, label, onSave }: { problem: string | null; busy: boolean; label: string; onSave: () => void }) {
  return (
    <div className="sticky bottom-4 z-10 mt-6 flex items-center justify-end gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-card backdrop-blur">
      {problem && <p className="mr-auto text-sm text-amber-700">{problem}</p>}
      <Button variant="primary" disabled={busy || Boolean(problem)} onClick={onSave}>
        {busy ? "Saving…" : label}
      </Button>
    </div>
  );
}
