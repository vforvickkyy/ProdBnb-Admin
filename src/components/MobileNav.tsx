"use client";

import { useState } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
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
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500 md:hidden"
        >
          Menu
        </button>
      </RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-slate-900/40" />
        <RadixDialog.Content className="fixed inset-y-0 left-0 z-50 w-60 max-w-[80vw] overflow-y-auto bg-slate-950 shadow-lg focus:outline-none focus:ring-2 focus:ring-inset focus:ring-slate-500">
          <RadixDialog.Title className="sr-only">Navigation</RadixDialog.Title>
          <Sidebar navLabel="Admin sections (mobile menu)" permissions={permissions} />
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
