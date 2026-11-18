"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { adminApi, unwrap } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { BookingType, listingApi, Pricing } from "@/lib/listingApi";
import { previewCharges } from "@/lib/pricing";
import type { components } from "@/types/admin-api";

type PlatformSettings = components["schemas"]["PlatformSettings"];

const TYPES: { type: BookingType; label: string; unit: string; help: string }[] = [
  { type: "hourly", label: "Hourly", unit: "per hour", help: "Booked by the hour — the most common option for shoots." },
  { type: "half_day", label: "Half day", unit: "per half day", help: "A fixed block of hours, e.g. 4 or 6." },
  { type: "day", label: "Full day", unit: "per day", help: "One calendar day." },
  { type: "multi_day", label: "Multi-day", unit: "per day", help: "Charged per day for bookings spanning several days." },
];

function rupees(minor: number): string {
  return (minor / 100).toString();
}

function toMinor(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export function PricingEditor({
  locationId,
  canEdit,
  onChanged,
  priceOnRequest = false,
}: {
  locationId: string;
  canEdit: boolean;
  onChanged?: () => void;
  /** The listing hides its prices: these are only a private guide, and none are needed. */
  priceOnRequest?: boolean;
}) {
  const { data, error, isLoading, mutate } = useSWR(`/v1/locations/${locationId}/pricing`, () => listingApi.pricing(locationId));
  const { data: settings } = useSWR("/v1/admin/settings", () => adminApi.GET("/settings").then(unwrap<PlatformSettings>));

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error) return <p className="text-sm text-red-700">Could not load pricing.</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {priceOnRequest && (
        <p className="rounded-lg bg-sky-50 px-3 py-2.5 text-sm text-sky-800 lg:col-span-2">
          Price on request is on, so bookers don&apos;t see these prices and none are needed. Bookers can ask about the booking types switched on
          here; with none switched on, they can ask about hourly, full day and multi-day. The host replies to each request with a price.
        </p>
      )}
      {TYPES.map((t) => (
        <PriceRow
          key={t.type}
          locationId={locationId}
          meta={t}
          existing={(data ?? []).find((p) => p.booking_type === t.type) ?? null}
          canEdit={canEdit}
          settings={settings ?? null}
          onSaved={async () => {
            await mutate();
            onChanged?.();
          }}
        />
      ))}
      <p className="text-xs text-slate-500 lg:col-span-2">
        Amounts are what the host charges. Bookers additionally pay the platform fee and tax set under Settings
        {settings ? ` (currently ${settings.platform_fee_bps / 100}% fee, ${settings.tax_bps / 100}% tax)` : ""}. Each booking keeps the price it was
        made at.
      </p>
    </div>
  );
}

function PriceRow({
  locationId,
  meta,
  existing,
  canEdit,
  settings,
  onSaved,
}: {
  locationId: string;
  meta: (typeof TYPES)[number];
  existing: Pricing | null;
  canEdit: boolean;
  settings: PlatformSettings | null;
  onSaved: () => Promise<void>;
}) {
  const [amount, setAmount] = useState(existing ? rupees(existing.amount_minor_units) : "");
  const [hours, setHours] = useState(existing?.half_day_duration_hours ? String(existing.half_day_duration_hours) : "4");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAmount(existing ? rupees(existing.amount_minor_units) : "");
    setHours(existing?.half_day_duration_hours ? String(existing.half_day_duration_hours) : "4");
  }, [existing]);

  const minor = toMinor(amount);
  const dirty =
    existing && (minor !== existing.amount_minor_units || (meta.type === "half_day" && Number(hours) !== existing.half_day_duration_hours));
  const charges = minor !== null && settings ? previewCharges(minor, settings.platform_fee_bps, settings.tax_bps) : null;

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const hoursValid = meta.type !== "half_day" || (Number.isInteger(Number(hours)) && Number(hours) >= 1 && Number(hours) <= 23);

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          {meta.label}
          {existing && !existing.is_active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">Paused</span>}
        </span>
      }
      description={meta.help}
      actions={
        existing && canEdit ? (
          <Switch
            checked={existing.is_active}
            label={existing.is_active ? "Offered" : "Not offered"}
            disabled={busy}
            onChange={(active) =>
              run(
                () => listingApi.updatePricing(locationId, existing.id, { is_active: active }),
                active ? `${meta.label} is offered again.` : `${meta.label} paused.`,
              )
            }
          />
        ) : undefined
      }
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Amount (INR) {meta.unit}</span>
          <span className="flex items-center rounded-lg border border-slate-200 bg-white focus-within:border-accent-500 focus-within:ring-2 focus-within:ring-accent-500/25">
            <span className="pl-3 text-sm text-slate-500">₹</span>
            <input
              inputMode="decimal"
              value={amount}
              disabled={!canEdit || busy}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="0"
              className="w-32 bg-transparent px-2 py-1.5 text-sm text-slate-900 focus:outline-none"
            />
          </span>
        </label>
        {meta.type === "half_day" && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Hours</span>
            <input
              inputMode="numeric"
              value={hours}
              disabled={!canEdit || busy}
              onChange={(e) => setHours(e.target.value.replace(/[^\d]/g, ""))}
              className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/25"
            />
          </label>
        )}
        {canEdit && (
          <div className="flex gap-2">
            {!existing ? (
              <Button
                variant="primary"
                disabled={busy || minor === null || !hoursValid}
                onClick={() =>
                  run(
                    () =>
                      listingApi.createPricing(locationId, {
                        booking_type: meta.type,
                        amount_minor_units: minor!,
                        ...(meta.type === "half_day" ? { half_day_duration_hours: Number(hours) } : {}),
                      }),
                    `${meta.label} price added.`,
                  )
                }
              >
                Add price
              </Button>
            ) : (
              <>
                <Button
                  variant="primary"
                  disabled={busy || !dirty || minor === null || !hoursValid}
                  onClick={() =>
                    run(
                      () =>
                        listingApi.updatePricing(locationId, existing.id, {
                          amount_minor_units: minor!,
                          ...(meta.type === "half_day" ? { half_day_duration_hours: Number(hours) } : {}),
                        }),
                      `${meta.label} price updated.`,
                    )
                  }
                >
                  Save
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => run(() => listingApi.deletePricing(locationId, existing.id), `${meta.label} price removed.`)}
                >
                  Remove
                </Button>
              </>
            )}
          </div>
        )}
      </div>
      {charges && minor !== null && minor > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          Booker pays <span className="font-medium text-slate-800">{formatMoney(charges.total)}</span>
          {charges.fee || charges.tax ? ` (${formatMoney(minor)} + ${formatMoney(charges.fee)} fee + ${formatMoney(charges.tax)} tax)` : ""}
        </p>
      )}
    </Card>
  );
}
