"use client";

import { DeliveryEngine } from "@/components/messaging/DeliveryEngine";
import { useMessagingOverview } from "@/components/messaging/useMessaging";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAdminMe } from "@/lib/useAdminMe";

export default function DeliveryPage() {
  const overview = useMessagingOverview();
  const { can } = useAdminMe();
  return (
    <>
      <PageHeader title="Background sending" description="The every-minute worker behind scheduled campaigns, large audiences, email retries and booking reminders." />
      {overview.data ? <DeliveryEngine jobs={overview.data.jobs} canManage={can("channels.manage")} onChanged={() => overview.mutate()} /> : <Skeleton className="h-64 w-full" />}
    </>
  );
}
