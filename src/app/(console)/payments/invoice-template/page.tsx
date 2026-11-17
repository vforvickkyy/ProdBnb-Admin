"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import type { InvoiceSettings } from "@/components/invoices/invoiceText";
import { adminApi, fetchAdminFile, unwrap } from "@/lib/api";
import { useAdminMe } from "@/lib/useAdminMe";
import type { paths } from "@/types/admin-api";

const FIELDS = [
  "legal_name",
  "trade_name",
  "gstin",
  "pan",
  "address_line1",
  "address_line2",
  "city",
  "state",
  "state_code",
  "postal_code",
  "country",
  "email",
  "phone",
  "website",
  "number_prefix",
  "sac_code",
  "tax_label",
  "notes",
  "terms",
  "signatory",
] as const;
type Field = (typeof FIELDS)[number];
type Draft = Record<Field, string> & { auto_send: boolean };
type SettingsPatch = NonNullable<paths["/invoice-settings"]["patch"]["requestBody"]>["content"]["application/json"];

function draftFrom(s: InvoiceSettings): Draft {
  const d = Object.fromEntries(FIELDS.map((f) => [f, (s[f] as string | null) ?? ""])) as Record<Field, string>;
  return { ...d, auto_send: s.auto_send };
}

/** Only what changed, so an untouched field never fails validation. */
function changes(draft: Draft, saved: Draft): Partial<Record<Field, string | null>> & { auto_send?: boolean } {
  const out: Partial<Record<Field, string | null>> & { auto_send?: boolean } = {};
  for (const f of FIELDS) if (draft[f].trim() !== saved[f].trim()) out[f] = draft[f].trim() === "" ? (f === "country" || f === "number_prefix" || f === "tax_label" ? saved[f] : null) : draft[f].trim();
  if (draft.auto_send !== saved.auto_send) out.auto_send = draft.auto_send;
  return out;
}

const fyNow = () => {
  const d = new Date();
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${String(y % 100).padStart(2, "0")}-${String((y + 1) % 100).padStart(2, "0")}`;
};

export default function InvoiceTemplatePage() {
  const { can } = useAdminMe();
  const canEdit = can("invoices.manage");
  const { data, error, mutate } = useSWR("/v1/admin/invoice-settings", () => adminApi.GET("/invoice-settings").then(unwrap));
  const saved = useMemo(() => (data ? draftFrom(data) : null), [data]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ url: string | null; loading: boolean; error: string | null }>({ url: null, loading: false, error: null });
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (saved && !draft) setDraft(saved);
  }, [saved, draft]);

  const diff = draft && saved ? changes(draft, saved) : {};
  const dirty = Object.keys(diff).length > 0;

  async function refreshPreview(body: object) {
    setPreview((p) => ({ ...p, loading: true, error: null }));
    try {
      const blob = await fetchAdminFile("/invoice-settings/preview", { method: "POST", body: JSON.stringify(body) });
      const url = URL.createObjectURL(blob);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      setPreview({ url, loading: false, error: null });
    } catch (err) {
      setPreview((p) => ({ ...p, loading: false, error: extractErrorMessage(err, "Couldn't make the preview.") }));
    }
  }

  // Preview follows the edits, a moment after typing stops.
  const diffKey = JSON.stringify(diff);
  useEffect(() => {
    if (!draft) return;
    const t = setTimeout(() => refreshPreview(JSON.parse(diffKey)), 700);
    return () => clearTimeout(t);
  }, [diffKey, Boolean(draft)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => void (urlRef.current && URL.revokeObjectURL(urlRef.current)), []);

  async function save() {
    if (!dirty) return;
    setSaving(true);
    try {
      const next = unwrap(await adminApi.PATCH("/invoice-settings", { body: diff as SettingsPatch }));
      await mutate(next, { revalidate: false });
      setDraft(draftFrom(next));
      toast.success(next.missing.length ? `Saved. Still needed before invoices can be issued: ${next.missing.join(", ")}.` : "Invoice template saved.");
    } catch (err) {
      toast.error(extractErrorMessage(err, "Couldn't save the template."));
    } finally {
      setSaving(false);
    }
  }

  if (error) return <ErrorState message={extractErrorMessage(error, "Failed to load the invoice template.")} onRetry={() => mutate()} />;
  if (!draft || !data) return <Skeleton className="h-96 w-full rounded-xl" />;

  const set = (f: Field) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft({ ...draft, [f]: e.target.value });
  const field = (f: Field, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> & { hint?: string } = {}) => (
    <TextField label={label} value={draft[f]} onChange={set(f)} disabled={!canEdit} {...extra} />
  );

  return (
    <>
      <Link href="/payments/invoices" className="mb-3 inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-900">
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Invoices
      </Link>
      <PageHeader
        title="Invoice template"
        description="The company details, numbering and wording on every invoice. Changes apply to invoices issued from now on; issued invoices keep what they were issued with."
        actions={
          canEdit ? (
            <div className="flex gap-2">
              <Button onClick={() => setDraft(saved)} disabled={!dirty || saving}>
                Discard
              </Button>
              <Button variant="primary" onClick={save} disabled={!dirty || saving}>
                {saving ? "Saving…" : "Save template"}
              </Button>
            </div>
          ) : undefined
        }
      />
      {data.missing.length > 0 && (
        <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Add the company&apos;s {data.missing.join(" and ")} to start issuing invoices. Bookings paid until then get theirs once it&apos;s filled in.
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Card title="Company" description="Who the invoice is from. The trade name is shown large at the top; the legal name under it.">
            <div className="grid gap-4 sm:grid-cols-2">
              {field("legal_name", "Legal name", { placeholder: "Company Pvt Ltd", required: true })}
              {field("trade_name", "Trade name (optional)", { placeholder: "Brand name" })}
              {field("gstin", "GSTIN", { placeholder: "27AABCU9603R1ZM", maxLength: 15, hint: "Leave blank if not registered for GST." })}
              {field("pan", "PAN", { placeholder: "AABCU9603R", maxLength: 10 })}
            </div>
          </Card>
          <Card title="Address" description="Registered address. The state decides CGST + SGST (same state as the booker) or IGST.">
            <div className="grid gap-4 sm:grid-cols-2">
              {field("address_line1", "Address line 1", { className: "sm:col-span-2" })}
              {field("address_line2", "Address line 2 (optional)", { className: "sm:col-span-2" })}
              {field("city", "City")}
              {field("postal_code", "PIN code", { inputMode: "numeric", maxLength: 12 })}
              {field("state", "State", { placeholder: "Maharashtra" })}
              {field("state_code", "State code", { placeholder: "27", inputMode: "numeric", maxLength: 2, hint: "The first two digits of the GSTIN." })}
              {field("country", "Country")}
            </div>
          </Card>
          <Card title="Contact" description="Printed under the company name.">
            <div className="grid gap-4 sm:grid-cols-2">
              {field("email", "Billing email", { type: "email" })}
              {field("phone", "Phone")}
              {field("website", "Website", { className: "sm:col-span-2" })}
            </div>
          </Card>
          <Card title="Numbering and tax">
            <div className="grid gap-4 sm:grid-cols-3">
              {field("number_prefix", "Number prefix", {
                maxLength: 4,
                hint: `Invoices are numbered ${(draft.number_prefix || "INV").toUpperCase()}/${fyNow()}/0001, starting again each April.`,
              })}
              {field("sac_code", "SAC code", { placeholder: "997212", inputMode: "numeric", maxLength: 8, hint: "Rental of property services." })}
              {field("tax_label", "Tax name", { maxLength: 20 })}
            </div>
          </Card>
          <Card title="Wording">
            <div className="space-y-4">
              <TextAreaField label="Notes" rows={2} value={draft.notes} onChange={set("notes")} disabled={!canEdit} hint="A short line, like a thank-you." />
              <TextAreaField label="Terms" rows={3} value={draft.terms} onChange={set("terms")} disabled={!canEdit} />
              {field("signatory", "Signed by", { placeholder: "Authorised signatory", hint: "Shown at the bottom right, above “Authorised signatory”." })}
            </div>
          </Card>
          <Card title="Sending">
            <Switch
              checked={draft.auto_send}
              onChange={(v) => setDraft({ ...draft, auto_send: v })}
              disabled={!canEdit}
              label="Email invoices automatically"
              description={
                data.email_connected
                  ? "When a booking is paid, its invoice is emailed to the booker straight away. Turn off to check and send them yourself."
                  : "Email isn't connected yet, so invoices wait under “Pending to send” until it is."
              }
            />
          </Card>
        </form>

        <div className="xl:sticky xl:top-6 xl:self-start">
          <Card
            title="Preview"
            description="A sample invoice with your template, including unsaved changes."
            actions={
              <Button size="sm" variant="ghost" onClick={() => refreshPreview(diff)} aria-label="Refresh preview">
                <RefreshCw aria-hidden className={`h-3.5 w-3.5 ${preview.loading ? "animate-spin" : ""}`} />
              </Button>
            }
          >
            {preview.error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{preview.error}</p>
            ) : preview.url ? (
              <iframe title="Invoice preview" src={`${preview.url}#toolbar=0&navpanes=0&view=FitH`} className="h-[70vh] w-full rounded-lg border border-slate-200 bg-white" />
            ) : (
              <Skeleton className="h-[70vh] w-full rounded-lg" />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
