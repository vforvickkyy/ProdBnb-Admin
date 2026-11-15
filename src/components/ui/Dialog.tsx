"use client";

import * as RadixDialog from "@radix-ui/react-dialog";

// Thin wrapper over Radix's Dialog primitive -- gets focus trapping, Escape
// to dismiss, and correct aria wiring for free instead of hand-building
// them, replacing the window.prompt()/window.alert() pattern used
// throughout the pre-Phase-14 Admin Panel.
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] animate-fade-in" />
        <RadixDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg focus:outline-none focus:ring-2 focus:ring-slate-500">
          <RadixDialog.Title className="text-lg font-semibold text-slate-900">{title}</RadixDialog.Title>
          {description && <RadixDialog.Description className="mt-1 text-sm text-slate-500">{description}</RadixDialog.Description>}
          <div className="mt-4">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
