"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import useSWR from "swr";
import { ArrowRight } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/Button";
import { Card, KeyValues } from "@/components/ui/Card";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { TextField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { adminApi, unwrap } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { SIDEBAR_MODE_OPTIONS, useSidebarMode } from "@/lib/sidebarMode";
import type { ThemeChoice } from "@/lib/theme";
import { useAdminMe } from "@/lib/useAdminMe";
import type { components, paths } from "@/types/admin-api";

type PlatformSettings = components["schemas"]["PlatformSettings"];
type SettingsPatch = NonNullable<paths["/settings"]["patch"]["requestBody"]>["content"]["application/json"];

function BookingRules() {
  const { can } = useAdminMe();
  const editable = can("settings.manage");
  const { data, error, isLoading, mutate } = useSWR("/v1/admin/settings", () => adminApi.GET("/settings").then(unwrap<PlatformSettings>));
  const [holdsOn, setHoldsOn] = useState(false);
  const [holdMinutes, setHoldMinutes] = useState("30");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setHoldsOn(data.unpaid_hold_minutes !== null);
    setHoldMinutes(String(data.unpaid_hold_minutes ?? 30));
  }, [data]);

  const minutes = Number(holdMinutes);
  const invalid = holdsOn && (!Number.isInteger(minutes) || minutes < 5 || minutes > 10080);
  const dirty = useMemo(() => Boolean(data) && (holdsOn ? minutes : null) !== data!.unpaid_hold_minutes, [data, holdsOn, minutes]);

  async function save() {
    if (!data) return;
    setBusy(true);
    try {
      const body: SettingsPatch = { unpaid_hold_minutes: holdsOn ? minutes : null };
      if (reason.trim()) body.reason = reason.trim();
      await adminApi.PATCH("/settings", { body }).then(unwrap);
      toast.success("Booking rules saved. They apply to bookings made from now on.");
      setReason("");
      await mutate();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Failed to save settings."));
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (error || !data) return <ErrorState message={extractErrorMessage(error, "Failed to load settings.")} onRetry={() => mutate()} />;

  return (
    <Card title="Unpaid-hold expiry" description="A booking reserves its slot as soon as it's made. This frees slots nobody pays for.">
      <Switch
        checked={holdsOn}
        onChange={setHoldsOn}
        disabled={!editable}
        label="Cancel unpaid bookings automatically"
        description="Expired bookings are cancelled, the slot is released immediately, and the booker gets an in-app notification."
      />
      {holdsOn && (
        <TextField
          className="mt-4 max-w-xs"
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
      <div className="mt-5 border-t border-slate-200 pt-4">
        <KeyValues
          items={[
            { label: "Currently", value: data.unpaid_hold_minutes === null ? "Off" : `${data.unpaid_hold_minutes} min` },
            { label: "Last changed", value: formatDateTime(data.updated_at) },
          ]}
        />
      </div>
      {editable ? (
        <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-slate-200 pt-4">
          <TextField
            className="min-w-[240px] flex-1"
            label="Reason (recorded in the audit log)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Shorter holds for the festive season"
            maxLength={500}
          />
          <Button variant="primary" onClick={save} disabled={!dirty || invalid || busy}>
            {busy ? "Saving…" : "Save booking rules"}
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Only a super admin can change platform settings.</p>
      )}
    </Card>
  );
}

function Appearance() {
  const { choice, setChoice } = useTheme();
  const [mode, setMode] = useSidebarMode();
  return (
    <Card title="Appearance" description="Saved in this browser only.">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-slate-900">Theme</div>
            <div className="text-xs text-slate-500">System follows your device&apos;s setting.</div>
          </div>
          <Segmented<ThemeChoice>
            label="Theme"
            value={choice}
            onChange={setChoice}
            options={[
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
              { value: "system", label: "System" },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
          <div>
            <div className="text-sm font-medium text-slate-900">Sidebar</div>
            <div className="text-xs text-slate-500">Also available from the sidebar&apos;s own menu.</div>
          </div>
          <Segmented label="Sidebar" value={mode} onChange={setMode} options={SIDEBAR_MODE_OPTIONS} />
        </div>
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const { can } = useAdminMe();
  return (
    <>
      <PageHeader title="General settings" description="Marketplace-wide booking rules, and how this console looks for you." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {can("settings.view") ? <BookingRules /> : <p className="text-sm text-slate-500">Your role cannot view platform settings.</p>}
          <Appearance />
        </div>
        <div className="space-y-4">
          <Card title="Looking for fees or tax?">
            <p className="text-[13px] leading-5 text-slate-500">The platform fee and tax now live with payments.</p>
            <Link
              href="/charges"
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent-700 hover:underline"
            >
              Charges & taxes <ArrowRight aria-hidden className="h-3.5 w-3.5" />
            </Link>
          </Card>
        </div>
      </div>
    </>
  );
}
