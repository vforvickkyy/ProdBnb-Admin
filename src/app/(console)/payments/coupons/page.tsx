"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { Column, Table } from "@/components/ui/Table";
import type { Coupon } from "@/components/coupons/CouponForm";
import { discountText, STATUS_BADGE } from "@/components/coupons/couponText";
import { adminApi, unwrapPaginated } from "@/lib/api";
import { formatDate, formatMoney, personName } from "@/lib/format";
import { useRouter } from "@/lib/navigation";
import { useAdminMe } from "@/lib/useAdminMe";

type Owner = "all" | "platform" | "host";
type Status = "all" | "active" | "scheduled" | "ended" | "inactive";

function CouponsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { can } = useAdminMe();
  const owner = (params.get("owner") as Owner | null) ?? "all";
  const status = (params.get("status") as Status | null) ?? "all";
  const go = (next: Record<string, string>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) p.set(k, v);
    router.replace(`/payments/coupons?${p}`, { scroll: false });
  };
  const { data, error, isLoading, mutate } = useSWR(`/v1/admin/coupons?owner=${owner}&status=${status}`, () =>
    adminApi.GET("/coupons", { params: { query: { owner, status, page: 1, pageSize: 100 } } }).then(unwrapPaginated<Coupon>),
  );

  const columns: Column<Coupon>[] = [
    {
      key: "code",
      header: "Code",
      render: (c) => (
        <Link href={`/payments/coupons/${c.id}`} className="font-mono font-semibold text-slate-900 underline-offset-2 hover:underline">
          {c.code}
        </Link>
      ),
    },
    { key: "title", header: "Offer", render: (c) => <span className="text-slate-700">{c.title}</span> },
    { key: "discount", header: "Discount", render: (c) => discountText(c) },
    { key: "from", header: "From", render: (c) => (c.owner_type === "platform" ? "ProdBnb" : c.host ? personName(c.host) : "Host") },
    { key: "status", header: "Status", render: (c) => <Badge tone={STATUS_BADGE[c.status].tone}>{STATUS_BADGE[c.status].label}</Badge> },
    { key: "uses", header: "Uses", render: (c) => <span className="tabular-nums">{c.uses}{c.usage_limit ? ` / ${c.usage_limit}` : ""}</span> },
    { key: "given", header: "Discount given", render: (c) => <span className="tabular-nums">{formatMoney(c.discount_given_minor_units)}</span> },
    { key: "ends", header: "Ends", render: (c) => (c.ends_at ? formatDate(c.ends_at) : "—") },
  ];

  return (
    <>
      <PageHeader
        title="Coupons & offers"
        description="ProdBnb's coupons (we pay the discount) and hosts' coupons (they do). The discount comes off the listing price, before the service fee and tax."
        actions={
          can("coupons.manage") ? (
            <Link
              href="/payments/coupons/new"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent-500 px-3 text-[13px] font-medium text-snow shadow-sm hover:bg-accent-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
            >
              <Plus aria-hidden className="h-4 w-4" /> New coupon
            </Link>
          ) : undefined
        }
      />
      <div className="mb-5 flex flex-wrap gap-3">
        <Segmented<Owner>
          label="From"
          value={owner}
          onChange={(v) => go({ owner: v })}
          options={[
            { value: "all", label: "All" },
            { value: "platform", label: "ProdBnb" },
            { value: "host", label: "Hosts" },
          ]}
        />
        <Segmented<Status>
          label="Status"
          value={status}
          onChange={(v) => go({ status: v })}
          options={[
            { value: "all", label: "Any status" },
            { value: "active", label: "Active" },
            { value: "scheduled", label: "Scheduled" },
            { value: "ended", label: "Ended" },
            { value: "inactive", label: "Paused" },
          ]}
        />
      </div>
      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : error || !data ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load coupons.")} onRetry={() => mutate()} />
      ) : data.data.length === 0 ? (
        <EmptyState title="No coupons here yet" description="Create one, or wait for hosts to run their own offers." />
      ) : (
        <Table columns={columns} rows={data.data} rowKey={(c) => c.id} caption="Coupons" />
      )}
    </>
  );
}

export default function CouponsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <CouponsInner />
    </Suspense>
  );
}
