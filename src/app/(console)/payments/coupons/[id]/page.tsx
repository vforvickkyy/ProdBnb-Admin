"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { bodyFrom, CouponForm, draftFrom, draftProblem, SaveBar, type CouponDraft } from "@/components/coupons/CouponForm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { Column, Table } from "@/components/ui/Table";
import { adminApi, unwrap } from "@/lib/api";
import { formatDate, formatDateTime, formatMoney, personName } from "@/lib/format";
import { useRouter } from "@/lib/navigation";
import { useAdminMe } from "@/lib/useAdminMe";
import type { components } from "@/types/admin-api";
import { discountText, STATUS_BADGE } from "@/components/coupons/couponText";

type Redemption = components["schemas"]["CouponRedemption"];

export default function CouponPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { can } = useAdminMe();
  const canEdit = can("coupons.manage");
  const { data, error, isLoading, mutate } = useSWR(`/v1/admin/coupons/${id}`, () => adminApi.GET("/coupons/{id}", { params: { path: { id } } }).then(unwrap));
  const [draft, setDraft] = useState<CouponDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    if (data) setDraft(draftFrom(data));
  }, [data]);

  if (isLoading || (data && !draft)) return <Skeleton className="h-[32rem] w-full rounded-xl" />;
  if (error || !data || !draft) return <ErrorState message={extractErrorMessage(error, "Failed to load the coupon.")} onRetry={() => mutate()} />;

  async function save(body: Record<string, unknown>, done: string) {
    setBusy(true);
    try {
      await adminApi.PATCH("/coupons/{id}", { params: { path: { id } }, body: body as never }).then(unwrap);
      toast.success(done);
      await mutate();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not save."));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await adminApi.DELETE("/coupons/{id}", { params: { path: { id } } }).then(unwrap);
      toast.success("Coupon deleted.");
      router.push("/payments/coupons");
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not delete it."));
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  const columns: Column<Redemption>[] = [
    { key: "when", header: "Used", render: (r) => formatDateTime(r.created_at) },
    { key: "who", header: "Booker", render: (r) => (r.booker ? personName(r.booker) : "—") },
    {
      key: "booking",
      header: "Booking",
      render: (r) => (
        <Link href={`/bookings/${r.booking_id}`} className="underline hover:text-slate-900">
          {r.booking?.location?.title ?? "Booking"} · {r.booking ? formatDate(r.booking.start_at) : ""}
        </Link>
      ),
    },
    { key: "status", header: "Status", render: (r) => (r.booking ? <Badge tone={r.booking.paid ? "success" : "neutral"}>{r.booking.paid ? `Paid · ${r.booking.status}` : r.booking.status}</Badge> : "—") },
    { key: "discount", header: "Discount", render: (r) => <span className="tabular-nums">{formatMoney(r.discount_minor_units)}</span> },
  ];

  const st = STATUS_BADGE[data.status];
  return (
    <>
      <Link href="/payments/coupons" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft aria-hidden className="h-4 w-4" /> Coupons & offers
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 font-mono text-2xl font-semibold tracking-tight text-slate-900">
            {data.code} <Badge tone={st.tone}>{st.label}</Badge>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {data.title} · {discountText(data)} · {data.owner_type === "platform" ? "From ProdBnb" : `From ${data.host ? personName(data.host) : "a host"} (comes out of their earning)`}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => void save({ is_active: !data.is_active }, data.is_active ? "Paused." : "Active again.")}>
              {data.is_active ? "Pause" : "Resume"}
            </Button>
            {data.uses === 0 && (
              <Button variant="danger" disabled={busy} onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Uses" value={`${data.uses}${data.usage_limit ? ` / ${data.usage_limit}` : ""}`} />
        <StatTile label="Discount given (paid bookings)" value={formatMoney(data.discount_given_minor_units)} hint={data.owner_type === "platform" ? "Paid by ProdBnb" : "Paid by the host"} />
        <StatTile label="Runs" value={data.ends_at ? `until ${formatDate(data.ends_at)}` : "No end date"} hint={data.starts_at ? `from ${formatDate(data.starts_at)}` : undefined} />
      </div>

      <Card title="Who used it" className="mb-6">
        {data.redemptions.length === 0 ? <p className="text-sm text-slate-500">Nobody yet.</p> : <Table columns={columns} rows={data.redemptions} rowKey={(r) => r.id} caption="Uses" />}
      </Card>

      {canEdit ? (
        <>
          <CouponForm draft={draft} onChange={setDraft} editing />
          <SaveBar
            problem={draftProblem(draft)}
            busy={busy}
            label="Save changes"
            onSave={() => {
              const body = bodyFrom(draft);
              void save(body, "Saved. Bookings already made keep their discount.");
            }}
          />
        </>
      ) : (
        <p className="text-sm text-slate-500">Editing coupons needs the coupons permission (finance or moderator).</p>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(false)}
        title={`Delete ${data.code}?`}
        description="Nobody has used it, so it can be deleted for good."
        danger
        busy={busy}
        confirmLabel="Delete coupon"
        onConfirm={() => void remove()}
      />
    </>
  );
}
