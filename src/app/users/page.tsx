"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { supabase } from "@/lib/supabase";

interface AdminUserRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  status: string;
  roles: string[];
  created_at: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      // GET /v1/admin/users already existed pre-Phase-11 (extended in
      // place with search/role/status filters) and isn't part of the
      // generated Phase-11-only OpenAPI contract -- called directly here,
      // same auth model, just not the typed client.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/v1/admin/users?pageSize=20`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) {
        setError("Failed to load users.");
        return;
      }
      const body = await res.json();
      setUsers(body.data);
    }
    load();
  }, []);

  return (
    <AdminShell>
      <h1 className="mb-6 text-xl font-semibold">Users</h1>
      {error && <p className="text-red-700">{error}</p>}
      {!users && !error && <p className="text-slate-500">Loading…</p>}
      {users && (
        <table className="w-full border-collapse overflow-hidden rounded border border-slate-200 bg-white text-sm">
          <thead className="bg-slate-100 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Roles</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2">{[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}</td>
                <td className="px-4 py-2">{u.roles.join(", ") || "—"}</td>
                <td className="px-4 py-2">
                  <span
                    className={u.status === "active" ? "text-green-700" : "text-red-700"}
                  >
                    {u.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-500">{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminShell>
  );
}
