"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ImageIcon, LayoutGrid, List, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Column, Table } from "@/components/ui/Table";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { CsvExportButton } from "@/components/ui/CsvExportButton";
import { adminApi, unwrapPaginated } from "@/lib/api";
import { useAdminList } from "@/lib/useAdminList";
import { cn } from "@/lib/cn";
import { formatMoney, personName } from "@/lib/format";
import { useAdminMe } from "@/lib/useAdminMe";
import type { components } from "@/types/admin-api";

type LocationDetail = components["schemas"]["AdminLocationListItem"];

const PAGE_SIZE = 20;
const VIEW_KEY = "prodbnb-admin-locations-view";

const PRICE_UNIT: Record<string, string> = { hourly: "/hr", half_day: "/half day", day: "/day", multi_day: "/day" };

function Cover({ l, className }: { l: LocationDetail; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center overflow-hidden bg-slate-100", className)}>
      {l.cover_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={l.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <ImageIcon aria-hidden className="h-4 w-4 text-slate-400" />
      )}
    </div>
  );
}

function priceLabel(l: LocationDetail): string {
  return l.starting_price
    ? `${formatMoney(l.starting_price.amount_minor_units, l.starting_price.currency)}${PRICE_UNIT[l.starting_price.booking_type] ?? ""}`
    : "No price";
}
const STATUS_OPTIONS = ["draft", "submitted", "under_review", "published", "rejected", "suspended", "archived"] as const;

export default function LocationsPage() {
  return (
    <Suspense
      fallback={
        <AdminShell>
          <TableSkeleton columns={5} />
        </AdminShell>
      }
    >
      <LocationsPageInner />
    </Suspense>
  );
}

function LocationsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get("page") ?? "1");
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "";

  function updateParams(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    if (!("page" in next)) params.delete("page");
    router.push(`/locations?${params.toString()}`);
  }

  const listKey = `/v1/admin/locations?page=${page}&search=${search}&status=${status}`;
  const fetcher = useCallback(
    () =>
      adminApi
        .GET("/locations", { params: { query: { page, pageSize: PAGE_SIZE, search: search || undefined, status: (status || undefined) as never } } })
        .then(unwrapPaginated),
    [page, search, status],
  );
  const { rows, meta, isLoading, error, refresh } = useAdminList<LocationDetail>(listKey, fetcher);
  const { can } = useAdminMe();
  const [view, setView] = useState<"table" | "grid">("table");
  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_KEY);
      if (stored === "grid" || stored === "table") setView(stored);
    } catch {
      // per-browser preference only
    }
  }, []);
  function chooseView(next: "table" | "grid") {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // ignore
    }
  }

  const columns: Column<LocationDetail>[] = useMemo(
    () => [
      {
        key: "title",
        header: "Listing",
        render: (l) => (
          <Link href={`/locations/${l.id}`} className="group flex items-center gap-3">
            <Cover l={l} className="h-12 w-16 shrink-0 rounded-md" />
            <span className="min-w-0">
              <span className="block truncate font-medium text-slate-900 group-hover:underline">{l.title}</span>
              <span className="block text-xs text-slate-500">
                {l.city}, {l.country} · {l.media_count} photo{l.media_count === 1 ? "" : "s"}
              </span>
            </span>
          </Link>
        ),
      },
      { key: "host", header: "Host", render: (l) => <span className="text-slate-700">{personName(l.host)}</span> },
      {
        key: "price",
        header: "From",
        render: (l) => <span className={l.starting_price ? "text-slate-800" : "text-slate-400"}>{priceLabel(l)}</span>,
      },
      {
        key: "status",
        header: "Status",
        render: (l) => (
          <div className="flex flex-col items-start gap-1">
            <StatusBadge status={l.status} />
            {l.status === "suspended" && (
              <Badge tone="neutral">{l.suspended_by_host_suspension ? "Host account suspended" : "Policy violation"}</Badge>
            )}
          </div>
        ),
      },
      {
        key: "actions",
        header: "",
        render: (l) => (
          <div className="flex justify-end gap-3 text-sm">
            <Link href={`/locations/${l.id}/edit`} className="font-medium text-slate-700 underline hover:text-slate-900">
              Edit
            </Link>
            <Link href={`/locations/${l.id}`} className="text-slate-500 underline hover:text-slate-900">
              View
            </Link>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <AdminShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Locations</h1>
          {meta && <p className="mt-1 text-sm text-slate-500">{meta.total.toLocaleString("en-IN")} listings</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {can("locations.create") && (
            <Link
              href="/locations/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              <Plus aria-hidden className="h-4 w-4" /> New listing
            </Link>
          )}
          <CsvExportButton<LocationDetail>
            filename="locations"
            fetchPage={(p, size) =>
              adminApi
                .GET("/locations", {
                  params: { query: { page: p, pageSize: size, search: search || undefined, status: (status || undefined) as never } },
                })
                .then(unwrapPaginated<LocationDetail>)
            }
            columns={[
              { header: "Listing ID", value: (l) => l.id },
              { header: "Title", value: (l) => l.title },
              { header: "City", value: (l) => l.city },
              { header: "Region", value: (l) => l.region },
              { header: "Country", value: (l) => l.country },
              { header: "Status", value: (l) => l.status },
              { header: "Host ID", value: (l) => l.host_id },
              { header: "Capacity", value: (l) => l.capacity },
              { header: "Instant booking", value: (l) => (l.instant_booking_enabled ? "yes" : "no") },
              { header: "Created", value: (l) => l.created_at },
            ]}
          />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          label="Search locations by title"
          value={search}
          onChange={(v) => updateParams({ search: v || undefined })}
          placeholder="Search by title…"
        />
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => updateParams({ status: e.target.value || undefined })}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <div role="group" aria-label="View" className="ml-auto inline-flex rounded-lg bg-slate-100 p-0.5">
          {(["table", "grid"] as const).map((v) => {
            const Icon = v === "table" ? List : LayoutGrid;
            return (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                aria-label={v === "table" ? "Table view" : "Grid view"}
                onClick={() => chooseView(v)}
                className={cn("rounded-md p-1.5", view === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}
              >
                <Icon aria-hidden className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      </div>

      {isLoading && !meta ? (
        <TableSkeleton columns={5} />
      ) : error ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load locations.")} onRetry={refresh} />
      ) : rows.length === 0 ? (
        <EmptyState title="No locations match these filters." description="Try clearing the search or status filter above." />
      ) : (
        <>
          {view === "table" ? (
            <Table columns={columns} rows={rows} rowKey={(l) => l.id} caption="Locations" />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rows.map((l) => (
                <li
                  key={l.id}
                  className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  <Link href={`/locations/${l.id}`} className="block">
                    <div className="relative">
                      <Cover l={l} className="aspect-[4/3] w-full" />
                      <span className="absolute left-2 top-2">
                        <StatusBadge status={l.status} />
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="truncate font-medium text-slate-900 group-hover:underline">{l.title}</p>
                      <p className="truncate text-xs text-slate-500">
                        {l.city}, {l.country} · {personName(l.host)}
                      </p>
                      <p className="mt-1 text-sm text-slate-800">{priceLabel(l)}</p>
                    </div>
                  </Link>
                  <div className="flex justify-end gap-3 border-t border-slate-100 px-3 py-2 text-sm">
                    <Link href={`/locations/${l.id}/edit`} className="font-medium text-slate-700 underline hover:text-slate-900">
                      Edit
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {meta && (
            <Pagination
              page={meta.page}
              pageSize={meta.pageSize}
              total={meta.total}
              onPageChange={(p) => updateParams({ page: String(p) })}
              label="Locations"
            />
          )}
        </>
      )}
    </AdminShell>
  );
}
