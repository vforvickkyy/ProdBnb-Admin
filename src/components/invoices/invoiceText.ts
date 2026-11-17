import type { components } from "@/types/admin-api";

export type Invoice = components["schemas"]["Invoice"];
export type InvoiceEvent = components["schemas"]["InvoiceEvent"];
export type InvoiceSettings = components["schemas"]["InvoiceSettings"];
export type Receipt = components["schemas"]["Receipt"];

export type DeliveryFilter = "all" | "pending" | "sent_auto" | "sent_manual" | "failed";

export function deliveryBadge(inv: Pick<Invoice, "delivery_status" | "sent_via">): { tone: "success" | "warning" | "danger" | "neutral" | "info"; label: string } {
  if (inv.delivery_status === "failed") return { tone: "danger", label: "Failed" };
  if (inv.delivery_status === "pending") return { tone: "warning", label: "Pending to send" };
  return inv.sent_via === "manual" ? { tone: "info", label: "Sent manually" } : { tone: "success", label: "Sent automatically" };
}

export const EVENT_LABEL: Record<InvoiceEvent["kind"], string> = {
  issued: "Issued",
  sent_auto: "Emailed automatically",
  sent_manual: "Emailed by the team",
  failed: "Email failed",
  receipt_sent: "Receipt emailed",
};

export const pdfName = (number: string) => `${number.replace(/\//g, "-")}.pdf`;
