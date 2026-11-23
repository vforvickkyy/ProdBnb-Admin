"use client";

import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Clock, Copy, Mail, MapPin, Phone, Smartphone, Globe, Home } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { TextAreaField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, unwrap, unwrapPaginated } from "@/lib/api";
import { formatDateTime, personName, relativeTime } from "@/lib/format";
import { useRouter } from "@/lib/navigation";
import { useAdminList } from "@/lib/useAdminList";
import { useAdminMe } from "@/lib/useAdminMe";
import { BEST_TIME_LABELS, nextSteps, SOURCE_LABELS, telHref, type HostRequestStep } from "@/lib/hostRequests";
import type { components } from "@/types/admin-api";
import { mutate as mutateGlobal } from "swr";

type HostRequest = components["schemas"]["AdminHostRequest"];
type Filter = "open" | "new" | "contacted" | "done" | "closed" | "withdrawn" | "all";
type Status = HostRequestStep["status"];
const PAGE_SIZE = 20;

function RequestCard({ request, canManage, onChanged }: { request: HostRequest; canManage: boolean; onChanged: () => void }) {
  const [notes, setNotes] = useState(request.admin_notes ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const notesChanged = notes.trim() !== (request.admin_notes ?? "").trim();

  async function update(body: { status?: Status; admin_notes?: string | null }, success: string) {
    setBusy(body.status ?? "notes");
    try {
      await adminApi.PATCH("/host-requests/{id}", { params: { path: { id: request.id } }, body }).then(unwrap);
      toast.success(success);
      onChanged();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not update the request."));
    } finally {
      setBusy(null);
    }
  }

  async function copyPhone() {
    try {
      await navigator.clipboard.writeText(request.phone);
      toast.success("Number copied.");
    } catch {
      toast.error("Could not copy the number.");
    }
  }

  const SourceIcon = request.source === "web" ? Globe : Smartphone;

  return (
    <Card>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={request.status} />
            <span className="text-xs text-slate-500" title={formatDateTime(request.created_at)}>
              Asked {relativeTime(request.created_at)}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <SourceIcon aria-hidden className="h-3.5 w-3.5" /> {SOURCE_LABELS[request.source]}
            </span>
          </div>

          <div>
            <div className="text-base font-semibold text-slate-900">{request.name}</div>
            {request.user && (
              <Link href={`/users/${request.user_id}`} className="text-xs text-slate-500 hover:text-slate-800 hover:underline">
                Account: {personName(request.user)}
              </Link>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <a href={telHref(request.phone)} className="inline-flex items-center gap-1.5 font-medium text-slate-900 hover:underline">
              <Phone aria-hidden className="h-4 w-4 text-slate-400" /> {request.phone}
            </a>
            <button type="button" onClick={() => void copyPhone()} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800" aria-label="Copy phone number">
              <Copy aria-hidden className="h-3.5 w-3.5" /> Copy
            </button>
            {request.email && (
              <a href={`mailto:${request.email}`} className="inline-flex items-center gap-1.5 text-slate-600 hover:underline">
                <Mail aria-hidden className="h-4 w-4 text-slate-400" /> {request.email}
              </a>
            )}
          </div>

          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-slate-500">City</dt>
              <dd className="flex items-center gap-1 text-slate-800">
                <MapPin aria-hidden className="h-3.5 w-3.5 text-slate-400" /> {request.city ?? "Not given"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Kind of space</dt>
              <dd className="flex items-center gap-1 text-slate-800">
                <Home aria-hidden className="h-3.5 w-3.5 text-slate-400" /> {request.space_type ?? "Not given"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Best time to call</dt>
              <dd className="flex items-center gap-1 text-slate-800">
                <Clock aria-hidden className="h-3.5 w-3.5 text-slate-400" /> {BEST_TIME_LABELS[request.best_time]}
              </dd>
            </div>
          </dl>

          {request.note && <p className="rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-700">“{request.note}”</p>}

          {request.listing && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-xs text-slate-500">Their listing</span>
              <Link href={`/locations/${request.listing.id}`} className="font-medium text-slate-900 hover:underline">
                {request.listing.title || "Untitled listing"}
              </Link>
              {request.listing.listing_code && <Badge>{request.listing.listing_code}</Badge>}
              <StatusBadge status={request.listing.status} />
            </div>
          )}

          {(request.handler || request.contacted_at) && (
            <p className="text-xs text-slate-500">
              {request.handler ? `Handled by ${personName(request.handler)}` : null}
              {request.contacted_at ? `${request.handler ? " · " : ""}first contacted ${relativeTime(request.contacted_at)}` : null}
            </p>
          )}
        </div>

        {canManage && (
          <div className="w-full shrink-0 space-y-3 lg:w-80">
            {nextSteps(request.status).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {nextSteps(request.status).map((step) => (
                  <Button
                    key={step.status}
                    variant={step.primary ? "primary" : "secondary"}
                    disabled={busy !== null}
                    onClick={() => void update({ status: step.status }, step.label === "Reopen" ? "Reopened." : `Marked ${step.status}.`)}
                  >
                    {busy === step.status ? "Saving…" : step.label}
                  </Button>
                ))}
              </div>
            )}
            <TextAreaField
              label="Team notes (never shown to them)"
              rows={3}
              maxLength={2000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Called Tue, sending photos by Friday."
            />
            {notesChanged && (
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setNotes(request.admin_notes ?? "")} disabled={busy !== null}>
                  Undo
                </Button>
                <Button onClick={() => void update({ admin_notes: notes.trim() || null }, "Notes saved.")} disabled={busy !== null}>
                  {busy === "notes" ? "Saving…" : "Save notes"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function HostRequestsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { can } = useAdminMe();
  const canManage = can("host_requests.manage");
  const filter = (searchParams.get("status") as Filter | null) ?? "open";
  const search = searchParams.get("search") ?? "";
  const page = Number(searchParams.get("page") ?? "1");

  function go(next: { status?: Filter; search?: string; page?: number }) {
    const params = new URLSearchParams();
    params.set("status", next.status ?? filter);
    const s = next.search ?? search;
    if (s) params.set("search", s);
    if (next.page && next.page > 1) params.set("page", String(next.page));
    router.replace(`/hosts/requests?${params.toString()}`, { scroll: false });
  }

  const fetcher = useCallback(
    () =>
      adminApi
        .GET("/host-requests", {
          params: { query: { page, pageSize: PAGE_SIZE, ...(filter === "all" ? {} : { status: filter }), ...(search ? { search } : {}) } },
        })
        .then(unwrapPaginated<HostRequest>),
    [page, filter, search],
  );
  const { rows, meta, isLoading, error, refresh } = useAdminList<HostRequest>(
    `/v1/admin/host-requests?status=${filter}&search=${search}&page=${page}`,
    fetcher,
  );

  function changed() {
    void refresh();
    // The sidebar count follows at once.
    void mutateGlobal("/v1/admin/host-requests/summary");
  }

  return (
    <>
      <PageHeader
        title="Host requests"
        description="People who asked us to call them and help them list a place. Call them at the time they chose, then mark the request contacted and done. Notes are for the team only."
      />
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Segmented<Filter>
          label="Status"
          value={filter}
          onChange={(next) => go({ status: next, page: 1 })}
          options={[
            { value: "open", label: "Waiting" },
            { value: "new", label: "New" },
            { value: "contacted", label: "Contacted" },
            { value: "done", label: "Done" },
            { value: "closed", label: "Closed" },
            { value: "withdrawn", label: "Withdrawn" },
            { value: "all", label: "All" },
          ]}
        />
        <div className="md:w-72">
          <SearchInput label="Search requests" value={search} onChange={(v) => go({ search: v, page: 1 })} placeholder="Name, phone, email or city…" />
        </div>
      </div>
      {isLoading && !meta ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : error ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load host requests.")} onRetry={refresh} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={filter === "open" || filter === "new" ? "Nobody is waiting for a call" : "No requests here"}
          description={search ? "Try a different search." : "New requests from the app and the website appear here."}
        />
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <RequestCard key={`${r.id}-${r.updated_at}`} request={r} canManage={canManage} onChanged={changed} />
          ))}
          {meta && meta.total > PAGE_SIZE && (
            <Pagination page={meta.page} pageSize={meta.pageSize} total={meta.total} onPageChange={(p) => go({ page: p })} label="Host requests" />
          )}
        </div>
      )}
    </>
  );
}

export default function HostRequestsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <HostRequestsInner />
    </Suspense>
  );
}
