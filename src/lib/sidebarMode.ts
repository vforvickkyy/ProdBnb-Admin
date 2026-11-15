"use client";

import { useSyncExternalStore } from "react";

/**
 * How the section rail behaves (Console 3, as in Supabase's "Sidebar control"): always showing its
 * labels, icons only, or icons that expand over the page while hovered. A per-browser preference in
 * localStorage; every control that changes it (rail menu, Settings → General) stays in step.
 */
export type SidebarMode = "expanded" | "collapsed" | "hover";

export const SIDEBAR_MODE_KEY = "prodbnb-admin-sidebar";
export const DEFAULT_SIDEBAR_MODE: SidebarMode = "hover";

export const SIDEBAR_MODE_OPTIONS: { value: SidebarMode; label: string }[] = [
  { value: "expanded", label: "Expanded" },
  { value: "collapsed", label: "Collapsed" },
  { value: "hover", label: "Expand on hover" },
];

let current: SidebarMode | null = null;
const listeners = new Set<() => void>();

function read(): SidebarMode {
  try {
    const value = window.localStorage.getItem(SIDEBAR_MODE_KEY);
    return value === "expanded" || value === "collapsed" || value === "hover" ? value : DEFAULT_SIDEBAR_MODE;
  } catch {
    return DEFAULT_SIDEBAR_MODE;
  }
}

function snapshot(): SidebarMode {
  if (current === null) current = read();
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setSidebarMode(mode: SidebarMode): void {
  current = mode;
  try {
    window.localStorage.setItem(SIDEBAR_MODE_KEY, mode);
  } catch {
    // Storage blocked: the choice lasts for this page view.
  }
  listeners.forEach((listener) => listener());
}

export function useSidebarMode(): [SidebarMode, (mode: SidebarMode) => void] {
  const mode = useSyncExternalStore(subscribe, snapshot, () => DEFAULT_SIDEBAR_MODE);
  return [mode, setSidebarMode];
}
