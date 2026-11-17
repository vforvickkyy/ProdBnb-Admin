"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { bodyFrom, CouponForm, draftFrom, draftProblem, SaveBar } from "@/components/coupons/CouponForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { extractErrorMessage } from "@/components/ui/ErrorState";
import { adminApi, unwrap } from "@/lib/api";
import { useRouter } from "@/lib/navigation";

export default function NewCouponPage() {
  const router = useRouter();
  const [draft, setDraft] = useState(() => draftFrom());
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const coupon = await adminApi
        .POST("/coupons", { body: { ...bodyFrom(draft), owner_type: draft.owner_type, host_id: draft.owner_type === "host" ? (draft.host?.id ?? null) : null } })
        .then(unwrap);
      toast.success(`${coupon.code} created.`);
      router.push(`/payments/coupons/${coupon.id}`);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not create the coupon."));
      setBusy(false);
    }
  }

  return (
    <>
      <Link href="/payments/coupons" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft aria-hidden className="h-4 w-4" /> Coupons & offers
      </Link>
      <PageHeader title="New coupon" />
      <CouponForm draft={draft} onChange={setDraft} />
      <SaveBar problem={draftProblem(draft)} busy={busy} label="Create coupon" onSave={() => void save()} />
    </>
  );
}
