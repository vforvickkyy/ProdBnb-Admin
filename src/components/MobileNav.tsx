"use client";

import { useState } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { Menu as MenuIcon } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import type { AdminPermission } from "@/lib/useAdminMe";

/**
 * Below md, AdminShell's desktop Sidebar is display:none -- this drawer is
 * the only way to reach any section other than the current page (Phase
 * 14-B4). Reuses the exact same Sidebar component/link list rather than a
 * second, driftable nav array; only the accessible label differs, since a
 * drawer copy and the desktop copy landmark shouldn't share one identical
 * name when both are present in the DOM.
 */
export function MobileNav({ permissions }: { permissions?: readonly AdminPermission[] } = {}) {
  const [open, setOpen] = useState(false);

  return (
    <RadixDialog.Root open={open} onOpenChange={setOpen}>
      <RadixDialog.Trigger asChild>
        <button
          type="button"
          aria-label="Menu"
          className="rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 md:hidden"
        >
          <MenuIcon aria-hidden className="h-4 w-4" />
        </button>
      </RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] animate-fade-in" />
        <RadixDialog.Content className="fixed inset-y-0 left-0 z-50 w-60 max-w-[80vw] overflow-y-auto bg-ink-950 shadow-lg focus:outline-none">
          <RadixDialog.Title className="sr-only">Navigation</RadixDialog.Title>
          <Sidebar navLabel="Admin sections (mobile menu)" permissions={permissions} onNavigate={() => setOpen(false)} />
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
