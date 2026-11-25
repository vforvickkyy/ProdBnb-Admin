import type { components } from "@/types/admin-api";

type Template = components["schemas"]["AdminEmail"]["template"];

/** Plain names for the transactional emails, as the team calls them. */
export const EMAIL_TEMPLATE_LABELS: Record<Template, string> = {
  quote_request_sent: "Price request sent (booker)",
  quote_ready: "Price ready (booker)",
  booking_confirmed: "Booking confirmed (booker)",
  booking_declined: "Booking declined (booker)",
  booking_cancelled: "Booking cancelled (booker)",
  payment_success: "Payment received + receipt (booker)",
  payment_failed: "Payment failed (booker)",
  refund_processed: "Refund processed (booker)",
  booking_reminder: "Shoot tomorrow reminder (booker)",
  host_booking_request: "New booking request (host)",
  host_quote_request: "Price request (host)",
  host_booking_confirmed: "Instant booking (host)",
  host_booking_cancelled: "Booking cancelled (host)",
  listing_submitted: "Listing in review (host)",
  listing_approved: "Listing live (host)",
  listing_rejected: "Listing needs changes (host)",
  listing_suspended: "Listing paused (host)",
  listing_restored: "Listing live again (host)",
  payout_sent: "Payout sent (host)",
  host_booking_reminder: "Shoot tomorrow reminder (host)",
  welcome: "Welcome",
  auth_signup: "Sign-in: confirm email",
  auth_recovery: "Sign-in: reset password",
  auth_magiclink: "Sign-in: link / code",
  auth_invite: "Sign-in: invite",
  auth_email_change: "Sign-in: change email",
  auth_reauthentication: "Sign-in: verification code",
};

export function templateLabel(template: string): string {
  return (
    EMAIL_TEMPLATE_LABELS[template as Template] ?? template.replace(/_/g, " ")
  );
}

export const SUPPRESSION_REASONS = {
  bounced: {
    label: "Bounced",
    help: "The address doesn't exist or refused mail. Nothing is sent to it.",
  },
  unsubscribed: {
    label: "Unsubscribed",
    help: "No news and offers. Booking emails still go out.",
  },
  admin: {
    label: "Blocked by the team",
    help: "No news and offers. Booking emails still go out.",
  },
} as const;

/** Sign-in emails carry one-time links that aren't stored, so they can't be sent again from the log. */
export const isAuthEmail = (template: string) => template.startsWith("auth_");
