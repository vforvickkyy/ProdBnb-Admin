import { cn } from "@/lib/cn";

// Status is never conveyed by color alone -- every badge carries its own
// text label too, so it reads correctly for a colorblind admin or when
// screenshotted in grayscale.
export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  success: "bg-green-50 text-green-700 ring-green-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  info: "bg-blue-50 text-blue-700 ring-blue-200",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONE_CLASSES[tone]
      )}
    >
      {children}
    </span>
  );
}

// Central mapping so every page renders the same status the same way,
// instead of each page inventing its own color choice.
const STATUS_TONE: Record<string, BadgeTone> = {
  active: "success",
  published: "success",
  confirmed: "success",
  success: "success",
  sent: "success",
  completed: "success",
  suspended: "danger",
  rejected: "danger",
  cancelled: "danger",
  failed: "danger",
  invalid_token: "danger",
  deleted: "danger",
  draft: "neutral",
  archived: "neutral",
  skipped: "neutral",
  submitted: "info",
  under_review: "info",
  approved: "info",
  requested: "warning",
  pending: "warning",
  created: "warning",
  partially_refunded: "warning",
  refunded: "info",
  // Messaging (Admin Console 2)
  partial: "warning",
  scheduled: "info",
  sending: "warning",
  no_devices: "neutral",
  opted_out: "neutral",
  unsubscribed: "neutral",
  no_email: "neutral",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{status.replace(/_/g, " ")}</Badge>;
}
