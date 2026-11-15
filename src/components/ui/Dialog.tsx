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
        <RadixDialog.Overlay className="fixed inset-0 z-40 animate-fade-in bg-black/60 backdrop-blur-[2px]" />
        <RadixDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 animate-scale-in rounded-2xl border border-slate-200 bg-white p-6 shadow-pop focus:outline-none">
          <RadixDialog.Title className="text-base font-semibold tracking-tight text-slate-900">{title}</RadixDialog.Title>
          {description && <RadixDialog.Description className="mt-1 text-sm text-slate-500">{description}</RadixDialog.Description>}
          <div className="mt-4">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
