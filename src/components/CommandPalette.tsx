"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@/lib/navigation";
import * as RadixDialog from "@radix-ui/react-dialog";
import { ArrowRight, CornerDownLeft, Hash, Moon, Plus, Search, Sun, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { AdminPermission } from "@/lib/useAdminMe";
import { sectionItems, visibleSections } from "@/lib/nav";
import { useTheme } from "./ThemeProvider";

interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  group: string;
  run: () => void;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function matches(haystack: string, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const text = haystack.toLowerCase();
  return words.every((w) => text.includes(w));
}

/**
 * ⌘K / Ctrl+K anywhere (or "/" when not typing): jump to any section, start common tasks, search
 * listings/users by text, or open a record by pasting its id. Keyboard-first: ↑ ↓ to move, Enter to
 * run, Esc to close.
 */
export function CommandPalette({ permissions, can }: { permissions?: readonly AdminPermission[]; can: (p: AdminPermission) => boolean }) {
  const router = useRouter();
  const { resolved, setChoice } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((o) => !o);
      } else if (event.key === "/" && !typing && !open) {
        event.preventDefault();
        setOpen(true);
      }
    }
    function onOpenRequest() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("prodbnb:open-palette", onOpenRequest);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("prodbnb:open-palette", onOpenRequest);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim();
    const out: PaletteItem[] = [];

    if (UUID.test(q)) {
      const targets: [string, string, AdminPermission][] = [
        ["Booking", "/bookings", "bookings.view"],
        ["Listing", "/locations", "locations.view"],
        ["User", "/users", "users.view"],
        ["Payment", "/payments", "payments.view"],
      ];
      for (const [label, base, permission] of targets) {
        if (can(permission)) {
          out.push({
            id: `open-${label}`,
            label: `Open ${label.toLowerCase()} ${q.slice(0, 8)}…`,
            icon: Hash,
            group: "Open by id",
            run: () => go(`${base}/${q}`),
          });
        }
      }
      return out;
    }

    const actions: (PaletteItem & { permission?: AdminPermission; keywords: string })[] = [
      {
        id: "new-collection",
        label: "New collection",
        icon: Plus,
        group: "Actions",
        keywords: "curated create",
        permission: "catalog.manage",
        run: () => go("/collections?new=1"),
      },
      {
        id: "theme",
        label: resolved === "dark" ? "Switch to light theme" : "Switch to dark theme",
        icon: resolved === "dark" ? Sun : Moon,
        group: "Actions",
        keywords: "theme dark light mode appearance",
        run: () => {
          setChoice(resolved === "dark" ? "light" : "dark");
          setOpen(false);
        },
      },
    ];
    for (const action of actions) {
      if ((!action.permission || can(action.permission)) && (!q || matches(`${action.label} ${action.keywords}`, q))) {
        out.push(action);
      }
    }

    for (const section of visibleSections(permissions)) {
      for (const item of sectionItems(section)) {
        if (item.permission && !can(item.permission)) continue;
        if (!q || matches(`${item.label} ${section.label} ${item.keywords ?? ""}`, q)) {
          out.push({ id: item.href, label: item.label, hint: section.label, icon: section.icon, group: "Go to", run: () => go(item.href) });
        }
      }
    }

    if (q) {
      if (can("locations.view")) {
        out.push({
          id: "search-listings",
          label: `Search listings for “${q}”`,
          icon: Search,
          group: "Search",
          run: () => go(`/locations?search=${encodeURIComponent(q)}`),
        });
      }
      if (can("users.view")) {
        out.push({
          id: "search-users",
          label: `Search users for “${q}”`,
          icon: Search,
          group: "Search",
          run: () => go(`/users?search=${encodeURIComponent(q)}`),
        });
      }
    }
    return out;
  }, [query, permissions, can, go, resolved, setChoice]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function onInputKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      items[active]?.run();
    }
  }

  let lastGroup = "";

  return (
    <RadixDialog.Root open={open} onOpenChange={setOpen}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-black/50 backdrop-blur-[1px]" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[12vh] z-50 w-[min(640px,calc(100vw-32px))] -translate-x-1/2 animate-scale-in overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl focus:outline-none"
        >
          <RadixDialog.Title className="sr-only">Command palette</RadixDialog.Title>
          <div className="flex items-center gap-2 border-b border-slate-200 px-4">
            <Search aria-hidden className="h-4 w-4 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKey}
              placeholder="Jump to a page, run an action, or paste an id…"
              aria-label="Search commands"
              role="combobox"
              aria-expanded
              aria-controls="command-palette-list"
              aria-activedescendant={items[active] ? `cmd-${items[active]!.id}` : undefined}
              className="h-12 w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
            <kbd className="hidden rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500 sm:block">Esc</kbd>
          </div>
          <ul id="command-palette-list" role="listbox" ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
            {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">No matches.</li>}
            {items.map((item, index) => {
              const header = item.group !== lastGroup ? item.group : null;
              lastGroup = item.group;
              const Icon = item.icon;
              return (
                <li key={item.id} role="presentation">
                  {header && <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{header}</div>}
                  <div
                    id={`cmd-${item.id}`}
                    role="option"
                    aria-selected={index === active}
                    data-index={index}
                    onMouseMove={() => setActive(index)}
                    onClick={item.run}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm",
                      index === active ? "bg-slate-100 text-slate-900" : "text-slate-700",
                    )}
                  >
                    <Icon aria-hidden className="h-4 w-4 shrink-0 text-slate-500" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.hint && <span className="text-xs text-slate-400">{item.hint}</span>}
                    {index === active ? (
                      <CornerDownLeft aria-hidden className="h-3.5 w-3.5 text-slate-400" />
                    ) : (
                      <ArrowRight aria-hidden className="h-3.5 w-3.5 text-transparent" />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
