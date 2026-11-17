"use client";

import { useState } from "react";
import useSWR from "swr";
import { Plus } from "lucide-react";
import { Segmented } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/Switch";
import { adminApi, unwrap } from "@/lib/api";
import { cn } from "@/lib/cn";


export type Profession = "producer" | "director" | "cinematographer" | "photographer" | "production_house" | "ad_agency" | "content_creator" | "art_director" | "location_manager" | "student" | "location_owner" | "other";

export interface Segment {
  type: "segment";
  role?: "booker" | "host";
  professions?: Profession[];
  cities?: string[];
  use_case_ids?: string[];
  booked?: "yes" | "no";
  new_listing_alerts?: boolean;
}

function loadOptions() {
  return adminApi.GET("/campaigns/audience-options").then(unwrap);
}

export function useAudienceOptions() {
  return useSWR("/v1/admin/campaigns/audience-options", loadOptions, { revalidateOnFocus: false });
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
        on ? "border-accent-500 bg-accent-50 text-accent-800" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
      )}
    >
      {children}
    </button>
  );
}

const toggle = <T,>(list: T[] | undefined, v: T): T[] => ((list ?? []).includes(v) ? (list ?? []).filter((x) => x !== v) : [...(list ?? []), v]);
const clean = (s: Segment): Segment => {
  const out: Segment = { type: "segment" };
  if (s.role) out.role = s.role;
  if (s.professions?.length) out.professions = s.professions;
  if (s.cities?.length) out.cities = s.cities;
  if (s.use_case_ids?.length) out.use_case_ids = s.use_case_ids;
  if (s.booked) out.booked = s.booked;
  if (s.new_listing_alerts) out.new_listing_alerts = true;
  return out;
};

/** Filters on who people are (from onboarding) and what they've done. Empty filters = everyone. */
export function SegmentBuilder({ value, onChange }: { value: Segment; onChange: (s: Segment) => void }) {
  const { data: options } = useAudienceOptions();
  const [city, setCity] = useState("");
  const set = (patch: Partial<Segment>) => onChange(clean({ ...value, ...patch }));
  const addCity = () => {
    const c = city.trim();
    if (c && !(value.cities ?? []).some((x) => x.toLowerCase() === c.toLowerCase())) set({ cities: [...(value.cities ?? []), c] });
    setCity("");
  };
  const knownCities = (options?.cities ?? []).slice(0, 12);
  const extraCities = (value.cities ?? []).filter((c) => !knownCities.some((k) => k.name.toLowerCase() === c.toLowerCase()));

  return (
    <div className="space-y-5 rounded-lg border border-slate-200 p-4">
      {options && (
        <p className="text-xs text-slate-500">
          {options.onboarded} people have told us what they do. Filters left empty don&apos;t narrow anything; within one filter, any match counts.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Segmented<"any" | "booker" | "host">
          label="Who"
          value={value.role ?? "any"}
          onChange={(v) => set({ role: v === "any" ? undefined : v })}
          options={[
            { value: "any", label: "Anyone" },
            { value: "booker", label: "Bookers" },
            { value: "host", label: "Hosts" },
          ]}
        />
        <Segmented<"any" | "yes" | "no">
          label="Booked before"
          value={value.booked ?? "any"}
          onChange={(v) => set({ booked: v === "any" ? undefined : v })}
          options={[
            { value: "any", label: "Booked or not" },
            { value: "yes", label: "Has booked" },
            { value: "no", label: "Never booked" },
          ]}
        />
      </div>

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-slate-700">What they do</legend>
        <div className="flex flex-wrap gap-1.5">
          {(options?.professions ?? []).map((p) => (
            <Chip key={p.value} on={(value.professions ?? []).includes(p.value as Profession)} onClick={() => set({ professions: toggle(value.professions, p.value as Profession) })}>
              {p.label}
              <span className="tabular-nums text-slate-400">{p.count}</span>
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-slate-700">Cities</legend>
        <div className="flex flex-wrap gap-1.5">
          {knownCities.map((c) => (
            <Chip
              key={c.name}
              on={(value.cities ?? []).some((x) => x.toLowerCase() === c.name.toLowerCase())}
              onClick={() =>
                set({
                  cities: (value.cities ?? []).some((x) => x.toLowerCase() === c.name.toLowerCase())
                    ? (value.cities ?? []).filter((x) => x.toLowerCase() !== c.name.toLowerCase())
                    : [...(value.cities ?? []), c.name],
                })
              }
            >
              {c.name}
              <span className="tabular-nums text-slate-400">{c.count}</span>
            </Chip>
          ))}
          {extraCities.map((c) => (
            <Chip key={c} on onClick={() => set({ cities: (value.cities ?? []).filter((x) => x !== c) })}>
              {c}
            </Chip>
          ))}
          <span className="inline-flex items-center gap-1">
            <input
              aria-label="Add a city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCity();
                }
              }}
              placeholder="Another city"
              className="h-7 w-32 rounded-full border border-slate-200 px-2.5 text-xs focus:border-accent-500 focus:outline-none"
            />
            <button type="button" onClick={addCity} aria-label="Add city" className="rounded-full p-1 text-slate-500 hover:bg-slate-100">
              <Plus aria-hidden className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
        <p className="mt-1.5 text-xs text-slate-500">Matches the cities people chose when signing up, or their address.</p>
      </fieldset>

      {(options?.use_cases ?? []).length > 0 && (
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-slate-700">What they shoot</legend>
          <div className="flex flex-wrap gap-1.5">
            {options!.use_cases.map((u) => (
              <Chip key={u.id} on={(value.use_case_ids ?? []).includes(u.id)} onClick={() => set({ use_case_ids: toggle(value.use_case_ids, u.id) })}>
                {u.name}
                <span className="tabular-nums text-slate-400">{u.count}</span>
              </Chip>
            ))}
          </div>
        </fieldset>
      )}

      <Switch
        checked={Boolean(value.new_listing_alerts)}
        onChange={(v) => set({ new_listing_alerts: v || undefined })}
        label="Only people who want new-listing alerts"
        description="Leaves out anyone who turned off alerts about new locations."
      />
    </div>
  );
}
