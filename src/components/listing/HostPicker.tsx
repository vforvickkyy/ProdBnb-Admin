"use client";

import { useEffect, useState } from "react";
import { Check, Search, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { adminApi, unwrap } from "@/lib/api";
import { cn } from "@/lib/cn";
import { personName } from "@/lib/format";
import type { components } from "@/types/admin-api";

export type HostCandidate = components["schemas"]["HostCandidate"];

/** Search people by name or email; hosts first. Non-hosts can be picked and granted the role on create. */
export function HostPicker({ value, onChange }: { value: HostCandidate | null; onChange: (host: HostCandidate | null) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HostCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const rows = await adminApi.GET("/hosts/search", { params: { query: { search: term, limit: 12 } } }).then(unwrap<HostCandidate[]>);
        if (!cancelled) {
          setResults(rows);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Search failed.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <div>
      <label htmlFor="host-search" className="mb-1 block text-sm font-medium text-slate-700">
        Host account
      </label>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          id="host-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          autoComplete="off"
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/25"
        />
      </div>
      <p className="mt-1 text-xs text-slate-500">The host owns the listing and manages it from their app. You can change everything later.</p>

      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      {loading && <p className="mt-2 text-sm text-slate-500">Searching…</p>}
      {!loading && query.trim().length >= 2 && results.length === 0 && !error && (
        <p className="mt-2 text-sm text-slate-500">Nobody matches. The host needs a ProdBnb account first — ask them to sign up in the app.</p>
      )}
      {results.length > 0 && (
        <ul
          role="listbox"
          aria-label="Matching accounts"
          className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200"
        >
          {results.map((r) => {
            const selected = value?.id === r.id;
            return (
              <li key={r.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => onChange(selected ? null : r)}
                  disabled={r.status !== "active"}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    selected ? "bg-accent-50" : "hover:bg-slate-50",
                  )}
                >
                  <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    {selected ? <Check className="h-4 w-4 text-accent-700" /> : <UserRound className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-900">{personName(r)}</span>
                    <span className="block truncate text-xs text-slate-500">{r.email}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {r.status !== "active" && <Badge tone="danger">{r.status}</Badge>}
                    {r.is_host ? <Badge tone="success">Host · {r.location_count}</Badge> : <Badge tone="neutral">Not a host yet</Badge>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
