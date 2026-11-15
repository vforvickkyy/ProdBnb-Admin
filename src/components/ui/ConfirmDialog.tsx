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
  /** Shows the reason textarea without requiring it (e.g. cancel/reject, where a reason helps but is optional). */
  optionalReason?: boolean;
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
  optionalReason,
  confirmLabel = "Confirm",
  danger,
  busy,
  onConfirm,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState("");

  const canConfirm = !requireReason || reason.trim().length > 0;

  const showReason = requireReason || optionalReason;

  function handleConfirm() {
    onConfirm(showReason ? reason.trim() || undefined : undefined);
  }

  function handleOpenChange(next: boolean) {
    if (!next) setReason("");
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} title={title} description={description}>
      {showReason && (
        <div className="mb-4">
          <label htmlFor="confirm-dialog-reason" className="mb-1 block text-sm text-slate-600">
            Reason{optionalReason && !requireReason ? " (optional)" : ""}
          </label>
          <textarea
            id="confirm-dialog-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-card focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/25"
            autoFocus
          />
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => handleOpenChange(false)}
          className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-800 shadow-card transition-colors hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm || busy}
          className={
            danger
              ? "h-8 rounded-lg bg-[#dc2626] px-3 text-[13px] font-medium text-snow shadow-sm transition-colors hover:bg-[#b91c1c] disabled:cursor-not-allowed disabled:opacity-50"
              : "h-8 rounded-lg bg-accent-500 px-3 text-[13px] font-medium text-snow shadow-sm transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
          }
        >
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
