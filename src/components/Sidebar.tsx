"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BellRing,
  CalendarCheck,
  CreditCard,
  Home,
  Layers,
  LayoutDashboard,
  LineChart,
  Mail,
  MapPin,
  Megaphone,
  MessagesSquare,
  MonitorSmartphone,
  ScrollText,
  Settings,
  ShieldCheck,
  Tags,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { AdminPermission } from "@/lib/useAdminMe";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Hidden when the signed-in admin's team role lacks this. UI only -- the API enforces it too. */
  permission?: AdminPermission;
  /** Extra words the command palette matches on. */
  keywords?: string;
}

// Grouped by job, ordered by operational priority within each group (the moderation queue and the
// money that needs attention are the most actionable lists day to day).
export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, keywords: "home overview" },
      { href: "/analytics", label: "Analytics", icon: LineChart, permission: "analytics.view", keywords: "revenue gmv charts" },
    ],
  },
  {
    label: "Marketplace",
    items: [
      { href: "/moderation", label: "Moderation Queue", icon: ShieldCheck, permission: "locations.view", keywords: "approve review" },
      { href: "/locations", label: "Locations", icon: MapPin, permission: "locations.view", keywords: "listings properties" },
      { href: "/catalog", label: "Catalog", icon: Tags, permission: "locations.view", keywords: "categories amenities use cases" },
      { href: "/collections", label: "Collections", icon: Layers, permission: "locations.view", keywords: "curated featured" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/bookings", label: "Bookings", icon: CalendarCheck, permission: "bookings.view" },
      { href: "/payments", label: "Payments", icon: CreditCard, permission: "payments.view", keywords: "refunds" },
      { href: "/conversations", label: "Disputes & Messages", icon: MessagesSquare, permission: "messages.access", keywords: "chat" },
    ],
  },
  {
    label: "Engagement",
    items: [
      { href: "/messaging", label: "Announcements", icon: Megaphone, permission: "campaigns.view", keywords: "notifications broadcast campaign" },
      { href: "/messaging/email", label: "Email", icon: Mail, permission: "campaigns.view", keywords: "smtp" },
      { href: "/messaging/push", label: "Push notifications", icon: BellRing, permission: "campaigns.view", keywords: "apns fcm web push" },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/users", label: "Users", icon: Users, permission: "users.view" },
      { href: "/hosts", label: "Hosts", icon: Home, permission: "users.view" },
      { href: "/team", label: "Admin Team", icon: UserCog, keywords: "roles staff" },
    ],
  },
  {
    label: "Platform",
    items: [
      {
        href: "/platforms",
        label: "Platforms & Releases",
        icon: MonitorSmartphone,
        permission: "platforms.view",
        keywords: "ios android web versions feature flags incidents",
      },
      { href: "/settings", label: "Settings", icon: Settings, permission: "settings.view", keywords: "fees tax" },
      { href: "/system", label: "Integrations & Health", icon: Activity, permission: "system.view", keywords: "secrets status" },
      { href: "/audit-log", label: "Audit Log", icon: ScrollText, permission: "audit.view" },
    ],
  },
];

export function visibleNavGroups(permissions?: readonly AdminPermission[]) {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || !permissions || permissions.includes(item.permission)),
  })).filter((group) => group.items.length > 0);
}

/** The most specific nav item matching the path, so /messaging/email does not also light up /messaging. */
function activeHref(pathname: string | null): string | null {
  if (!pathname) return null;
  let best: string | null = null;
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if ((pathname === item.href || pathname.startsWith(`${item.href}/`)) && (!best || item.href.length > best.length)) {
        best = item.href;
      }
    }
  }
  return best;
}

export function Sidebar({
  navLabel = "Admin sections",
  permissions,
  onNavigate,
}: {
  navLabel?: string;
  /** Omitted (e.g. while /me loads) = show every item; the API is the real gate either way. */
  permissions?: readonly AdminPermission[];
  onNavigate?: () => void;
} = {}) {
  const pathname = usePathname();
  const current = activeHref(pathname);

  // `ink`/`snow` never flip with the theme: the sidebar is dark in both.
  return (
    <nav
      aria-label={navLabel}
      className="flex h-full w-60 shrink-0 flex-col gap-5 overflow-y-auto border-r border-ink-800 bg-ink-950 px-3 py-5 text-ink-300"
    >
      <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2 px-2">
        <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-md bg-[#c28014] text-sm font-bold text-snow">
          P
        </span>
        <span className="text-base font-semibold text-snow">
          Prod<span className="text-[#de9c33]">.</span>Bnb
        </span>
        <span className="rounded bg-ink-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-300">Admin</span>
      </Link>
      {visibleNavGroups(permissions).map((group) => (
        <div key={group.label}>
          <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">{group.label}</div>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = item.href === current;
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#de9c33]",
                      active ? "bg-ink-800 text-snow" : "text-ink-400 hover:bg-ink-900 hover:text-snow",
                    )}
                  >
                    <Icon
                      aria-hidden
                      className={cn("h-4 w-4 shrink-0 transition-colors", active ? "text-[#de9c33]" : "text-ink-500 group-hover:text-ink-300")}
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="mt-auto px-2 text-[11px] text-ink-500">
        Press <kbd className="rounded border border-ink-700 px-1 font-sans text-ink-400">⌘K</kbd> to jump anywhere
      </div>
    </nav>
  );
}
