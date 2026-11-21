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
import { formatListingCode } from "@/lib/listingCode";
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
  const [availabilityLogin, setAvailabilityLogin] = useState(true);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setHoldsOn(data.unpaid_hold_minutes !== null);
    setHoldMinutes(String(data.unpaid_hold_minutes ?? 30));
    setAvailabilityLogin(data.availability_requires_login);
  }, [data]);

  const minutes = Number(holdMinutes);
  const invalid = holdsOn && (!Number.isInteger(minutes) || minutes < 5 || minutes > 10080);
  const holdsDirty = Boolean(data) && (holdsOn ? minutes : null) !== data!.unpaid_hold_minutes;
  const loginDirty = Boolean(data) && availabilityLogin !== data!.availability_requires_login;
  const dirty = useMemo(() => holdsDirty || loginDirty, [holdsDirty, loginDirty]);

  async function save() {
    if (!data) return;
    setBusy(true);
    try {
      const body: SettingsPatch = {};
      if (holdsDirty) body.unpaid_hold_minutes = holdsOn ? minutes : null;
      if (loginDirty) body.availability_requires_login = availabilityLogin;
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
    <Card title="Booking rules" description="How booking works for everyone, on the website and in the apps.">
      <Switch
        checked={availabilityLogin}
        onChange={setAvailabilityLogin}
        disabled={!editable}
        label="Require login to check availability"
        description="Anyone can browse listings and prices; open dates and times are shown only after signing in. Enforced by the API, so it applies to every app version — turn it off temporarily if an older app version can't sign people in from its availability screen."
      />
      <div className="my-5 border-t border-slate-200" />
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
            { label: "Availability", value: data.availability_requires_login ? "Signed-in people only" : "Everyone" },
            { label: "Unpaid-hold expiry", value: data.unpaid_hold_minutes === null ? "Off" : `${data.unpaid_hold_minutes} min` },
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

function ListingIds() {
  const { can } = useAdminMe();
  const editable = can("settings.manage");
  const { data, error, isLoading, mutate } = useSWR("/v1/admin/settings", () => adminApi.GET("/settings").then(unwrap<PlatformSettings>));
  const [prefix, setPrefix] = useState("HKLS");
  const [digits, setDigits] = useState("2");
  const [next, setNext] = useState("1");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setPrefix(data.listing_id_prefix);
    setDigits(String(data.listing_id_digits));
    setNext(String(data.listing_id_next));
  }, [data]);

  const cleanPrefix = prefix.trim().toUpperCase();
  const digitsNum = Number(digits);
  const nextNum = Number(next);
  const prefixError = !/^[A-Z0-9]{1,10}$/.test(cleanPrefix) ? "1–10 capital letters or numbers, no spaces." : undefined;
  const digitsError = !Number.isInteger(digitsNum) || digitsNum < 1 || digitsNum > 8 ? "A whole number from 1 to 8." : undefined;
  const nextError = !Number.isInteger(nextNum) || nextNum < 1 || nextNum > 99_999_999 ? "A whole number from 1." : undefined;
  const invalid = Boolean(prefixError || digitsError || nextError);
  const dirty =
    Boolean(data) && (cleanPrefix !== data!.listing_id_prefix || digitsNum !== data!.listing_id_digits || nextNum !== data!.listing_id_next);

  async function save() {
    if (!data || invalid) return;
    setBusy(true);
    try {
      const body: SettingsPatch = {};
      if (cleanPrefix !== data.listing_id_prefix) body.listing_id_prefix = cleanPrefix;
      if (digitsNum !== data.listing_id_digits) body.listing_id_digits = digitsNum;
      if (nextNum !== data.listing_id_next) body.listing_id_next = nextNum;
      if (reason.trim()) body.reason = reason.trim();
      await adminApi.PATCH("/settings", { body }).then(unwrap);
      toast.success("Listing ID settings saved. They apply to listings created from now on.");
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

  const preview = invalid ? "—" : formatListingCode(cleanPrefix, digitsNum, nextNum);
  return (
    <Card
      title="Listing IDs"
      description="Every listing gets an ID like HKLS01 so the team and hosts can refer to it. Bookers never see it. Existing listings already have theirs."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          label="Prefix"
          value={prefix}
          maxLength={10}
          onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          disabled={!editable}
          error={prefixError}
          hint="The letters at the front."
        />
        <TextField
          label="Digits"
          type="number"
          min={1}
          max={8}
          value={digits}
          onChange={(e) => setDigits(e.target.value)}
          disabled={!editable}
          error={digitsError}
          hint="2 gives 01, 02 … 99; bigger numbers just get longer."
        />
        <TextField
          label="Next number"
          type="number"
          min={1}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          disabled={!editable}
          error={nextError}
          hint="The number the next new listing gets. Numbers already in use are skipped."
        />
      </div>
      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        The next new listing will be <span className="font-mono font-semibold text-slate-900">{preview}</span>.
        <span className="mt-1 block text-xs text-slate-500">
          Changing the prefix doesn&apos;t rename listings that already have an ID. To give one listing a particular ID, open it and change its ID
          there.
        </span>
      </div>
      {editable ? (
        <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-slate-200 pt-4">
          <TextField
            className="min-w-[240px] flex-1"
            label="Reason (recorded in the audit log)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. New prefix for the Delhi launch"
            maxLength={500}
          />
          <Button variant="primary" onClick={save} disabled={!dirty || invalid || busy}>
            {busy ? "Saving…" : "Save listing IDs"}
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Only a super admin can change listing ID settings.</p>
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
          {can("settings.view") && <ListingIds />}
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
