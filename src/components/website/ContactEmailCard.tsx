"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { extractErrorMessage } from "@/components/ui/ErrorState";
import { TextField } from "@/components/ui/Field";
import { adminApi, unwrap } from "@/lib/api";
import type { components } from "@/types/admin-api";

type SiteSettings = components["schemas"]["SiteSettings"];

/** The address the website shows in its footer and fills into pages as {{support_email}}. */
export function ContactEmailCard({ canEdit }: { canEdit: boolean }) {
  const { data, mutate } = useSWR("/v1/admin/site/contact", () => adminApi.GET("/site/contact").then(unwrap<SiteSettings>));
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setEmail(data?.support_email ?? ""), [data?.support_email]);
  const dirty = Boolean(data) && email.trim().toLowerCase() !== (data!.support_email ?? "");

  async function save() {
    setBusy(true);
    try {
      await adminApi.PUT("/site/contact", { body: { support_email: email.trim() || null } }).then(unwrap);
      toast.success(email.trim() ? "Contact email saved." : "Contact email removed.");
      await mutate();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not save the contact email."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Contact email" description="Shown in the website footer and wherever a page says {{support_email}}.">
      <div className="flex flex-wrap items-end gap-3">
        <TextField
          className="min-w-[240px] flex-1"
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="help@yourdomain.com"
          disabled={!canEdit || !data}
          hint={data && !data.support_email ? "Not set: pages link to the Contact page instead." : undefined}
        />
        {canEdit && (
          <Button variant="primary" onClick={() => void save()} disabled={!dirty || busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        )}
      </div>
    </Card>
  );
}
