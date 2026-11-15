import { BellRing, Inbox, Mail } from "lucide-react";
import type { BadgeTone } from "@/components/ui/Badge";
import type { Campaign } from "./useMessaging";

export const CAMPAIGN_TONE: Record<string, BadgeTone> = {
  draft: "neutral",
  scheduled: "info",
  sending: "warning",
  sent: "success",
  cancelled: "neutral",
  failed: "danger",
};

export function audienceLabel(a: Campaign["audience"]): string {
  const x = a as { type: string; role?: string; user_ids?: string[] };
  if (x.type === "all") return "Everyone";
  if (x.type === "role") return `All ${x.role}s`;
  if (x.type === "platform_users") return "App users";
  return `${x.user_ids?.length ?? 0} people`;
}

export function ChannelIcons({ channels }: { channels: string[] }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-500">
      {channels.includes("in_app") && <Inbox aria-label="In-app" className="h-3.5 w-3.5" />}
      {channels.includes("push") && <BellRing aria-label="Push" className="h-3.5 w-3.5" />}
      {channels.includes("email") && <Mail aria-label="Email" className="h-3.5 w-3.5" />}
    </span>
  );
}

