"use client";

import Link from "next/link";
import { CheckCircle2, CircleSlash } from "lucide-react";
import { cn } from "@/lib/cn";
import type { MessagingOverview } from "./useMessaging";

/** Which channels can deliver right now, with device counts -- the first thing a sender needs to know. */
export function ReadinessStrip({ overview }: { overview: MessagingOverview }) {
  const items = [
    { label: "Email", ok: overview.readiness.email, href: "/messaging/email", detail: overview.readiness.email ? "SMTP connected" : "Not connected" },
    { label: "iOS push", ok: overview.readiness.push.ios, href: "/messaging/push", detail: `${overview.devices.ios} devices` },
    { label: "Android push", ok: overview.readiness.push.android, href: "/messaging/push", detail: `${overview.devices.android} devices` },
    { label: "Web push", ok: overview.readiness.push.web, href: "/messaging/push", detail: `${overview.devices.web} browsers` },
  ];
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((i) => (
        <li key={i.label}>
          <Link
            href={i.href}
            className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            {i.ok ? (
              <CheckCircle2 aria-hidden className="h-5 w-5 shrink-0 text-green-600" />
            ) : (
              <CircleSlash aria-hidden className="h-5 w-5 shrink-0 text-slate-400" />
            )}
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900">
                {i.label}
                <span className="sr-only">{i.ok ? " — ready" : " — not set up"}</span>
              </span>
              <span className={cn("block text-xs", i.ok ? "text-slate-500" : "text-amber-800")}>{i.ok ? i.detail : `Set up · ${i.detail}`}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
