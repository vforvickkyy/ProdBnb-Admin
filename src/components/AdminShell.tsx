"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAdminGate } from "@/lib/useAdminGate";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/users", label: "Users" },
  { href: "/locations", label: "Locations" },
];

/**
 * Shared page shell: redirects a signed-out caller to /login, shows a clear
 * "not an admin" state for an authenticated non-admin (this is UX only --
 * they never had a way to fetch real admin data in the first place, since
 * the backend itself would already have rejected any /v1/admin/* call with
 * a 403), and renders the nav + page content once confirmed admin.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const status = useAdminGate();
  const router = useRouter();

  if (status === "checking") {
    return <div className="p-8 text-slate-500">Checking session…</div>;
  }
  if (status === "signed-out") {
    router.replace("/login");
    return null;
  }
  if (status === "not-admin") {
    return (
      <div className="p-8">
        <p className="text-red-700">This account does not have admin access.</p>
        <button
          className="mt-4 text-sm text-slate-600 underline"
          onClick={async () => {
            await supabase.auth.signOut();
            router.replace("/login");
          }}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="font-semibold">ProdBnb Admin</span>
          <nav className="flex gap-6 text-sm">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-slate-600 hover:text-slate-900">
                {item.label}
              </Link>
            ))}
          </nav>
          <button
            className="text-sm text-slate-500 hover:text-slate-800"
            onClick={async () => {
              await supabase.auth.signOut();
              router.replace("/login");
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
