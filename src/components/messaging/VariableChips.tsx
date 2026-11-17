"use client";

import { useRef } from "react";
import useSWR from "swr";
import { adminApi, unwrap } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { components } from "@/types/admin-api";

export type NotificationVariable = components["schemas"]["NotificationVariable"];

export function useVariables() {
  return useSWR("/v1/admin/notification-variables", () => adminApi.GET("/notification-variables").then(unwrap<NotificationVariable[]>), { revalidateOnFocus: false });
}

const SCOPE_LABEL = { person: "Each person", listing: "Listing", offer: "Offer" } as const;

/**
 * Click a variable to insert it where the cursor is. Listing/offer variables only show once a
 * listing/offer is picked, so nothing can be inserted that the message can't fill in.
 */
export function VariableChips({ onInsert, listing, offer, className }: { onInsert: (token: string) => void; listing: boolean; offer: boolean; className?: string }) {
  const { data } = useVariables();
  if (!data) return null;
  const scopes = (["person", "listing", "offer"] as const).filter((s) => s === "person" || (s === "listing" ? listing : offer));
  return (
    <div className={cn("rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-3", className)}>
      <p className="mb-2 text-xs text-slate-500">
        Insert a variable — it&apos;s filled in for each person. Add a fallback after a bar: <code className="rounded bg-white px-1">{"{first_name|there}"}</code>
      </p>
      <div className="space-y-2">
        {scopes.map((scope) => (
          <div key={scope} className="flex flex-wrap items-center gap-1.5">
            <span className="w-24 shrink-0 text-[11px] font-medium uppercase tracking-wide text-slate-400">{SCOPE_LABEL[scope]}</span>
            {data
              .filter((v) => v.scope === scope)
              .map((v) => (
                <button
                  key={v.key}
                  type="button"
                  title={`${v.label} — e.g. “${v.example}”`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onInsert(v.key === "first_name" ? "{first_name|there}" : `{${v.key}}`)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] text-slate-700 hover:border-accent-400 hover:text-accent-700"
                >
                  {`{${v.key}}`}
                </button>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Remembers which text field had focus (and where its cursor was) so a variable lands there. */
export function useInsertTarget<K extends string>(fields: Record<K, { value: string; set: (v: string) => void }>, fallback: NoInfer<K>) {
  const ref = useRef<{ key: K; start: number; end: number }>({ key: fallback, start: -1, end: -1 });
  const remember = (key: K) => (e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const t = e.currentTarget;
    ref.current = { key, start: t.selectionStart ?? -1, end: t.selectionEnd ?? -1 };
  };
  return {
    bind: (key: K) => ({ onFocus: remember(key), onSelect: remember(key), onKeyUp: remember(key), onClick: remember(key) }),
    insert(token: string) {
      const target = ref.current;
      const f = fields[target.key];
      const at = target.start < 0 || target.start > f.value.length ? f.value.length : target.start;
      const to = target.end < at ? at : Math.min(target.end, f.value.length);
      f.set(f.value.slice(0, at) + token + f.value.slice(to));
      ref.current = { key: target.key, start: at + token.length, end: at + token.length };
    },
  };
}
