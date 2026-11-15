"use client";

import { useMemo } from "react";
import { MapPin } from "lucide-react";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";

export interface ListingDetails {
  title: string;
  description: string;
  capacity: string;
  timezone: string;
  instant_booking_enabled: boolean;
  address_line1: string;
  address_line2: string;
  city: string;
  region: string;
  country: string;
  postal_code: string;
  latitude: string;
  longitude: string;
}

export const EMPTY_DETAILS: ListingDetails = {
  title: "",
  description: "",
  capacity: "",
  timezone: "Asia/Kolkata",
  instant_booking_enabled: false,
  address_line1: "",
  address_line2: "",
  city: "",
  region: "",
  country: "India",
  postal_code: "",
  latitude: "",
  longitude: "",
};

/** Form strings -> the API's body (empty optional strings become null; numbers parsed). */
export function detailsToBody(d: ListingDetails) {
  const opt = (v: string) => (v.trim() ? v.trim() : null);
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  return {
    title: d.title.trim(),
    description: d.description,
    capacity: num(d.capacity),
    timezone: d.timezone,
    instant_booking_enabled: d.instant_booking_enabled,
    address_line1: opt(d.address_line1),
    address_line2: opt(d.address_line2),
    city: d.city.trim(),
    region: opt(d.region),
    country: d.country.trim(),
    postal_code: opt(d.postal_code),
    latitude: num(d.latitude),
    longitude: num(d.longitude),
  };
}

export function detailsFromListing(l: {
  title: string;
  description: string;
  capacity: number | null;
  timezone: string;
  instant_booking_enabled: boolean;
  address_line1: string | null;
  address_line2: string | null;
  city: string;
  region: string | null;
  country: string;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
}): ListingDetails {
  const s = (v: string | number | null) => (v === null || v === undefined ? "" : String(v));
  return {
    title: l.title,
    description: l.description,
    capacity: s(l.capacity),
    timezone: l.timezone,
    instant_booking_enabled: l.instant_booking_enabled,
    address_line1: s(l.address_line1),
    address_line2: s(l.address_line2),
    city: l.city,
    region: s(l.region),
    country: l.country,
    postal_code: s(l.postal_code),
    latitude: s(l.latitude),
    longitude: s(l.longitude),
  };
}

export function validateDetails(d: ListingDetails): Partial<Record<keyof ListingDetails, string>> {
  const errors: Partial<Record<keyof ListingDetails, string>> = {};
  if (!d.title.trim()) errors.title = "A title is required.";
  if (!d.city.trim()) errors.city = "City is required.";
  if (!d.country.trim()) errors.country = "Country is required.";
  if (d.capacity && (!Number.isInteger(Number(d.capacity)) || Number(d.capacity) <= 0)) errors.capacity = "A whole number above 0.";
  if (d.latitude && (Number.isNaN(Number(d.latitude)) || Math.abs(Number(d.latitude)) > 90)) errors.latitude = "Between -90 and 90.";
  if (d.longitude && (Number.isNaN(Number(d.longitude)) || Math.abs(Number(d.longitude)) > 180)) errors.longitude = "Between -180 and 180.";
  return errors;
}

/** "19.0760, 72.8777" (what Google Maps copies) -> [lat, lng]. */
function parseCoordinates(text: string): [string, string] | null {
  const match = text.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  return match ? [match[1]!, match[2]!] : null;
}

export function DetailsForm({
  value,
  onChange,
  errors = {},
  sections = ["basics", "address"],
}: {
  value: ListingDetails;
  onChange: (next: ListingDetails) => void;
  errors?: Partial<Record<keyof ListingDetails, string>>;
  sections?: ("basics" | "address")[];
}) {
  const timezones = useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? ["Asia/Kolkata", "UTC"];
    } catch {
      return ["Asia/Kolkata", "UTC"];
    }
  }, []);
  const set = <K extends keyof ListingDetails>(key: K, v: ListingDetails[K]) => onChange({ ...value, [key]: v });

  return (
    <div className="space-y-8">
      {sections.includes("basics") && (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            className="sm:col-span-2"
            label="Title"
            value={value.title}
            maxLength={200}
            onChange={(e) => set("title", e.target.value)}
            error={errors.title}
            placeholder="e.g. Sunlit Bandra loft with terrace"
          />
          <TextAreaField
            className="sm:col-span-2"
            label="Description"
            rows={6}
            maxLength={5000}
            value={value.description}
            onChange={(e) => set("description", e.target.value)}
            hint={`${value.description.length}/5000 — what it looks like, light, access, rules, what productions it suits.`}
          />
          <TextField
            label="Capacity (people)"
            inputMode="numeric"
            value={value.capacity}
            onChange={(e) => set("capacity", e.target.value.replace(/[^\d]/g, ""))}
            error={errors.capacity}
            placeholder="e.g. 25"
          />
          <SelectField label="Time zone" value={value.timezone} onChange={(e) => set("timezone", e.target.value)}>
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </SelectField>
          <div className="sm:col-span-2">
            <Switch
              checked={value.instant_booking_enabled}
              onChange={(v) => set("instant_booking_enabled", v)}
              label="Instant booking"
              description="Bookers can confirm a slot without waiting for the host to accept."
            />
          </div>
        </div>
      )}
      {sections.includes("address") && (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            className="sm:col-span-2"
            label="Address line 1"
            value={value.address_line1}
            onChange={(e) => set("address_line1", e.target.value)}
          />
          <TextField
            className="sm:col-span-2"
            label="Address line 2"
            value={value.address_line2}
            onChange={(e) => set("address_line2", e.target.value)}
          />
          <TextField label="City" value={value.city} onChange={(e) => set("city", e.target.value)} error={errors.city} />
          <TextField label="State / region" value={value.region} onChange={(e) => set("region", e.target.value)} />
          <TextField label="Country" value={value.country} onChange={(e) => set("country", e.target.value)} error={errors.country} />
          <TextField label="Postal code" value={value.postal_code} onChange={(e) => set("postal_code", e.target.value)} />
          <TextField
            label="Latitude"
            inputMode="decimal"
            value={value.latitude}
            error={errors.latitude}
            onChange={(e) => set("latitude", e.target.value)}
            onPaste={(e) => {
              const coords = parseCoordinates(e.clipboardData.getData("text"));
              if (coords) {
                e.preventDefault();
                onChange({ ...value, latitude: coords[0], longitude: coords[1] });
              }
            }}
          />
          <TextField
            label="Longitude"
            inputMode="decimal"
            value={value.longitude}
            error={errors.longitude}
            onChange={(e) => set("longitude", e.target.value)}
          />
          <p className="flex items-start gap-1.5 text-xs text-slate-500 sm:col-span-2">
            <MapPin aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Tip: right-click the spot in Google Maps, copy the coordinates and paste them into Latitude — both fields fill in. Listings need
            coordinates to appear in map search.
          </p>
        </div>
      )}
    </div>
  );
}
