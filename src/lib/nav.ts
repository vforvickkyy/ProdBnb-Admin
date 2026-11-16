import {
  CalendarCheck,
  CreditCard,
  Globe,
  LayoutDashboard,
  MapPin,
  Megaphone,
  MonitorSmartphone,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { AdminPermission } from "@/lib/useAdminMe";

/**
 * The console's navigation, Supabase-style: a short rail of sections, each with its own grouped
 * sub-menu. One source of truth for the desktop rail + sub-sidebar, the mobile drawer, the header
 * breadcrumb and the command palette.
 *
 * Permissions are UI only -- the API enforces the same permission on every call.
 */
export interface NavItem {
  /** May carry a query (`/platforms?tab=flags`): it then matches only when those params match. */
  href: string;
  label: string;
  /** Hidden when the signed-in admin's team role lacks this. */
  permission?: AdminPermission;
  /** Extra words the command palette matches on. */
  keywords?: string;
}

export interface NavGroup {
  /** Small uppercase heading in the sub-sidebar; omitted for the first, unlabelled group. */
  label?: string;
  items: NavItem[];
}

export interface NavSection {
  id: string;
  label: string;
  icon: LucideIcon;
  groups: NavGroup[];
  /** Pinned to the bottom of the rail (Settings). */
  bottom?: boolean;
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "home",
    label: "Overview",
    icon: LayoutDashboard,
    groups: [
      {
        items: [
          { href: "/dashboard", label: "Overview", keywords: "home dashboard summary" },
          { href: "/analytics", label: "Analytics", permission: "analytics.view", keywords: "revenue gmv charts growth" },
        ],
      },
    ],
  },
  {
    id: "listings",
    label: "Listings",
    icon: MapPin,
    groups: [
      {
        label: "Manage",
        items: [
          { href: "/moderation", label: "Moderation queue", permission: "locations.view", keywords: "approve review pending" },
          { href: "/locations", label: "All listings", permission: "locations.view", keywords: "locations properties" },
          { href: "/locations/new", label: "New listing", permission: "locations.create", keywords: "create add location host" },
        ],
      },
      {
        label: "Curation",
        items: [
          { href: "/catalog", label: "Catalog", permission: "locations.view", keywords: "categories amenities use cases" },
          { href: "/collections", label: "Collections", permission: "locations.view", keywords: "curated featured" },
        ],
      },
    ],
  },
  {
    id: "bookings",
    label: "Bookings",
    icon: CalendarCheck,
    groups: [
      {
        items: [
          { href: "/bookings", label: "All bookings", permission: "bookings.view", keywords: "reservations shoots" },
          { href: "/conversations", label: "Disputes & messages", permission: "messages.access", keywords: "chat support" },
        ],
      },
    ],
  },
  {
    id: "money",
    label: "Payments",
    icon: CreditCard,
    groups: [
      {
        items: [
          { href: "/payments", label: "Payments", permission: "payments.view", keywords: "money transactions cashfree" },
          { href: "/payments/refund-requests", label: "Refund requests", permission: "payments.view", keywords: "refund approve decline cancel money back booker" },
          { href: "/payments/refunds", label: "Refunds", permission: "payments.view", keywords: "money back" },
          { href: "/payments/payouts", label: "Host payouts", permission: "payments.view", keywords: "payout pay host bank transfer earnings utr settlement" },
        ],
      },
      {
        label: "Configuration",
        items: [{ href: "/charges", label: "Charges & taxes", permission: "settings.view", keywords: "fees tax gst platform fee" }],
      },
    ],
  },
  {
    id: "people",
    label: "People",
    icon: Users,
    groups: [
      {
        items: [
          { href: "/users", label: "Users", permission: "users.view", keywords: "bookers accounts" },
          { href: "/hosts", label: "Hosts", permission: "users.view", keywords: "owners" },
          { href: "/users/deletion-requests", label: "Deletion requests", permission: "users.view", keywords: "delete account privacy gdpr dpdp erase" },
        ],
      },
    ],
  },
  {
    id: "messaging",
    label: "Messaging",
    icon: Megaphone,
    groups: [
      {
        label: "Send",
        items: [
          { href: "/messaging", label: "Sent & scheduled", permission: "campaigns.view", keywords: "announcements campaigns history" },
          { href: "/messaging/new", label: "New announcement", permission: "campaigns.send", keywords: "notify broadcast campaign" },
          { href: "/messaging/new?kind=direct", label: "Message users", permission: "campaigns.send", keywords: "direct notify specific" },
        ],
      },
      {
        label: "Channels",
        items: [
          { href: "/messaging/email", label: "Email", permission: "campaigns.view", keywords: "smtp" },
          { href: "/messaging/push", label: "Push notifications", permission: "campaigns.view", keywords: "apns fcm web push" },
        ],
      },
    ],
  },
  {
    id: "platforms",
    label: "Platforms",
    icon: MonitorSmartphone,
    groups: [
      {
        items: [
          { href: "/platforms", label: "Status & incidents", permission: "platforms.view", keywords: "ios android web live issues" },
          { href: "/platforms?tab=releases", label: "Releases", permission: "platforms.view", keywords: "updates versions ship" },
          { href: "/platforms?tab=flags", label: "Feature flags", permission: "platforms.view", keywords: "features rollout" },
          { href: "/platforms?tab=versions", label: "App versions", permission: "platforms.view", keywords: "devices adoption" },
        ],
      },
    ],
  },
  {
    id: "website",
    label: "Website",
    icon: Globe,
    groups: [
      {
        label: "Setup",
        items: [
          { href: "/website/domains", label: "Domains", permission: "site.view", keywords: "domain dns custom url vercel primary" },
          { href: "/website/maps", label: "Google Maps", permission: "site.view", keywords: "maps places api key location search" },
        ],
      },
      {
        label: "Content",
        items: [
          { href: "/website/pages", label: "Pages", permission: "site.view", keywords: "privacy terms refund policy about contact footer legal" },
          { href: "/website/seo", label: "SEO", permission: "site.view", keywords: "meta title description search google noindex share image" },
        ],
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    bottom: true,
    groups: [
      {
        label: "Configuration",
        items: [
          { href: "/settings", label: "General", keywords: "booking rules unpaid holds appearance preferences" },
          { href: "/system", label: "Integrations & health", permission: "system.view", keywords: "secrets status keys" },
        ],
      },
      {
        label: "Access",
        items: [
          { href: "/team", label: "Admin team", keywords: "roles staff members" },
          { href: "/audit-log", label: "Audit log", permission: "audit.view", keywords: "history actions trail" },
        ],
      },
    ],
  },
];

function allowed(item: NavItem, permissions?: readonly AdminPermission[]) {
  return !item.permission || !permissions || permissions.includes(item.permission);
}

/** Sections (and their groups) the admin's role can use; a section with nothing left is dropped. */
export function visibleSections(permissions?: readonly AdminPermission[]): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    groups: section.groups
      .map((group) => ({ ...group, items: group.items.filter((item) => allowed(item, permissions)) }))
      .filter((group) => group.items.length > 0),
  })).filter((section) => section.groups.length > 0);
}

export function sectionItems(section: NavSection): NavItem[] {
  return section.groups.flatMap((group) => group.items);
}

/** Where clicking a section in the rail goes: its first page the admin can open. */
export function sectionHref(section: NavSection): string {
  return sectionItems(section)[0]?.href ?? "/dashboard";
}

/**
 * How well an item matches the current URL, or -1. Path prefix length decides (so /messaging/email
 * beats /messaging); an item's own query params must all match and add specificity
 * (/platforms?tab=flags beats /platforms).
 */
function matchScore(item: NavItem, pathname: string, search: URLSearchParams): number {
  const [path, query] = item.href.split("?") as [string, string | undefined];
  if (pathname !== path && !pathname.startsWith(`${path}/`)) return -1;
  let score = path.length * 10;
  if (query) {
    for (const [key, value] of new URLSearchParams(query)) {
      if (search.get(key) !== value) return -1;
      score += 1;
    }
  }
  return score;
}

export interface ActiveNav {
  section: NavSection;
  item: NavItem;
}

/** The single most specific item for a URL (searched across every section, unfiltered by role). */
export function findActive(pathname: string | null, search: URLSearchParams | string = "", sections = NAV_SECTIONS): ActiveNav | null {
  if (!pathname) return null;
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  let best: (ActiveNav & { score: number }) | null = null;
  for (const section of sections) {
    for (const item of sectionItems(section)) {
      const score = matchScore(item, pathname, params);
      if (score >= 0 && (!best || score > best.score)) best = { section, item, score };
    }
  }
  return best ? { section: best.section, item: best.item } : null;
}
