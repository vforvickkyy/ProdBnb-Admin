"use client";

import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { CalendarOff, CalendarPlus, Clock, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import { AvailabilityRule, DayOfWeek, listingApi } from "@/lib/listingApi";

const DAYS: { day: DayOfWeek; label: string }[] = [
  { day: "monday", label: "Monday" },
  { day: "tuesday", label: "Tuesday" },
  { day: "wednesday", label: "Wednesday" },
  { day: "thursday", label: "Thursday" },
  { day: "friday", label: "Friday" },
  { day: "saturday", label: "Saturday" },
  { day: "sunday", label: "Sunday" },
];
const WEEKDAYS: DayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");

const TIME_INPUT =
  "rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/25";

export function TimingsEditor({
  locationId,
  timezone,
  canEdit,
  onChanged,
}: {
  locationId: string;
  timezone: string;
  canEdit: boolean;
  onChanged?: () => void;
}) {
  const rules = useSWR(`/v1/locations/${locationId}/availability/rules`, () => listingApi.rules(locationId));
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, success?: string) {
    setBusy(true);
    try {
      await action();
      if (success) toast.success(success);
      await rules.mutate();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
      await rules.mutate();
    } finally {
      setBusy(false);
    }
  }

  /** Replace the hours of `days` with one window each. */
  async function applyPreset(days: DayOfWeek[], start: string, end: string, label: string) {
    await run(async () => {
      const current = rules.data ?? [];
      for (const rule of current.filter((r) => days.includes(r.day_of_week))) {
        await listingApi.deleteRule(locationId, rule.id);
      }
      for (const day of days) {
        await listingApi.createRule(locationId, { day_of_week: day, start_time: start, end_time: end });
      }
    }, label);
  }

  async function copyDay(from: DayOfWeek) {
    const source = (rules.data ?? []).filter((r) => r.day_of_week === from);
    if (source.length === 0) {
      toast.error(`${from} has no hours to copy.`);
      return;
    }
    await run(async () => {
      const current = rules.data ?? [];
      for (const rule of current.filter((r) => r.day_of_week !== from)) {
        await listingApi.deleteRule(locationId, rule.id);
      }
      for (const { day } of DAYS.filter((d) => d.day !== from)) {
        for (const window of source) {
          await listingApi.createRule(locationId, { day_of_week: day, start_time: hhmm(window.start_time), end_time: hhmm(window.end_time) });
        }
      }
    }, `Copied ${from}'s hours to every day.`);
  }

  return (
    <div className="space-y-6">
      <Card
        title="Weekly opening hours"
        description={`When the location can be booked, in the listing's time zone (${timezone}). Several windows per day are fine, e.g. a lunch break.`}
        actions={
          canEdit ? (
            <>
              <Button size="sm" disabled={busy} onClick={() => applyPreset(WEEKDAYS, "09:00", "18:00", "Set Mon–Fri 9:00–18:00.")}>
                Mon–Fri 9–6
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  applyPreset(
                    DAYS.map((d) => d.day),
                    "07:00",
                    "22:00",
                    "Set every day 7:00–22:00.",
                  )
                }
              >
                Every day 7–10
              </Button>
              <Button size="sm" disabled={busy} onClick={() => copyDay("monday")}>
                Copy Monday to all
              </Button>
            </>
          ) : undefined
        }
      >
        {rules.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : rules.error ? (
          <p className="text-sm text-red-700">Could not load opening hours.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {DAYS.map(({ day, label }) => (
              <DayRow
                key={day}
                day={day}
                label={label}
                windows={(rules.data ?? []).filter((r) => r.day_of_week === day).sort((a, b) => a.start_time.localeCompare(b.start_time))}
                canEdit={canEdit}
                busy={busy}
                onAdd={(start, end) =>
                  run(
                    () => listingApi.createRule(locationId, { day_of_week: day, start_time: start, end_time: end }),
                    `Added ${label} ${start}–${end}.`,
                  )
                }
                onRemove={(rule) => run(() => listingApi.deleteRule(locationId, rule.id))}
              />
            ))}
          </ul>
        )}
        {(rules.data ?? []).length === 0 && !rules.isLoading && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            No opening hours yet — nobody can book this listing until you add some.
          </p>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <OverridesCard locationId={locationId} canEdit={canEdit} onChanged={onChanged} />
        <BlocksCard locationId={locationId} canEdit={canEdit} onChanged={onChanged} />
      </div>
    </div>
  );
}

function DayRow({
  day,
  label,
  windows,
  canEdit,
  busy,
  onAdd,
  onRemove,
}: {
  day: DayOfWeek;
  label: string;
  windows: AvailabilityRule[];
  canEdit: boolean;
  busy: boolean;
  onAdd: (start: string, end: string) => void;
  onRemove: (rule: AvailabilityRule) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  return (
    <li className="flex flex-wrap items-center gap-3 py-2.5">
      <span className="w-20 shrink-0 text-sm font-medium text-slate-800 sm:w-24">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {windows.length === 0 && !adding && <span className="text-sm text-slate-400">Closed</span>}
        {windows.map((w) => (
          <span key={w.id} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-host-50 px-2.5 py-0.5 text-sm text-host-700">
            <Clock aria-hidden className="h-3 w-3" />
            {hhmm(w.start_time)}–{hhmm(w.end_time)}
            {canEdit && (
              <button
                type="button"
                aria-label={`Remove ${label} ${hhmm(w.start_time)} to ${hhmm(w.end_time)}`}
                disabled={busy}
                onClick={() => onRemove(w)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-host-100"
              >
                <X aria-hidden className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {adding && (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <input type="time" aria-label={`${label} opens`} value={start} onChange={(e) => setStart(e.target.value)} className={TIME_INPUT} />
            <span className="text-slate-400">–</span>
            <input type="time" aria-label={`${label} closes`} value={end} onChange={(e) => setEnd(e.target.value)} className={TIME_INPUT} />
            <Button
              size="sm"
              variant="primary"
              disabled={busy || !start || !end || end <= start}
              onClick={() => {
                onAdd(start, end);
                setAdding(false);
              }}
            >
              Add
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </span>
        )}
      </div>
      {canEdit && !adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          aria-label={`Add hours on ${day}`}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <Plus aria-hidden className="h-3.5 w-3.5" /> Hours
        </button>
      )}
    </li>
  );
}

function OverridesCard({ locationId, canEdit, onChanged }: { locationId: string; canEdit: boolean; onChanged?: () => void }) {
  const { data, mutate, isLoading } = useSWR(`/v1/locations/${locationId}/availability/overrides`, () => listingApi.overrides(locationId));
  const [date, setDate] = useState("");
  const [status, setStatus] = useState<"unavailable" | "available">("unavailable");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("16:00");
  const [busy, setBusy] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (data ?? []).filter((o) => o.date >= today).sort((a, b) => a.date.localeCompare(b.date));

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      await mutate();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Date exceptions" description="Close a specific date (a holiday), or open it with special hours.">
      {canEdit && (
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <input type="date" aria-label="Date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className={TIME_INPUT} />
          <select aria-label="Exception type" value={status} onChange={(e) => setStatus(e.target.value as never)} className={TIME_INPUT}>
            <option value="unavailable">Closed all day</option>
            <option value="available">Open with special hours</option>
          </select>
          {status === "available" && (
            <>
              <input type="time" aria-label="Opens" value={start} onChange={(e) => setStart(e.target.value)} className={TIME_INPUT} />
              <input type="time" aria-label="Closes" value={end} onChange={(e) => setEnd(e.target.value)} className={TIME_INPUT} />
            </>
          )}
          <Button
            size="sm"
            variant="primary"
            disabled={busy || !date || (status === "available" && end <= start)}
            onClick={() =>
              run(
                () =>
                  listingApi.createOverride(locationId, { date, status, ...(status === "available" ? { start_time: start, end_time: end } : {}) }),
                `Exception added for ${formatDate(date)}.`,
              )
            }
          >
            <CalendarPlus aria-hidden className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      )}
      {isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : upcoming.length === 0 ? (
        <p className="text-sm text-slate-500">No upcoming exceptions.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {upcoming.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-2 py-2">
              <span>
                <span className="font-medium text-slate-800">{formatDate(o.date)}</span>{" "}
                <span className={cn(o.status === "unavailable" ? "text-red-700" : "text-host-700")}>
                  {o.status === "unavailable" ? "Closed" : `Open ${hhmm(o.start_time)}–${hhmm(o.end_time)}`}
                </span>
              </span>
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => run(() => listingApi.deleteOverride(locationId, o.id), "Exception removed.")}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function BlocksCard({ locationId, canEdit, onChanged }: { locationId: string; canEdit: boolean; onChanged?: () => void }) {
  const { data, mutate, isLoading } = useSWR(`/v1/locations/${locationId}/blocks`, () => listingApi.blocks(locationId));
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const now = Date.now();
  const upcoming = (data ?? []).filter((b) => new Date(b.end_at).getTime() > now).sort((a, b) => a.start_at.localeCompare(b.start_at));

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      await mutate();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const valid = start && end && new Date(end) > new Date(start);

  return (
    <Card
      title="Blocked periods"
      description="Hold the calendar for maintenance, a private event or an off-platform booking. Times are in your browser's time zone."
    >
      {canEdit && (
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          <input type="datetime-local" aria-label="Block starts" value={start} onChange={(e) => setStart(e.target.value)} className={TIME_INPUT} />
          <input type="datetime-local" aria-label="Block ends" value={end} onChange={(e) => setEnd(e.target.value)} className={TIME_INPUT} />
          <input
            aria-label="Reason (optional)"
            placeholder="Reason (optional)"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            className={cn(TIME_INPUT, "sm:col-span-2")}
          />
          <div className="sm:col-span-2">
            <Button
              size="sm"
              variant="primary"
              disabled={busy || !valid}
              onClick={() =>
                run(
                  () =>
                    listingApi.createBlock(locationId, {
                      start_at: new Date(start).toISOString(),
                      end_at: new Date(end).toISOString(),
                      reason: reason.trim() || null,
                    }),
                  "Period blocked.",
                ).then(() => {
                  setStart("");
                  setEnd("");
                  setReason("");
                })
              }
            >
              <CalendarOff aria-hidden className="h-3.5 w-3.5" /> Block period
            </Button>
          </div>
        </div>
      )}
      {isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : upcoming.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing blocked.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {upcoming.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 py-2">
              <span className="min-w-0">
                <span className="block text-slate-800">
                  {formatDateTime(b.start_at)} → {formatDateTime(b.end_at)}
                </span>
                {b.reason && <span className="block truncate text-xs text-slate-500">{b.reason}</span>}
              </span>
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => run(() => listingApi.deleteBlock(locationId, b.id), "Block removed.")}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
