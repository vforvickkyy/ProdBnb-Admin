/**
 * Non-secret console configuration. Everything here is either derived from the NEXT_PUBLIC_*
 * values the app already ships, or a plain link -- never a credential.
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

/** The product's public name, as the website shows it (same variable as the website's). */
export const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME?.trim() || "ProdBnb";

export type ConsoleEnvironment = "local" | "staging" | "production" | "unknown";

/** Which backend this build talks to, inferred from its base URL (for the header badge). */
export function consoleEnvironment(url: string = API_BASE_URL): ConsoleEnvironment {
  if (!url) return "unknown";
  if (/localhost|127\.0\.0\.1/.test(url)) return "local";
  if (/staging/i.test(url)) return "staging";
  if (/api\.prodbnb\.com/i.test(url)) return "production";
  return "unknown";
}

/**
 * Where an admin edits each project's environment variables. Secrets are managed in Vercel, never
 * in this console (the Admin Console's "status only" decision), so the Integrations page links out.
 * Overridable per deployment; the defaults are the current staging projects.
 */
export const VERCEL_LINKS = {
  backendEnv:
    process.env.NEXT_PUBLIC_VERCEL_BACKEND_ENV_URL ??
    "https://vercel.com/vickys-projects-56995e9c/prodbnb-backend-staging/settings/environment-variables",
  adminEnv:
    process.env.NEXT_PUBLIC_VERCEL_ADMIN_ENV_URL ??
    "https://vercel.com/vickys-projects-56995e9c/prodbnb-admin-staging/settings/environment-variables",
  backendDeployments:
    process.env.NEXT_PUBLIC_VERCEL_BACKEND_DEPLOYMENTS_URL ??
    "https://vercel.com/vickys-projects-56995e9c/prodbnb-backend-staging/deployments",
};

/** The Admin Panel's own public configuration, reported on the Integrations page (values are public). */
export function adminPublicConfig(): { key: string; set: boolean; display: string | null }[] {
  const entries: [string, string | undefined, boolean][] = [
    ["NEXT_PUBLIC_API_BASE_URL", process.env.NEXT_PUBLIC_API_BASE_URL, true],
    ["NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL, true],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, false],
  ];
  return entries.map(([key, value, showValue]) => ({
    key,
    set: Boolean(value),
    display: !value ? null : showValue ? value : `••••${value.slice(-4)}`,
  }));
}
