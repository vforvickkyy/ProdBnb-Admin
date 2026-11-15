"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, CircleSlash, PauseCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { adminApi, unwrap } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { CHANNEL_LABEL, type ChannelStatus } from "./useMessaging";

/**
 * Status of one sending channel + its test / pause / disconnect actions. Secrets are never shown:
 * the API only ever reports whether one is stored.
 */
export function ChannelStatusCard({
  status,
  canManage,
  onChanged,
  testLabel,
  testTo,
  children,
}: {
  status: ChannelStatus;
  canManage: boolean;
  onChanged: () => void;
  testLabel: string;
  testTo?: string;
  children?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const channel = status.channel;

  async function test() {
    setBusy(true);
    try {
      const result = await adminApi
        .POST("/messaging/channels/{channel}/test", { params: { path: { channel } }, body: testTo ? { to: testTo } : {} })
        .then(unwrap<{ ok: boolean; detail: string }>);
      (result.ok ? toast.success : toast.error)(result.detail);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed.");
    } finally {
      setBusy(false);
    }
  }

  async function setEnabled(enabled: boolean) {
    setBusy(true);
    try {
      await adminApi.PATCH("/messaging/channels/{channel}", { params: { path: { channel } }, body: { enabled } }).then(unwrap);
      toast.success(enabled ? "Resumed." : "Paused — nothing is sent through this channel until you resume it.");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await adminApi.DELETE("/messaging/channels/{channel}", { params: { path: { channel } } }).then(unwrap);
      toast.success("Disconnected. The stored credential was deleted.");
      setConfirmRemove(false);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not disconnect.");
    } finally {
      setBusy(false);
    }
  }

  const icon = !status.connected ? (
    <CircleSlash aria-hidden className="h-5 w-5 text-slate-400" />
  ) : !status.enabled ? (
    <PauseCircle aria-hidden className="h-5 w-5 text-amber-600" />
  ) : (
    <CheckCircle2 aria-hidden className="h-5 w-5 text-green-600" />
  );

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          {icon} {CHANNEL_LABEL[channel] ?? channel}
        </span>
      }
      actions={
        status.connected ? (
          <Badge tone={status.enabled ? "success" : "warning"}>
            {status.enabled ? "Connected" : "Paused"}
            {status.source === "environment" ? " · env vars" : ""}
          </Badge>
        ) : (
          <Badge tone="neutral">Not connected</Badge>
        )
      }
    >
      {children}
      {status.connected && (
        <div className="mt-3 space-y-3">
          {status.last_tested_at && (
            <p className="text-xs text-slate-500">
              Last tested {relativeTime(status.last_tested_at)} —{" "}
              {status.last_test_ok ? <span className="text-green-700">passed</span> : <span className="text-red-700">failed: {status.last_test_error}</span>}
            </p>
          )}
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="primary" disabled={busy} onClick={test}>
                {busy ? "Testing…" : testLabel}
              </Button>
              {status.source === "dashboard" && (
                <>
                  <Button size="sm" disabled={busy} onClick={() => setEnabled(!status.enabled)}>
                    {status.enabled ? "Pause" : "Resume"}
                  </Button>
                  <Button size="sm" variant="danger" disabled={busy} onClick={() => setConfirmRemove(true)}>
                    Disconnect
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Disconnect ${CHANNEL_LABEL[channel] ?? channel}?`}
        description="The stored credential is deleted from Vault. Messages using this channel stop until you connect it again."
        danger
        busy={busy}
        confirmLabel="Disconnect"
        onConfirm={remove}
      />
    </Card>
  );
}

/** Numbered how-to steps. */
export function Guide({ title, steps, children }: { title: string; steps: React.ReactNode[]; children?: React.ReactNode }) {
  return (
    <Card title={title}>
      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3 text-sm text-slate-700">
            <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      {children}
    </Card>
  );
}
