"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

/** A right-hand side panel for working on one item without leaving the page. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  width = "max-w-xl",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  width?: string;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 animate-fade-in bg-black/50 backdrop-blur-[1px]" />
        <RadixDialog.Content
          aria-describedby={description ? undefined : undefined}
          className={`fixed inset-y-0 right-0 z-50 flex w-full ${width} animate-fade-in flex-col border-l border-slate-200 bg-white shadow-2xl focus:outline-none`}
        >
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div className="min-w-0">
              <RadixDialog.Title className="truncate text-base font-semibold text-slate-900">{title}</RadixDialog.Title>
              {description && <RadixDialog.Description className="mt-0.5 text-sm text-slate-500">{description}</RadixDialog.Description>}
            </div>
            <RadixDialog.Close aria-label="Close" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
              <X aria-hidden className="h-4 w-4" />
            </RadixDialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
