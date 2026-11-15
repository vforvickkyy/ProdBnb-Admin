"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Segmented } from "@/components/ui/Segmented";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { Table, type Column } from "@/components/ui/Table";
import { adminApi, unwrap, unwrapPaginated } from "@/lib/api";
import { formatDateTime, personName } from "@/lib/format";
import { useAdminList } from "@/lib/useAdminList";
import type { components } from "@/types/admin-api";

type Summary = components["schemas"]["AdminConversationSummary"];
type Transcript = components["schemas"]["AdminConversationTranscript"];
type AccessEntry = components["schemas"]["MessageAccessLogEntry"];

const PAGE_SIZE = 20;
const FILTERS = [
  { key: "booker_id", label: "Booker ID" },
  { key: "host_id", label: "Host ID" },
  { key: "location_id", label: "Listing ID" },
  { key: "booking_id", label: "Booking ID" },
] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ConversationsPage() {
  return (
    <Suspense fallback={<AdminShell><TableSkeleton columns={5} /></AdminShell>}>
      <ConversationsInner />
    </Suspense>
  );
}

function ConversationsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "log" ? "log" : "find";

  function setParam(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    if (!("page" in next)) params.delete("page");
    router.push(`/conversations?${params.toString()}`);
  }

  return (
    <AdminShell>
      <PageHeader
        title="Disputes & messages"
        description="Find the conversation a dispute is about, then read it only with a stated reason. Every read is permanently logged and visible to the whole admin team."
      />
      <div className="mb-4">
        <Segmented
          label="View"
          value={view}
          options={[
            { value: "find", label: "Find a conversation" },
            { value: "log", label: "Access log" },
          ]}
          onChange={(v) => setParam({ view: v === "log" ? "log" : undefined })}
        />
      </div>
      {view === "find" ? <FindConversations setParam={setParam} /> : <AccessLog />}
    </AdminShell>
  );
}

function FindConversations({ setParam }: { setParam: (next: Record<string, string | undefined>) => void }) {
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1");
  const filters = Object.fromEntries(FILTERS.map((f) => [f.key, searchParams.get(f.key) ?? ""])) as Record<(typeof FILTERS)[number]["key"], string>;
  const [draft, setDraft] = useState(filters);
  const hasFilter = Object.values(filters).some(Boolean);

  const query = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
  const key = hasFilter ? `/v1/admin/conversations?${new URLSearchParams({ ...query, page: String(page) })}` : null;
  const { rows, meta, isLoading, error, refresh } = useAdminList<Summary>(key, () =>
    adminApi.GET("/conversations", { params: { query: { ...query, page, pageSize: PAGE_SIZE } } }).then(unwrapPaginated<Summary>)
  );

  const [opening, setOpening] = useState<Summary | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [transcript, setTranscript] = useState<Transcript | null>(null);

  const invalid = Object.values(draft).some((v) => v && !UUID.test(v.trim()));

  async function open() {
    if (!opening) return;
    setBusy(true);
    try {
      const result = await adminApi
        .POST("/conversations/{id}/access", { params: { path: { id: opening.id } }, body: { reason: reason.trim() } })
        .then(unwrap<Transcript>);
      setTranscript(result);
      setOpening(null);
      setReason("");
    } catch (err) {
      toast.error(extractErrorMessage(err, "Failed to open the conversation."));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<Summary>[] = [
    {
      key: "listing",
      header: "Listing",
      render: (c) =>
        c.location ? (
          <Link href={`/locations/${c.location.id}`} className="hover:underline">
            {c.location.title}
            <span className="block text-xs text-slate-500">{c.location.city}</span>
          </Link>
        ) : (
          "—"
        ),
    },
    {
      key: "people",
      header: "Booker → Host",
      render: (c) => (
        <span>
          <Link href={`/users/${c.booker.id}`} className="hover:underline">
            {personName(c.booker)}
          </Link>{" "}
          →{" "}
          {c.host ? (
            <Link href={`/users/${c.host.id}`} className="hover:underline">
              {personName(c.host)}
            </Link>
          ) : (
            "—"
          )}
        </span>
      ),
    },
    {
      key: "booking",
      header: "Booking",
      render: (c) => (c.booking_id ? <Link href={`/bookings/${c.booking_id}`} className="font-mono text-xs hover:underline">{c.booking_id.slice(0, 8)}</Link> : "—"),
    },
    { key: "messages", header: "Messages", render: (c) => c.message_count },
    { key: "last", header: "Last message", render: (c) => formatDateTime(c.last_message_at) },
    {
      key: "open",
      header: "",
      className: "text-right",
      render: (c) => (
        <Button size="sm" variant="primary" onClick={() => setOpening(c)}>
          Read…
        </Button>
      ),
    },
  ];

  if (transcript) {
    return <TranscriptView transcript={transcript} onClose={() => setTranscript(null)} />;
  }

  return (
    <>
      <Card title="Search" description="Message text is never searched or shown here — only who, which listing, and when.">
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            setParam(Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v.trim() || undefined])));
          }}
        >
          {FILTERS.map((f) => (
            <TextField
              key={f.key}
              label={f.label}
              value={draft[f.key]}
              onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
              placeholder="UUID"
              error={draft[f.key] && !UUID.test(draft[f.key].trim()) ? "Not a valid ID" : undefined}
            />
          ))}
          <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
            <Button type="submit" variant="primary" disabled={invalid}>
              Search
            </Button>
            {hasFilter && (
              <Button
                onClick={() => {
                  setDraft({ booker_id: "", host_id: "", location_id: "", booking_id: "" });
                  setParam(Object.fromEntries(FILTERS.map((f) => [f.key, undefined])));
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </form>
        <p className="mt-3 text-xs text-slate-500">Tip: open a user, listing or booking and use its “Conversations” link to land here pre-filtered.</p>
      </Card>

      <div className="mt-6">
        {!hasFilter ? (
          <EmptyState title="Search by a person, listing or booking to find a conversation." />
        ) : isLoading && rows.length === 0 ? (
          <TableSkeleton columns={6} />
        ) : error ? (
          <ErrorState message={extractErrorMessage(error, "Failed to search conversations.")} onRetry={() => refresh()} />
        ) : rows.length === 0 ? (
          <EmptyState title="No conversations match." />
        ) : (
          <>
            <Table caption="Conversations" columns={columns} rows={rows} rowKey={(c) => c.id} />
            {meta && <Pagination page={meta.page} pageSize={meta.pageSize} total={meta.total} onPageChange={(p) => setParam({ page: String(p) })} />}
          </>
        )}
      </div>

      <Dialog
        open={opening !== null}
        onOpenChange={(o) => {
          if (!o) {
            setOpening(null);
            setReason("");
          }
        }}
        title="Why do you need to read this conversation?"
        description="Private messages between a booker and a host. Your name, the time and this reason are recorded permanently and visible to every admin."
      >
        <div className="space-y-4">
          <TextAreaField
            label="Reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Dispute raised by booker on 15 Nov: host asked for payment outside the platform"
            hint="At least 10 characters."
            maxLength={1000}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpening(null)}>Cancel</Button>
            <Button variant="primary" onClick={open} disabled={busy || reason.trim().length < 10}>
              {busy ? "Opening…" : "Record reason and read"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

function TranscriptView({ transcript, onClose }: { transcript: Transcript; onClose: () => void }) {
  const { conversation } = transcript;
  return (
    <Card
      title={conversation.location?.title ?? "Conversation"}
      description={`${personName(conversation.booker)} (booker) and ${personName(conversation.host)} (host) · ${conversation.message_count} messages`}
      actions={<Button onClick={onClose}>Close transcript</Button>}
    >
      <p className="mb-4 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-inset ring-slate-200">
        Access recorded. This transcript is not saved in the console — closing it discards it from this page.
        {transcript.truncated && " Only the newest 1,000 messages are shown."}
      </p>
      {transcript.messages.length === 0 ? (
        <EmptyState title="No messages in this conversation." />
      ) : (
        <ol className="space-y-3">
          {transcript.messages.map((m) => (
            <li key={m.id} className={m.sender_role === "host" ? "flex justify-end" : "flex justify-start"}>
              <div className={m.sender_role === "host" ? "max-w-[80%] rounded-lg bg-host-50 px-3 py-2 ring-1 ring-inset ring-host-100" : "max-w-[80%] rounded-lg bg-slate-100 px-3 py-2"}>
                <div className="mb-0.5 text-xs font-medium text-slate-500">
                  {m.sender_role === "host" ? "Host" : m.sender_role === "booker" ? "Booker" : "Other"} · {formatDateTime(m.created_at)}
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-slate-800">{m.body}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function AccessLog() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1");
  const { rows, meta, isLoading, error, refresh } = useAdminList<AccessEntry>(`/v1/admin/message-access-log?page=${page}`, () =>
    adminApi.GET("/message-access-log", { params: { query: { page, pageSize: PAGE_SIZE } } }).then(unwrapPaginated<AccessEntry>)
  );

  const columns: Column<AccessEntry>[] = [
    { key: "when", header: "When", render: (e) => formatDateTime(e.created_at) },
    {
      key: "admin",
      header: "Admin",
      render: (e) => (
        <Link href={`/users/${e.admin_user_id}`} className="hover:underline">
          {personName(e.admin)}
        </Link>
      ),
    },
    { key: "reason", header: "Reason", render: (e) => <span className="whitespace-pre-wrap break-words">{e.reason}</span> },
    { key: "conversation", header: "Conversation", render: (e) => <span className="font-mono text-xs">{e.conversation_id.slice(0, 8)}</span> },
  ];

  if (isLoading && rows.length === 0) return <TableSkeleton columns={4} />;
  if (error) return <ErrorState message={extractErrorMessage(error, "Failed to load the access log.")} onRetry={() => refresh()} />;
  if (rows.length === 0) return <EmptyState title="No admin has read a conversation yet." />;
  return (
    <>
      <Table caption="Message access log" columns={columns} rows={rows} rowKey={(e) => e.id} />
      {meta && (
        <Pagination
          page={meta.page}
          pageSize={meta.pageSize}
          total={meta.total}
          onPageChange={(p) => router.push(`/conversations?view=log&page=${p}`)}
        />
      )}
    </>
  );
}
