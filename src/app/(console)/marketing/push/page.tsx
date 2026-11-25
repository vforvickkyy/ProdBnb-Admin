"use client";

import { Suspense } from "react";
import { CampaignList } from "@/components/messaging/CampaignList";
import { TableSkeleton } from "@/components/ui/Skeleton";

export default function PushCampaignsPage() {
  return (
    <Suspense fallback={<TableSkeleton columns={6} />}>
      <CampaignList channel="push" />
    </Suspense>
  );
}
