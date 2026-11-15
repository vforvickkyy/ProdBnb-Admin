/**
 * Light / dark / system theme (Admin Console 2). Console 3 opens in dark (the Framer-style reference
 * design) until the admin picks something else; the choice is remembered per browser.
 *
 * The choice lives in localStorage (a per-browser convenience -- nothing server-side needs it).
 * `THEME_INIT_SCRIPT` runs in <head> before first paint, carrying the request's CSP nonce, so a dark
 * theme never flashes light on load.
 */
export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "prodbnb-admin-theme";
export const DEFAULT_THEME: ThemeChoice = "dark";

export function readStoredTheme(): ThemeChoice {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" || value === "system" ? value : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function storeTheme(choice: ThemeChoice): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Private mode / blocked storage: the choice simply lasts for this page view.
  }
}

export function systemTheme(): ResolvedTheme {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  return choice === "system" ? systemTheme() : choice;
}

/** Apply without animating every colour transition on the page. */
export function applyTheme(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.add("theme-switching");
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  window.setTimeout(() => root.classList.remove("theme-switching"), 0);
}

export const THEME_INIT_SCRIPT = `(function(){try{var c=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=c==="dark"||(c!=="light"&&c!=="system")||(c==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;if(d){r.classList.add("dark")}r.style.colorScheme=d?"dark":"light"}catch(e){}})();`;
