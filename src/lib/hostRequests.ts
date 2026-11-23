import type { components } from "@/types/admin-api";

/** Wording and next steps for the Host requests page ("Request a callback" from would-be hosts). */

type HostRequest = components["schemas"]["AdminHostRequest"];

export const BEST_TIME_LABELS: Record<HostRequest["best_time"], string> = {
  morning: "Morning (9–12)",
  afternoon: "Afternoon (12–5)",
  evening: "Evening (5–8)",
  anytime: "Any time",
};

export const SOURCE_LABELS: Record<HostRequest["source"], string> = { ios: "iPhone app", android: "Android app", web: "Website" };

export interface HostRequestStep {
  status: "new" | "contacted" | "done" | "closed";
  label: string;
  primary?: boolean;
}

/** The buttons that move a request on, in the order the team uses them. Withdrawn: none. */
export function nextSteps(status: HostRequest["status"]): HostRequestStep[] {
  switch (status) {
    case "new":
      return [
        { status: "contacted", label: "Mark contacted", primary: true },
        { status: "closed", label: "Close" },
      ];
    case "contacted":
      return [
        { status: "done", label: "Mark done", primary: true },
        { status: "closed", label: "Close" },
      ];
    case "done":
    case "closed":
      return [{ status: "contacted", label: "Reopen" }];
    default:
      return [];
  }
}

/** A dialable link: digits and a leading + only ("+91 98765-43210" -> "tel:+919876543210"). */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
