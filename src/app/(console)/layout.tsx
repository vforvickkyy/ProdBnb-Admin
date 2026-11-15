import { AdminShell } from "@/components/AdminShell";

/**
 * Every signed-in page shares this one shell (sidebar, header, session check). Because it is a
 * layout, it stays mounted across navigations: clicking a link swaps only the content area, and the
 * admin check runs once per visit instead of on every page.
 */
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
