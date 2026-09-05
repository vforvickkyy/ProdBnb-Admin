"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

// Order matches operational priority, not alphabetical (Phase 14 plan §8):
// the moderation queue is the single most actionable list day-to-day.
const NAV: { href: string; label: string }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/moderation", label: "Moderation Queue" },
  { href: "/locations", label: "Locations" },
  { href: "/bookings", label: "Bookings" },
  { href: "/payments", label: "Payments" },
  { href: "/users", label: "Users" },
  { href: "/hosts", label: "Hosts" },
  { href: "/audit-log", label: "Audit Log" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="flex w-56 shrink-0 flex-col gap-1 border-r border-slate-200 bg-white p-4">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded px-3 py-2 text-sm font-medium",
              active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
