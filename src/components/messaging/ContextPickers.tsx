"use client";

import { useState } from "react";
import useSWR from "swr";
import { MapPin, TicketPercent, X } from "lucide-react";
import { TextField } from "@/components/ui/Field";
import { adminApi, unwrap, unwrapPaginated } from "@/lib/api";
import type { components } from "@/types/admin-api";

export interface PickedListing {
  id: string;
  title: string;
  city: string | null;
}
type Coupon = components["schemas"]["Coupon"];

function Picked({ icon: Icon, title, sub, onClear }: { icon: typeof MapPin; title: string; sub?: string | null; onClear: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-accent-200 bg-accent-50 px-3 py-2">
      <Icon aria-hidden className="h-4 w-4 shrink-0 text-accent-700" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{title}</p>
        {sub && <p className="truncate text-xs text-slate-500">{sub}</p>}
      </div>
      <button type="button" onClick={onClear} aria-label={`Remove ${title}`} className="rounded-md p-1 text-slate-500 hover:bg-white hover:text-slate-900">
        <X aria-hidden className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Pick the one listing a message is about. */
export function ListingPicker({ value, onChange }: { value: PickedListing | null; onChange: (l: PickedListing | null) => void }) {
  const [search, setSearch] = useState("");
  const term = search.trim();
  const { data, isLoading } = useSWR(value ? null : `/v1/admin/locations?search=${term}&status=published&picker`, () =>
    adminApi
      .GET("/locations", { params: { query: { page: 1, pageSize: 8, status: "published", ...(term ? { search: term } : {}) } as never } })
      .then((r) => unwrapPaginated<PickedListing>(r).data),
  );
  if (value) return <Picked icon={MapPin} title={value.title} sub={value.city} onClear={() => onChange(null)} />;
  return (
    <div>
      <TextField label="Listing" placeholder="Search published listings" value={search} onChange={(e) => setSearch(e.target.value)} />
      <ul className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-200" aria-label="Listings" aria-busy={isLoading}>
        {data?.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">No published listings match.</li>}
        {(data ?? []).map((l) => (
          <li key={l.id}>
            <button type="button" onClick={() => onChange({ id: l.id, title: l.title, city: l.city })} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50">
              <span className="truncate">{l.title}</span>
              <span className="shrink-0 text-xs text-slate-500">{l.city}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Pick the offer (coupon) a message is about: running or upcoming ones. */
export function OfferPicker({ value, onChange }: { value: string | null; onChange: (id: string | null, coupon: Coupon | null) => void }) {
  const { data } = useSWR("/v1/admin/coupons?picker", () => adminApi.GET("/coupons", { params: { query: { owner: "all", status: "all", page: 1, pageSize: 100 } } }).then(unwrapPaginated<Coupon>));
  const usable = (data?.data ?? []).filter((c) => c.status === "active" || c.status === "scheduled");
  const picked = value ? (data?.data ?? []).find((c) => c.id === value) : null;
  if (value) {
    return <Picked icon={TicketPercent} title={picked ? `${picked.code} · ${picked.title}` : "Offer"} sub={picked?.status === "scheduled" ? "Starts later" : null} onClear={() => onChange(null, null)} />;
  }
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium text-slate-700">Offer</p>
      {data && usable.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">No running offers. Create one under Payments → Coupons & offers.</p>
      ) : (
        <ul className="max-h-56 overflow-y-auto rounded-lg border border-slate-200" aria-label="Offers">
          {usable.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => onChange(c.id, c)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50">
                <span className="truncate">
                  <span className="font-mono font-semibold">{c.code}</span> · {c.title}
                </span>
                <span className="shrink-0 text-xs text-slate-500">{c.owner_type === "platform" ? "Ours" : "Host"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export async function loadListing(id: string): Promise<PickedListing | null> {
  try {
    const l = await adminApi.GET("/locations/{id}", { params: { path: { id } } } as never).then((r) => unwrap<PickedListing>(r as never));
    return { id: l.id, title: l.title, city: l.city };
  } catch {
    return null;
  }
}
