"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/Button";
import { Card, KeyValues } from "@/components/ui/Card";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { TextField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, unwrap } from "@/lib/api";
import { bpsToPercent, formatDateTime, formatMoney, percentToBps } from "@/lib/format";
import { previewCharges } from "@/lib/pricing";
import { useAdminMe } from "@/lib/useAdminMe";
import type { components, paths } from "@/types/admin-api";

type PlatformSettings = components["schemas"]["PlatformSettings"];
type SettingsPatch = NonNullable<paths["/settings"]["patch"]["requestBody"]>["content"]["application/json"];

const PREVIEW_BASE = 1_000_000; // ₹10,000.00 in paise

export default function SettingsPage() {
  const { can } = useAdminMe();
  const editable = can("settings.manage");
  const { data, error, isLoading, mutate } = useSWR("/v1/admin/settings", () => adminApi.GET("/settings").then(unwrap<PlatformSettings>));

  const [fee, setFee] = useState("0");
  const [tax, setTax] = useState("0");
  const [holdsOn, setHoldsOn] = useState(false);
  const [holdMinutes, setHoldMinutes] = useState("30");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setFee(String(bpsToPercent(data.platform_fee_bps)));
    setTax(String(bpsToPercent(data.tax_bps)));
    setHoldsOn(data.unpaid_hold_minutes !== null);
    setHoldMinutes(String(data.unpaid_hold_minutes ?? 30));
  }, [data]);

  const feeBps = percentToBps(Number(fee));
  const taxBps = percentToBps(Number(tax));
  const minutes = Number(holdMinutes);
  const invalid =
    !Number.isFinite(feeBps) || feeBps < 0 || feeBps > 5000 ||
    !Number.isFinite(taxBps) || taxBps < 0 || taxBps > 5000 ||
    (holdsOn && (!Number.isInteger(minutes) || minutes < 5 || minutes > 10080));

  const dirty = useMemo(() => {
    if (!data) return false;
    return (
      feeBps !== data.platform_fee_bps ||
      taxBps !== data.tax_bps ||
      (holdsOn ? minutes : null) !== data.unpaid_hold_minutes
    );
  }, [data, feeBps, taxBps, holdsOn, minutes]);

  const preview = previewCharges(PREVIEW_BASE, Number.isFinite(feeBps) ? feeBps : 0, Number.isFinite(taxBps) ? taxBps : 0);

  async function save() {
    if (!data) return;
    setBusy(true);
    try {
      const body: SettingsPatch = {};
      if (feeBps !== data.platform_fee_bps) body.platform_fee_bps = feeBps;
      if (taxBps !== data.tax_bps) body.tax_bps = taxBps;
      const nextHold = holdsOn ? minutes : null;
      if (nextHold !== data.unpaid_hold_minutes) body.unpaid_hold_minutes = nextHold;
      if (reason.trim()) body.reason = reason.trim();
      await adminApi.PATCH("/settings", { body }).then(unwrap);
      toast.success("Settings saved. They apply to bookings made from now on.");
      setReason("");
      await mutate();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Failed to save settings."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      <PageHeader
        title="Platform settings"
        description="Fees, tax and how long an unpaid booking may hold a slot. Changes apply to new bookings only — existing bookings keep the price they were made at."
      />
      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : error || !data ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load settings.")} onRetry={() => mutate()} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card title="Fees & tax" description="Added on top of the listing's own price at booking time.">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Platform fee (%)"
                  type="number"
                  min={0}
                  max={50}
                  step={0.01}
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  disabled={!editable}
                  hint="Charged to the booker. 0 = no fee."
                />
                <TextField
                  label="Tax (%)"
                  type="number"
                  min={0}
                  max={50}
                  step={0.01}
                  value={tax}
                  onChange={(e) => setTax(e.target.value)}
                  disabled={!editable}
                  hint="Applied to booking amount + platform fee (e.g. 18 for GST)."
                />
              </div>
              <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-inset ring-amber-200">
                The iOS app shows fee and tax on the booking itself, but its pre-booking estimate does not include them yet — with a
                fee set, the booker sees a lower estimate than the total they are asked to pay.
              </p>
            </Card>

            <Card title="Unpaid-hold expiry" description="A booking reserves its slot as soon as it's made. This frees slots nobody pays for.">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={holdsOn} onChange={(e) => setHoldsOn(e.target.checked)} disabled={!editable} className="h-4 w-4" />
                Cancel unpaid bookings automatically
              </label>
              {holdsOn && (
                <TextField
                  className="mt-3 max-w-xs"
                  label="Minutes a booking may stay unpaid"
                  type="number"
                  min={5}
                  max={10080}
                  step={1}
                  value={holdMinutes}
                  onChange={(e) => setHoldMinutes(e.target.value)}
                  disabled={!editable}
                  hint="5 minutes to 7 days. A booker mid-checkout is never cut off: an open payment keeps its booking until the payment window closes."
                />
              )}
              <p className="mt-3 text-xs text-slate-500">
                Expired bookings are cancelled, the slot is released immediately, and the booker gets an in-app notification.
              </p>
            </Card>

            {editable ? (
              <Card title="Save changes">
                <TextField
                  label="Reason (recorded in the audit log)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Launch pricing approved on 15 Nov"
                  maxLength={500}
                />
                <div className="mt-4 flex justify-end">
                  <Button variant="primary" onClick={save} disabled={!dirty || invalid || busy}>
                    {busy ? "Saving…" : "Save settings"}
                  </Button>
                </div>
              </Card>
            ) : (
              <p className="text-sm text-slate-500">Only a super admin can change platform settings.</p>
            )}
          </div>

          <div className="space-y-6">
            <Card title="Price preview" description="A ₹10,000 booking with these values.">
              <KeyValues
                items={[
                  { label: "Listing price", value: formatMoney(PREVIEW_BASE) },
                  { label: "Platform fee", value: formatMoney(preview.fee) },
                  { label: "Tax", value: formatMoney(preview.tax) },
                  { label: "Booker pays", value: <strong>{formatMoney(preview.total)}</strong> },
                ]}
              />
            </Card>
            <Card title="Current values">
              <KeyValues
                items={[
                  { label: "Platform fee", value: `${bpsToPercent(data.platform_fee_bps)}%` },
                  { label: "Tax", value: `${bpsToPercent(data.tax_bps)}%` },
                  { label: "Unpaid-hold expiry", value: data.unpaid_hold_minutes === null ? "Off" : `${data.unpaid_hold_minutes} min` },
                  { label: "Last changed", value: formatDateTime(data.updated_at) },
                ]}
              />
            </Card>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
