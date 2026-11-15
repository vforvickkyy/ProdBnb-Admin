"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { adminApi, unwrap } from "@/lib/api";
import { personName } from "@/lib/format";
import type { components } from "@/types/admin-api";

export type Person = components["schemas"]["HostCandidate"];

/** Pick specific people by name or email (for direct notifications). */
export function PeoplePicker({ value, onChange }: { value: Person[]; onChange: (people: Person[]) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[]>([]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const rows = await adminApi.GET("/hosts/search", { params: { query: { search: term, limit: 10 } } }).then(unwrap<Person[]>);
        if (!cancelled) setResults(rows.filter((r) => r.status === "active"));
      } catch {
        if (!cancelled) setResults([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const chosen = new Set(value.map((p) => p.id));
  return (
    <div>
      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Recipients">
          {value.map((p) => (
            <li key={p.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-2.5 pr-1 text-sm text-slate-800">
              {personName(p)}
              <button
                type="button"
                aria-label={`Remove ${personName(p)}`}
                onClick={() => onChange(value.filter((x) => x.id !== p.id))}
                className="rounded-full p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
              >
                <X aria-hidden className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add people by name or email…"
          aria-label="Search people to add"
          className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      {results.length > 0 && (
        <ul className="mt-1 max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                disabled={chosen.has(r.id)}
                onClick={() => {
                  onChange([...value, r]);
                  setQuery("");
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-40"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-900">{personName(r)}</span>
                  <span className="block truncate text-xs text-slate-500">{r.email}</span>
                </span>
                <span className="text-xs text-slate-500">{chosen.has(r.id) ? "Added" : r.is_host ? "Host" : "User"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
