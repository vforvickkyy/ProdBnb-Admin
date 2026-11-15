"use client";

import { useState } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { LogOut, Menu as MenuIcon, X } from "lucide-react";
import { Logo, NavTree, displayName } from "@/components/Sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TEAM_ROLE_LABELS, type AdminMe, type AdminPermission } from "@/lib/useAdminMe";

/**
 * Below md the rail and section menu are hidden -- this drawer is the way to every page (Phase
 * 14-B4), showing the whole tree at once from the same navigation model as the desktop sidebar.
 * Its landmark has its own name so it never duplicates the desktop one.
 */
export function MobileNav({
  permissions,
  me,
  onSignOut,
}: {
  permissions?: readonly AdminPermission[];
  me?: AdminMe;
  onSignOut?: () => void;
} = {}) {
  const [open, setOpen] = useState(false);

  return (
    <RadixDialog.Root open={open} onOpenChange={setOpen}>
      <RadixDialog.Trigger asChild>
        <button
          type="button"
          aria-label="Menu"
          className="-ml-1 rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 md:hidden"
        >
          <MenuIcon aria-hidden className="h-[18px] w-[18px]" />
        </button>
      </RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 animate-fade-in bg-black/60 backdrop-blur-[2px]" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] animate-slide-in-left flex-col border-r border-slate-200 bg-canvas shadow-pop focus:outline-none"
        >
          <RadixDialog.Title className="sr-only">Navigation</RadixDialog.Title>
          <div className="flex h-14 shrink-0 items-center justify-between px-4">
            <Logo />
            <RadixDialog.Close aria-label="Close menu" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
              <X aria-hidden className="h-4 w-4" />
            </RadixDialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-6 pt-2">
            <NavTree permissions={permissions} onNavigate={() => setOpen(false)} />
          </div>
          <div className="flex items-center gap-3 border-t border-slate-200 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-slate-900">{displayName(me)}</div>
              {me && <div className="truncate text-xs text-slate-500">{TEAM_ROLE_LABELS[me.team_role]}</div>}
            </div>
            <ThemeToggle />
            {onSignOut && (
              <button
                type="button"
                aria-label="Sign out"
                onClick={onSignOut}
                className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
              >
                <LogOut aria-hidden className="h-4 w-4" />
              </button>
            )}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
