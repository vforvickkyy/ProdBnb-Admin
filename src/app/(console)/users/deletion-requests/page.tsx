"use client";

import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { TextAreaField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, unwrap, unwrapPaginated } from "@/lib/api";
import { formatDateTime, personName, relativeTime } from "@/lib/format";
import { useRouter } from "@/lib/navigation";
import { useAdminList } from "@/lib/useAdminList";
import { useAdminMe } from "@/lib/useAdminMe";
import type { components } from "@/types/admin-api";

type DeletionRequest = components["schemas"]["AdminDeletionRequest"];
type Status = "pending" | "completed" | "declined" | "withdrawn" | "all";
const PAGE_SIZE = 20;

function blockerText(b: NonNullable<DeletionRequest["blockers"]>): string | null {
  const parts = [
    b.upcoming_bookings > 0 ? `${b.upcoming_bookings} upcoming booking${b.upcoming_bookings === 1 ? "" : "s"}` : null,
    b.upcoming_hosted_bookings > 0 ? `${b.upcoming_hosted_bookings} upcoming booking${b.upcoming_hosted_bookings === 1 ? "" : "s"} at their listings` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" and ") : null;
}

function DeclineDialog({ request, onClose, onDone }: { request: DeletionRequest; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function decline() {
    setBusy(true);
    try {
      await adminApi.POST("/deletion-requests/{id}/decline", { params: { path: { id: request.id } }, body: { note: note.trim() } }).then(unwrap);
      toast.success("Request declined.");
      onDone();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not decline the request."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Decline deletion request" description="The person sees this note in their account.">
      <div className="space-y-4">
        <TextAreaField label="Why" rows={4} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="e.g. There is an open payment dispute on your account." />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void decline()} disabled={busy || !note.trim()}>
            {busy ? "Declining…" : "Decline"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function DeletionRequestsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { can } = useAdminMe();
  const canDecide = can("users.manage");
  const status = (searchParams.get("status") as Status | null) ?? "pending";
  const page = Number(searchParams.get("page") ?? "1");
  const [completing, setCompleting] = useState<DeletionRequest | null>(null);
  const [declining, setDeclining] = useState<DeletionRequest | null>(null);
  const [busy, setBusy] = useState(false);

  const fetcher = useCallback(
    () =>
      adminApi
        .GET("/deletion-requests", { params: { query: { page, pageSize: PAGE_SIZE, ...(status === "all" ? {} : { status }) } } })
        .then(unwrapPaginated<DeletionRequest>),
    [page, status],
  );
  const { rows, meta, isLoading, error, refresh } = useAdminList<DeletionRequest>(`/v1/admin/deletion-requests?status=${status}&page=${page}`, fetcher);

  async function complete(note?: string) {
    if (!completing) return;
    setBusy(true);
    try {
      await adminApi
        .POST("/deletion-requests/{id}/complete", { params: { path: { id: completing.id } }, body: note ? { note } : {} })
        .then(unwrap);
      toast.success("Account deleted. Their bookings and payments are kept for the records.");
      setCompleting(null);
      void refresh();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not delete the account."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Deletion requests"
        description="People who asked to delete their account. Completing one anonymises their profile, removes contact and billing details, archives their listings and locks sign-in. Bookings and payments stay for tax and dispute records."
      />
      <div className="mb-5">
        <Segmented<Status>
          label="Status"
          value={status}
          onChange={(next) => router.replace(`/users/deletion-requests?status=${next}`, { scroll: false })}
          options={[
            { value: "pending", label: "To review" },
            { value: "completed", label: "Completed" },
            { value: "declined", label: "Declined" },
            { value: "withdrawn", label: "Withdrawn" },
            { value: "all", label: "All" },
          ]}
        />
      </div>
      {isLoading && !meta ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : error ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load deletion requests.")} onRetry={refresh} />
      ) : rows.length === 0 ? (
        <EmptyState title={status === "pending" ? "Nothing to review" : "No requests here"} />
      ) : (
        <div className="space-y-4">
          {rows.map((r) => {
            const blocked = r.blockers ? blockerText(r.blockers) : null;
            return (
              <Card key={r.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={r.status} />
                      <span className="text-xs text-slate-500" title={formatDateTime(r.created_at)}>
                        Asked {relativeTime(r.created_at)}
                      </span>
                    </div>
                    <div className="text-sm">
                      <Link href={`/users/${r.user_id}`} className="font-medium text-slate-900 hover:underline">
                        {r.user ? personName(r.user) : "Unknown user"}
                      </Link>
                      {r.email && <span className="ml-2 text-slate-500">{r.email}</span>}
                    </div>
                    {r.reason && <p className="rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-700">“{r.reason}”</p>}
                    {blocked && (
                      <p className="flex items-center gap-2 text-[13px] text-amber-700">
                        <AlertTriangle aria-hidden className="h-4 w-4" /> Can&apos;t complete yet: {blocked}.
                      </p>
                    )}
                    {r.status !== "pending" && r.decision_note && <p className="text-[13px] text-slate-500">Note: {r.decision_note}</p>}
                  </div>
                  {r.status === "pending" && canDecide && (
                    <div className="flex gap-2">
                      <Button variant="danger" onClick={() => setCompleting(r)} disabled={Boolean(blocked)}>
                        Delete account
                      </Button>
                      <Button onClick={() => setDeclining(r)}>Decline</Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
          {meta && meta.total > PAGE_SIZE && (
            <Pagination page={meta.page} pageSize={meta.pageSize} total={meta.total} onPageChange={(p) => router.push(`/users/deletion-requests?status=${status}&page=${p}`)} label="Deletion requests" />
          )}
        </div>
      )}
      {!canDecide && rows.some((r) => r.status === "pending") && <p className="mt-4 text-sm text-slate-500">Only moderators and super admins can complete or decline these.</p>}
      <ConfirmDialog
        open={completing !== null}
        onOpenChange={(open) => !open && setCompleting(null)}
        title={`Delete ${completing?.user ? personName(completing.user) : "this account"}?`}
        description="Their name, contact details, photo and billing details are removed, listings archived and sign-in locked. This can't be undone."
        confirmLabel="Delete account"
        optionalReason
        danger
        busy={busy}
        onConfirm={(note) => void complete(note)}
      />
      {declining && <DeclineDialog request={declining} onClose={() => setDeclining(null)} onDone={() => { setDeclining(null); void refresh(); }} />}
    </>
  );
}

export default function DeletionRequestsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <DeletionRequestsInner />
    </Suspense>
  );
}
