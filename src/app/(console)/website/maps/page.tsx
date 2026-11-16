"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { CheckCircle2, CircleAlert, MapPinned } from "lucide-react";
import { Guide } from "@/components/messaging/ChannelCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { TextField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, unwrap } from "@/lib/api";
import { API_BASE_URL } from "@/lib/config";
import { formatDateTime } from "@/lib/format";
import { useAdminMe } from "@/lib/useAdminMe";
import type { components } from "@/types/admin-api";

type Integration = components["schemas"]["SiteIntegrationStatus"];
interface PublicSiteConfig {
  maps: { provider: "google"; browser_key: string; map_id: string | null } | null;
}

declare global {
  interface Window {
    google?: { maps?: { Map: new (el: HTMLElement, options: Record<string, unknown>) => unknown } };
    gm_authFailure?: () => void;
    __adminMapsReady?: () => void;
  }
}

/**
 * Loads the Maps JavaScript API with the saved browser key and draws a map. Google only accepts a
 * restricted key on the domains listed for it, so this is the real proof the key works -- for this
 * console's own address, which must be on the key's list too. It uses Google's default style (the
 * website applies the Map ID), which keeps it within this console's strict security policy.
 */
function MapPreview({ browserKey }: { browserKey: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ok" | "refused" | "failed">("loading");

  useEffect(() => {
    let cancelled = false;
    const draw = () => {
      if (cancelled || !ref.current || !window.google?.maps) return;
      new window.google.maps.Map(ref.current, {
        center: { lat: 19.076, lng: 72.8777 },
        zoom: 11,
        disableDefaultUI: true,
      });
      setState("ok");
    };
    const timeout = window.setTimeout(() => !cancelled && setState((s) => (s === "loading" ? "failed" : s)), 15_000);
    window.gm_authFailure = () => !cancelled && setState("refused");
    if (window.google?.maps) {
      draw();
    } else {
      window.__adminMapsReady = draw;
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(browserKey)}&v=weekly&loading=async&callback=__adminMapsReady`;
      script.async = true;
      script.onerror = () => !cancelled && setState("failed");
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [browserKey]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <div>
      <div ref={ref} className="h-64 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100" aria-label="Map preview" role="img" />
      <p className="mt-2 flex items-center gap-1.5 text-[13px]">
        {state === "ok" && (
          <span className="flex items-center gap-1.5 text-green-700">
            <CheckCircle2 aria-hidden className="h-4 w-4" /> The key works on this address. The website loads maps the same way.
          </span>
        )}
        {state === "loading" && <span className="text-slate-500">Loading a map with the saved key…</span>}
        {(state === "refused" || state === "failed") && (
          <span className="flex items-start gap-1.5 text-red-700">
            <CircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            {state === "refused"
              ? `Google refused the key here. Add ${origin}/* to the key's website restrictions and check the Maps JavaScript API is enabled.`
              : "The map did not load here. Check the key's website restrictions and that the Maps JavaScript API is enabled, then reload."}
          </span>
        )}
      </p>
    </div>
  );
}

export default function MapsPage() {
  const { can } = useAdminMe();
  const canManage = can("site.manage");
  const integrations = useSWR("/v1/admin/site/integrations", () => adminApi.GET("/site/integrations").then(unwrap<Integration[]>));
  const publicConfig = useSWR(`${API_BASE_URL}/v1/site-config`, (url: string) =>
    fetch(url).then(async (r) => ((await r.json()) as { data: PublicSiteConfig }).data)
  );
  const maps = integrations.data?.find((i) => i.provider === "google_maps");
  const connected = Boolean(maps?.connected);

  const [browserKey, setBrowserKey] = useState("");
  const [mapId, setMapId] = useState("");
  const [serverKey, setServerKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    setMapId((maps?.config.map_id as string | null | undefined) ?? "");
  }, [maps?.config.map_id]);

  async function refresh() {
    await Promise.all([integrations.mutate(), publicConfig.mutate()]);
  }

  async function save() {
    setBusy("save");
    try {
      await adminApi
        .PUT("/site/integrations/google_maps", {
          body: { browser_key: browserKey.trim(), map_id: mapId.trim() || null, ...(serverKey.trim() ? { server_key: serverKey.trim() } : {}) },
        })
        .then(unwrap);
      toast.success("Google Maps saved.");
      setBrowserKey("");
      setServerKey("");
      await refresh();
    } catch (e) {
      toast.error(extractErrorMessage(e, "Could not save the keys."));
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy("test");
    try {
      const result = await adminApi.POST("/site/integrations/{provider}/test", { params: { path: { provider: "google_maps" } } }).then(unwrap<{ ok: boolean; detail: string }>);
      (result.ok ? toast.success : toast.error)(result.detail);
      await integrations.mutate();
    } catch (e) {
      toast.error(extractErrorMessage(e, "Test failed."));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("remove");
    try {
      await adminApi.DELETE("/site/integrations/{provider}", { params: { path: { provider: "google_maps" } } }).then(unwrap);
      toast.success("Google Maps disconnected. The website hides its maps until a key is added again.");
      setConfirmRemove(false);
      await refresh();
    } catch (e) {
      toast.error(extractErrorMessage(e, "Could not disconnect."));
    } finally {
      setBusy(null);
    }
  }

  const keyLooksRight = /^AIza[0-9A-Za-z_-]{35}$/.test(browserKey.trim());

  return (
    <>
      <PageHeader
        title="Google Maps"
        description="Maps, “near me” and place search on the website. The browser key is sent to every visitor by design, so it must be locked to your domains in Google Cloud; the optional server key stays encrypted on the backend."
      />
      {integrations.isLoading ? (
        <Skeleton className="h-72 w-full rounded-xl" />
      ) : integrations.error ? (
        <ErrorState message={extractErrorMessage(integrations.error, "Failed to load.")} onRetry={() => integrations.mutate()} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card
              title={
                <span className="flex items-center gap-2">
                  <MapPinned aria-hidden className="h-4 w-4 text-slate-400" /> Status
                </span>
              }
              actions={
                connected ? (
                  <Badge tone="success" dot>
                    Connected
                  </Badge>
                ) : (
                  <Badge dot>Not connected</Badge>
                )
              }
            >
              {connected && maps ? (
                <>
                  <dl className="mb-4 grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-3">
                    <div>
                      <dt className="text-slate-500">Browser key</dt>
                      <dd className="font-mono text-slate-900">{(maps.config.browser_key_preview as string) ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Map ID</dt>
                      <dd className="font-mono text-slate-900">{(maps.config.map_id as string) ?? "Default style"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Server key</dt>
                      <dd className="text-slate-900">{maps.has_secret ? "Set · hidden" : "Not set"}</dd>
                    </div>
                  </dl>
                  {publicConfig.data?.maps ? (
                    <MapPreview browserKey={publicConfig.data.maps.browser_key} />
                  ) : (
                    <Skeleton className="h-64 w-full rounded-lg" />
                  )}
                  {maps.last_tested_at && (
                    <p className="mt-3 text-xs text-slate-500">
                      Last test {formatDateTime(maps.last_tested_at)}: {maps.last_test_ok ? "passed" : `failed — ${maps.last_test_error ?? ""}`}
                    </p>
                  )}
                  {canManage && (
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" disabled={busy !== null} onClick={test}>
                        {busy === "test" ? "Testing…" : "Test server key"}
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => setConfirmRemove(true)}>
                        Disconnect
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500">Until a key is added, the website shows listings without maps and place search falls back to typed city names.</p>
              )}
            </Card>

            {canManage ? (
              <Card title={connected ? "Replace keys" : "Connect Google Maps"}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    className="sm:col-span-2"
                    label="Browser key"
                    value={browserKey}
                    onChange={(e) => setBrowserKey(e.target.value)}
                    placeholder="AIza…"
                    autoComplete="off"
                    error={browserKey && !keyLooksRight ? "Google Maps keys start with AIza and are 39 characters." : undefined}
                    hint="Restricted by website (HTTP referrer). Enable Maps JavaScript API and Places API (New) on it."
                  />
                  <TextField
                    label="Map ID (optional)"
                    value={mapId}
                    onChange={(e) => setMapId(e.target.value)}
                    placeholder="e.g. 8e0a97af9386fef"
                    hint="For a custom-styled map that matches the brand."
                  />
                  <TextField
                    label={maps?.has_secret ? "Server key (leave empty to keep)" : "Server key (optional)"}
                    type="password"
                    autoComplete="off"
                    value={serverKey}
                    onChange={(e) => setServerKey(e.target.value)}
                    hint="Only for backend geocoding. Stored encrypted; never shown again."
                  />
                </div>
                <div className="mt-4 flex justify-end">
                  <Button variant="primary" disabled={busy !== null || !keyLooksRight} onClick={save}>
                    {busy === "save" ? "Saving…" : connected ? "Save keys" : "Connect"}
                  </Button>
                </div>
              </Card>
            ) : (
              <p className="text-sm text-slate-500">Only a super admin can change the Maps keys.</p>
            )}
          </div>

          <div className="space-y-6">
            <Guide
              title="Create the keys in Google Cloud"
              steps={[
                <>
                  Go to <span className="font-medium">console.cloud.google.com</span>, create a project and add a billing account (Google gives a
                  monthly free allowance).
                </>,
                <>
                  APIs &amp; Services → Library: enable <strong>Maps JavaScript API</strong>, <strong>Places API (New)</strong> and{" "}
                  <strong>Geocoding API</strong>.
                </>,
                <>
                  Credentials → Create credentials → API key. Edit it: Application restrictions → <strong>Websites</strong>, add your website
                  domains as <span className="font-mono">https://example.com/*</span> and <span className="font-mono">https://www.example.com/*</span>,
                  the staging address, and this console&apos;s address (for the preview).
                </>,
                <>API restrictions → restrict to the three APIs above. Paste it here as the Browser key.</>,
                <>
                  Optional: Google Maps Platform → Map management → Create Map ID (JavaScript, Vector) to style the map; paste the ID here.
                </>,
                <>Optional: a second key restricted to Geocoding + Places only (no website restriction) as the Server key.</>,
              ]}
            />
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Disconnect Google Maps?"
        description="The website stops showing maps and place suggestions straight away. The server key is deleted from the vault."
        danger
        busy={busy === "remove"}
        confirmLabel="Disconnect"
        onConfirm={remove}
      />
    </>
  );
}
