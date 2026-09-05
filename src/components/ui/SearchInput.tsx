"use client";

import { useEffect, useState } from "react";

// Debounces locally, then reports the settled value up -- callers never see
// a fetch fire on every keystroke. 350ms matches typical typing-pause
// heuristics without feeling laggy.
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label: string;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (draft !== value) onChange(draft);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="w-full min-w-[200px] rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
      />
    </label>
  );
}
