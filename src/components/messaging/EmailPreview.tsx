"use client";

import { useState } from "react";
import { Monitor, Moon, Smartphone, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * The email exactly as the backend renders it (same code that sends it), in a sandboxed frame.
 * "Dark" switches on the email's own dark-mode rules (what Apple Mail and most phone apps show);
 * "Phone" narrows it to a phone's width.
 */
export function EmailPreview({ html, subject, problem, loading }: { html: string | null; subject: string | null; problem?: string | null; loading?: boolean }) {
  const [dark, setDark] = useState(false);
  const [phone, setPhone] = useState(false);
  const doc = html ? (dark ? html.replace(/<html lang="en">/, '<html lang="en" class="pb-force-dark">') : html) : null;

  const toggle = (on: boolean, set: (v: boolean) => void, a: { icon: typeof Sun; label: string }, b: { icon: typeof Sun; label: string }) => (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group">
      {[a, b].map((opt, i) => {
        const active = (i === 1) === on;
        const Icon = opt.icon;
        return (
          <button
            key={opt.label}
            type="button"
            aria-pressed={active}
            onClick={() => set(i === 1)}
            className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs", active ? "bg-slate-900 text-snow" : "text-slate-600 hover:text-slate-900")}
          >
            <Icon aria-hidden className="h-3.5 w-3.5" /> {opt.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <p className="min-w-0 flex-1 truncate text-xs text-slate-600">
          <b>Subject:</b> {subject || "—"}
        </p>
        <div className="flex gap-1.5">
          {toggle(dark, setDark, { icon: Sun, label: "Light" }, { icon: Moon, label: "Dark" })}
          {toggle(phone, setPhone, { icon: Monitor, label: "Desktop" }, { icon: Smartphone, label: "Phone" })}
        </div>
      </div>
      <div className={cn("flex justify-center p-3", dark ? "bg-[#0b0b0c]" : "bg-[#f4f4f5]")}>
        {doc ? (
          <iframe
            title="Email preview"
            sandbox=""
            srcDoc={doc}
            className={cn("h-[640px] rounded-md border-0 bg-transparent transition-[width]", phone ? "w-[375px]" : "w-full")}
          />
        ) : (
          <div className="flex h-48 w-full items-center justify-center px-6 text-center text-sm text-slate-500">
            {loading ? "Building the preview…" : problem ? problem : "Write a subject and message to see the email."}
          </div>
        )}
      </div>
    </div>
  );
}
