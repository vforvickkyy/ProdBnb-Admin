"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { adminApi } from "@/lib/api";

interface AdminLocationRow {
  id: string;
  title: string;
  city: string;
  country: string;
  status: string;
  moderation_reason: string | null;
}

const MODERATABLE = new Set(["submitted", "under_review", "published", "suspended"]);

export default function LocationsPage() {
  const [locations, setLocations] = useState<AdminLocationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    // GET /v1/admin/locations pre-existed Phase 11 too (extended with
    // host_id/search) -- same reasoning as the users page.
    const { supabase } = await import("@/lib/supabase");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/v1/admin/locations?pageSize=20`, {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (!res.ok) {
      setError("Failed to load locations.");
      return;
    }
    const body = await res.json();
    setLocations(body.data);
  }

  useEffect(() => {
    load();
  }, []);

  // Four explicit calls rather than one generic dispatcher: each admin
  // action has its own literal path and body shape in the generated
  // OpenAPI types (approve/restore take no body, reject/suspend require a
  // reason) -- a single runtime-computed path would need an unsafe cast to
  // satisfy openapi-fetch's per-path type inference, defeating the point of
  // using a typed client at all.
  async function runAction(id: string, promise: Promise<{ error?: unknown }>) {
    setBusyId(id);
    const { error: apiError } = await promise;
    setBusyId(null);
    if (apiError) {
      window.alert("Action failed.");
      return;
    }
    await load();
  }

  // The backend's noBodySchema (zod .default({})) accepts an omitted body
  // at the HTTP layer, but the generated OpenAPI type still declares an
  // empty-object body as required -- passed explicitly here rather than
  // loosening the generated types.
  const approveLocation = (id: string) =>
    runAction(id, adminApi.POST("/locations/{id}/approve", { params: { path: { id } }, body: {} }));
  const restoreLocation = (id: string) =>
    runAction(id, adminApi.POST("/locations/{id}/restore", { params: { path: { id } }, body: {} }));

  function rejectLocation(id: string) {
    const reason = window.prompt("Reason to reject this location:");
    if (!reason) return;
    runAction(id, adminApi.POST("/locations/{id}/reject", { params: { path: { id } }, body: { reason } }));
  }

  function suspendLocation(id: string) {
    const reason = window.prompt("Reason to suspend this location:");
    if (!reason) return;
    runAction(id, adminApi.POST("/locations/{id}/suspend", { params: { path: { id } }, body: { reason } }));
  }

  return (
    <AdminShell>
      <h1 className="mb-6 text-xl font-semibold">Locations</h1>
      {error && <p className="text-red-700">{error}</p>}
      {!locations && !error && <p className="text-slate-500">Loading…</p>}
      {locations && (
        <table className="w-full border-collapse overflow-hidden rounded border border-slate-200 bg-white text-sm">
          <thead className="bg-slate-100 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">City</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Reason</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {locations.map((loc) => (
              <tr key={loc.id}>
                <td className="px-4 py-2">{loc.title}</td>
                <td className="px-4 py-2">
                  {loc.city}, {loc.country}
                </td>
                <td className="px-4 py-2">{loc.status}</td>
                <td className="px-4 py-2 text-slate-500">{loc.moderation_reason ?? "—"}</td>
                <td className="px-4 py-2">
                  {!MODERATABLE.has(loc.status) ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <div className="flex gap-2">
                      {(loc.status === "submitted" || loc.status === "under_review") && (
                        <>
                          <ActionButton disabled={busyId === loc.id} onClick={() => approveLocation(loc.id)} label="Approve" />
                          <ActionButton disabled={busyId === loc.id} onClick={() => rejectLocation(loc.id)} label="Reject" />
                        </>
                      )}
                      {loc.status === "published" && (
                        <ActionButton disabled={busyId === loc.id} onClick={() => suspendLocation(loc.id)} label="Suspend" />
                      )}
                      {loc.status === "suspended" && (
                        <ActionButton disabled={busyId === loc.id} onClick={() => restoreLocation(loc.id)} label="Restore" />
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminShell>
  );
}

function ActionButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50"
    >
      {label}
    </button>
  );
}
