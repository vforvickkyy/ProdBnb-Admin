"use client";

import { useState } from "react";
import { Dialog } from "./Dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** When set, a reason textarea is required and non-empty before confirming -- matches the backend's own reason-required validation (reject/suspend). */
  requireReason?: boolean;
  /** Label on the confirm button; red styling when `danger` is true. */
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: (reason?: string) => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  requireReason,
  confirmLabel = "Confirm",
  danger,
  busy,
  onConfirm,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState("");

  const canConfirm = !requireReason || reason.trim().length > 0;

  function handleConfirm() {
    onConfirm(requireReason ? reason.trim() : undefined);
  }

  function handleOpenChange(next: boolean) {
    if (!next) setReason("");
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} title={title} description={description}>
      {requireReason && (
        <div className="mb-4">
          <label htmlFor="confirm-dialog-reason" className="mb-1 block text-sm text-slate-600">
            Reason
          </label>
          <textarea
            id="confirm-dialog-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            autoFocus
          />
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => handleOpenChange(false)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm || busy}
          className={
            danger
              ? "rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              : "rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          }
        >
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
