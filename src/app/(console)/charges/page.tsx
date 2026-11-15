"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
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

/** Charges & taxes (Console 3): the platform fee and tax added on top of a listing's price. */
export default function ChargesPage() {
  const { can } = useAdminMe();
  const editable = can("settings.manage");
  const { data, error, isLoading, mutate } = useSWR("/v1/admin/settings", () => adminApi.GET("/settings").then(unwrap<PlatformSettings>));

  const [fee, setFee] = useState("0");
  const [tax, setTax] = useState("0");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setFee(String(bpsToPercent(data.platform_fee_bps)));
    setTax(String(bpsToPercent(data.tax_bps)));
  }, [data]);

  const feeBps = percentToBps(Number(fee));
  const taxBps = percentToBps(Number(tax));
  const invalid = !Number.isFinite(feeBps) || feeBps < 0 || feeBps > 5000 || !Number.isFinite(taxBps) || taxBps < 0 || taxBps > 5000;
  const dirty = useMemo(() => Boolean(data) && (feeBps !== data!.platform_fee_bps || taxBps !== data!.tax_bps), [data, feeBps, taxBps]);
  const preview = previewCharges(PREVIEW_BASE, Number.isFinite(feeBps) ? feeBps : 0, Number.isFinite(taxBps) ? taxBps : 0);

  async function save() {
    if (!data) return;
    setBusy(true);
    try {
      const body: SettingsPatch = {};
      if (feeBps !== data.platform_fee_bps) body.platform_fee_bps = feeBps;
      if (taxBps !== data.tax_bps) body.tax_bps = taxBps;
      if (reason.trim()) body.reason = reason.trim();
      await adminApi.PATCH("/settings", { body }).then(unwrap);
      toast.success("Charges saved. They apply to bookings made from now on.");
      setReason("");
      await mutate();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Failed to save charges."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Charges & taxes"
        description="What a booker pays on top of the listing's own price. Changes apply to new bookings only — existing bookings keep the price they were made at."
      />
      {isLoading ? (
        <Skeleton className="h-72 w-full rounded-xl" />
      ) : error || !data ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load charges.")} onRetry={() => mutate()} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card title="Platform fee & tax" description="Added at booking time and shown to the booker as separate lines.">
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
              <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-700">
                The iOS app shows fee and tax on the booking itself, but its pre-booking estimate does not include them yet — with a
                fee set, the booker sees a lower estimate than the total they are asked to pay.
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
                    {busy ? "Saving…" : "Save charges"}
                  </Button>
                </div>
              </Card>
            ) : (
              <p className="text-sm text-slate-500">Only a super admin can change charges and taxes.</p>
            )}
          </div>

          <div className="space-y-6">
            <Card title="Price preview" description="A ₹10,000 booking with these values.">
              <KeyValues
                items={[
                  { label: "Listing price", value: formatMoney(PREVIEW_BASE) },
                  { label: "Platform fee", value: formatMoney(preview.fee) },
                  { label: "Tax", value: formatMoney(preview.tax) },
                  { label: "Booker pays", value: <strong className="font-semibold">{formatMoney(preview.total)}</strong> },
                ]}
              />
            </Card>
            <Card title="Current values">
              <KeyValues
                items={[
                  { label: "Platform fee", value: `${bpsToPercent(data.platform_fee_bps)}%` },
                  { label: "Tax", value: `${bpsToPercent(data.tax_bps)}%` },
                  { label: "Last changed", value: formatDateTime(data.updated_at) },
                ]}
              />
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
