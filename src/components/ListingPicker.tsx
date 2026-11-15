"use client";

import { useEffect, useState } from "react";
import { Check, ImageIcon, Plus, Search } from "lucide-react";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { adminApi, unwrapPaginated } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { components } from "@/types/admin-api";

type Listing = components["schemas"]["AdminLocationListItem"];

/** Search listings by title and pick several to add. `exclude` hides ones already added. */
export function ListingPicker({
  exclude,
  onAdd,
  busy,
  publishedOnly = false,
}: {
  exclude: Set<string>;
  onAdd: (ids: string[]) => Promise<void> | void;
  busy?: boolean;
  publishedOnly?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Listing[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const { data } = await adminApi
          .GET("/locations", {
            params: { query: { page: 1, pageSize: 12, search: query.trim() || undefined, status: publishedOnly ? "published" : undefined } },
          })
          .then(unwrapPaginated<Listing>);
        if (!cancelled) setResults(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, publishedOnly]);

  const visible = results.filter((r) => !exclude.has(r.id));

  return (
    <div>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search listings by title…"
          aria-label="Search listings to add"
          className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <ul className="mt-2 max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200" aria-busy={loading}>
        {visible.length === 0 && <li className="px-3 py-4 text-center text-sm text-slate-500">{loading ? "Searching…" : "No listings to add."}</li>}
        {visible.map((r) => {
          const on = picked.includes(r.id);
          return (
            <li key={r.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => setPicked(on ? picked.filter((p) => p !== r.id) : [...picked, r.id])}
                className={cn("flex w-full items-center gap-3 px-3 py-2 text-left text-sm", on ? "bg-brand-50" : "hover:bg-slate-50")}
              >
                <span className="flex h-9 w-12 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-100">
                  {r.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.cover_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon aria-hidden className="h-3.5 w-3.5 text-slate-400" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">{r.title}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {r.city}, {r.country}
                  </span>
                </span>
                <StatusBadge status={r.status} />
                <span
                  aria-hidden
                  className={cn("flex h-5 w-5 items-center justify-center rounded border", on ? "border-brand-500 bg-brand-500 text-snow" : "border-slate-300")}
                >
                  {on && <Check className="h-3.5 w-3.5" />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex justify-end">
        <Button
          variant="primary"
          size="sm"
          disabled={picked.length === 0 || busy}
          onClick={async () => {
            await onAdd(picked);
            setPicked([]);
          }}
        >
          <Plus aria-hidden className="h-3.5 w-3.5" /> Add {picked.length || ""} listing{picked.length === 1 ? "" : "s"}
        </Button>
      </div>
    </div>
  );
}
