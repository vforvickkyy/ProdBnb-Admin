"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { extractErrorMessage } from "@/components/ui/ErrorState";
import { TextField } from "@/components/ui/Field";

/** Email an invoice or receipt: to the booker's address, or another one (e.g. their accounts team). */
export function SendDialog({
  open,
  onOpenChange,
  title,
  description,
  defaultTo,
  blankMeansBooker = false,
  onSend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  defaultTo: string | null;
  /** Leave the address blank to send to the booker's email on file. */
  blankMeansBooker?: boolean;
  onSend: (to: string | undefined) => Promise<string>;
}) {
  const [to, setTo] = useState(defaultTo ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setTo(defaultTo ?? "");
  }, [open, defaultTo]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const sentTo = await onSend(to.trim() && to.trim() !== defaultTo ? to.trim() : undefined);
      toast.success(`Sent to ${sentTo}.`);
      onOpenChange(false);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Couldn't send it."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <form onSubmit={submit} className="space-y-4">
        <TextField
          label="Send to"
          type="email"
          required={!defaultTo && !blankMeansBooker}
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder={defaultTo ?? (blankMeansBooker ? "The booker's email" : "name@company.com")}
          hint={
            defaultTo
              ? "The booker's email. Change it to send a copy somewhere else, like their accounts team."
              : blankMeansBooker
                ? "Leave blank to send it to the booker's email, or enter another address."
                : "This booker has no email on file."
          }
        />
        <div className="flex justify-end gap-2">
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Sending…" : "Send email"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
