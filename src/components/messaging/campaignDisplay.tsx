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
  const x = a as { type: string; role?: string; user_ids?: string[]; professions?: string[]; cities?: string[]; use_case_ids?: string[]; booked?: string; new_listing_alerts?: boolean };
  if (x.type === "all") return "Everyone";
  if (x.type === "role") return `All ${x.role}s`;
  if (x.type === "platform_users") return "App users";
  if (x.type === "segment") {
    const parts = [
      x.role ? `${x.role}s` : null,
      x.professions?.length ? x.professions.map((p) => p.replace(/_/g, " ")).join(" / ") : null,
      x.cities?.length ? `in ${x.cities.join(", ")}` : null,
      x.use_case_ids?.length ? `${x.use_case_ids.length} shoot type${x.use_case_ids.length === 1 ? "" : "s"}` : null,
      x.booked === "yes" ? "who have booked" : x.booked === "no" ? "who haven't booked" : null,
      x.new_listing_alerts ? "with alerts on" : null,
    ].filter(Boolean);
    return parts.length ? `Group: ${parts.join(", ")}` : "Everyone (no filters)";
  }
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

