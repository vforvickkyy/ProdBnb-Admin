"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import useSWR from "swr";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { SelectField, TextField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table, type Column } from "@/components/ui/Table";
import { adminApi, unwrap } from "@/lib/api";
import { formatDate, personName } from "@/lib/format";
import { TEAM_ROLE_DESCRIPTIONS, TEAM_ROLE_LABELS, type TeamRole, useAdminMe } from "@/lib/useAdminMe";
import type { components } from "@/types/admin-api";
import { BRAND_NAME } from "@/lib/config";

type TeamMember = components["schemas"]["TeamMember"];
const ROLES = Object.keys(TEAM_ROLE_LABELS) as TeamRole[];

export default function TeamPage() {
  const { me, can } = useAdminMe();
  const manage = can("team.manage");
  const { data: team, error, isLoading, mutate } = useSWR("/v1/admin/team", () => adminApi.GET("/team").then(unwrap<TeamMember[]>));

  const [addOpen, setAddOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<TeamRole>("support");
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const [busy, setBusy] = useState(false);

  async function addMember() {
    setBusy(true);
    try {
      await adminApi.POST("/team", { body: { email: email.trim(), team_role: newRole } }).then(unwrap);
      toast.success(`${email.trim()} added as ${TEAM_ROLE_LABELS[newRole]}.`);
      setAddOpen(false);
      setEmail("");
      await mutate();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Failed to add team member."));
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(member: TeamMember, team_role: TeamRole) {
    try {
      await adminApi.PUT("/team/{userId}", { params: { path: { userId: member.user_id } }, body: { team_role } }).then(unwrap);
      toast.success(`${personName(member)} is now ${TEAM_ROLE_LABELS[team_role]}.`);
      await mutate();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Failed to change role."));
      await mutate();
    }
  }

  async function removeMember() {
    if (!removing) return;
    setBusy(true);
    try {
      await adminApi.DELETE("/team/{userId}", { params: { path: { userId: removing.user_id } } }).then(unwrap);
      toast.success(`${personName(removing)} removed from the admin team.`);
      setRemoving(null);
      await mutate();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Failed to remove team member."));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<TeamMember>[] = [
    {
      key: "name",
      header: "Admin",
      render: (m) => (
        <Link href={`/users/${m.user_id}`} className="text-slate-800 hover:underline">
          {personName(m)}
          {m.user_id === me?.user_id && <span className="ml-1 text-xs text-slate-400">(you)</span>}
          <span className="block text-xs text-slate-500">{m.email ?? "—"}</span>
        </Link>
      ),
    },
    {
      key: "role",
      header: "Team role",
      render: (m) =>
        manage && m.user_id !== me?.user_id ? (
          <select
            aria-label={`Team role for ${personName(m)}`}
            value={m.team_role}
            onChange={(e) => changeRole(m, e.target.value as TeamRole)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {TEAM_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-slate-700">{TEAM_ROLE_LABELS[m.team_role]}</span>
        ),
    },
    { key: "status", header: "Account", render: (m) => <StatusBadge status={m.status} /> },
    { key: "since", header: "Admin since", render: (m) => formatDate(m.created_at) },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (m) =>
        manage && m.user_id !== me?.user_id ? (
          <Button size="sm" variant="danger" onClick={() => setRemoving(m)}>
            Remove
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Admin team"
        description={`Who can operate ${BRAND_NAME}, and what each person is allowed to do.`}
        actions={
          manage && (
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              Add admin
            </Button>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : error || !team ? (
            <ErrorState message={extractErrorMessage(error, "Failed to load the team.")} onRetry={() => mutate()} />
          ) : (
            <Table caption="Admin team" columns={columns} rows={team} rowKey={(m) => m.user_id} />
          )}
          {!manage && <p className="mt-3 text-sm text-slate-500">Only a super admin can add, re-role or remove admins.</p>}
        </div>

        <Card title="Roles">
          <ul className="space-y-3 text-sm">
            {ROLES.map((r) => (
              <li key={r}>
                <div className="font-medium text-slate-800">{TEAM_ROLE_LABELS[r]}</div>
                <div className="text-slate-500">{TEAM_ROLE_DESCRIPTIONS[r]}</div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            Everyone on the team can see the dashboard, users, listings, bookings, settings and the audit log. The platform always
            keeps at least one super admin.
          </p>
        </Card>
      </div>

      <Dialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add an admin"
        description={`The person must already have a ${BRAND_NAME} account (they can sign up on the website or in the app first).`}
      >
        <div className="space-y-4">
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          <SelectField label="Team role" value={newRole} onChange={(e) => setNewRole(e.target.value as TeamRole)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {TEAM_ROLE_LABELS[r]}
              </option>
            ))}
          </SelectField>
          <p className="text-xs text-slate-500">{TEAM_ROLE_DESCRIPTIONS[newRole]}</p>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={addMember} disabled={busy || !/^\S+@\S+\.\S+$/.test(email.trim())}>
              {busy ? "Adding…" : "Add admin"}
            </Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removing ? personName(removing) : ""} from the team?`}
        description="They lose all admin access immediately on their next request. Their booker/host account is not affected."
        confirmLabel="Remove admin"
        danger
        busy={busy}
        onConfirm={removeMember}
      />
    </>
  );
}
