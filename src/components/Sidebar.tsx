"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { AdminPermission } from "@/lib/useAdminMe";

interface NavItem {
  href: string;
  label: string;
  /** Hidden when the signed-in admin's team role lacks this. UI only -- the API enforces it too. */
  permission?: AdminPermission;
}

// Grouped by job, ordered by operational priority within each group (the moderation queue and the
// money that needs attention are the most actionable lists day to day).
export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/analytics", label: "Analytics", permission: "analytics.view" },
    ],
  },
  {
    label: "Marketplace",
    items: [
      { href: "/moderation", label: "Moderation Queue", permission: "locations.view" },
      { href: "/locations", label: "Locations", permission: "locations.view" },
      { href: "/catalog", label: "Catalog", permission: "locations.view" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/bookings", label: "Bookings", permission: "bookings.view" },
      { href: "/payments", label: "Payments", permission: "payments.view" },
      { href: "/conversations", label: "Disputes & Messages", permission: "messages.access" },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/users", label: "Users", permission: "users.view" },
      { href: "/hosts", label: "Hosts", permission: "users.view" },
      { href: "/team", label: "Admin Team" },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/settings", label: "Settings", permission: "settings.view" },
      { href: "/system", label: "Integrations & Health", permission: "system.view" },
      { href: "/audit-log", label: "Audit Log", permission: "audit.view" },
    ],
  },
];

export function Sidebar({
  navLabel = "Admin sections",
  permissions,
}: {
  navLabel?: string;
  /** Omitted (e.g. while /me loads) = show every item; the API is the real gate either way. */
  permissions?: readonly AdminPermission[];
} = {}) {
  const pathname = usePathname();

  return (
    <nav aria-label={navLabel} className="flex h-full w-60 shrink-0 flex-col gap-5 overflow-y-auto bg-slate-950 px-3 py-5 text-slate-300">
      <Link href="/dashboard" className="flex items-center gap-2 px-2">
        <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-500 text-sm font-bold text-white">
          P
        </span>
        <span className="text-base font-semibold text-white">
          Prod<span className="text-brand-400">.</span>Bnb
        </span>
        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">Admin</span>
      </Link>
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((item) => !item.permission || !permissions || permissions.includes(item.permission));
        if (items.length === 0) return null;
        return (
          <div key={group.label}>
            <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{group.label}</div>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                        active ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-white"
                      )}
                    >
                      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-brand-400" : "bg-transparent")} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
