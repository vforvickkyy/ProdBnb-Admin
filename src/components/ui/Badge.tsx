import { cn } from "@/lib/cn";

// Status is never conveyed by color alone -- every badge carries its own
// text label too, so it reads correctly for a colorblind admin or when
// screenshotted in grayscale.
export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  success: "bg-green-50 text-green-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  info: "bg-accent-50 text-accent-700",
};

const DOT_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-slate-400",
  success: "bg-green-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-accent-500",
};

/** A quiet tinted pill (Console 3); `dot` adds the "● Set" status dot. */
export function Badge({ tone = "neutral", dot = false, children }: { tone?: BadgeTone; dot?: boolean; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium", TONE_CLASSES[tone])}>
      {dot && <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_CLASSES[tone])} />}
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
  // Callback requests from would-be hosts
  new: "warning",
  contacted: "info",
  done: "success",
  closed: "neutral",
  withdrawn: "neutral",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? "neutral"} dot>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
