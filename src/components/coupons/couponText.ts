import { formatMoney } from "@/lib/format";
import type { Coupon } from "./CouponForm";

export const STATUS_BADGE: Record<Coupon["status"], { label: string; tone: "success" | "info" | "neutral" | "warning" }> = {
  active: { label: "Active", tone: "success" },
  scheduled: { label: "Scheduled", tone: "info" },
  ended: { label: "Ended", tone: "neutral" },
  used_up: { label: "Fully used", tone: "neutral" },
  inactive: { label: "Paused", tone: "warning" },
};

export function discountText(c: Pick<Coupon, "discount_type" | "percent_off" | "amount_off_minor_units" | "max_discount_minor_units">): string {
  if (c.discount_type === "percent") return `${c.percent_off}% off${c.max_discount_minor_units ? ` (up to ${formatMoney(c.max_discount_minor_units)})` : ""}`;
  return `${formatMoney(c.amount_off_minor_units ?? 0)} off`;
}
