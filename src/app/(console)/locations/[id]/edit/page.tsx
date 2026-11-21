"use client";

import { Suspense, use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/lib/navigation";
import { toast } from "sonner";
import useSWR from "swr";
import { ArrowLeft, CheckCircle2, Circle, ExternalLink, ImageIcon } from "lucide-react";
import { DetailsForm, detailsFromListing, detailsToBody, ListingDetails, validateDetails } from "@/components/listing/DetailsForm";
import { CustomPoints, GroupedChecks } from "@/components/listing/Features";
import { PhotoManager } from "@/components/listing/PhotoManager";
import { PricingEditor } from "@/components/listing/PricingEditor";
import { PropRow, PropsEditor, propsFromListing, propsToBody, validateProps } from "@/components/listing/PropsEditor";
import { SectionsEditor } from "@/components/listing/SectionsEditor";
import { TimingsEditor } from "@/components/listing/TimingsEditor";
import { useCatalogOptions } from "@/components/listing/useCatalogOptions";
import { SeoEditor } from "@/components/website/SeoEditor";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChipSelect } from "@/components/ui/ChipSelect";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { TabPanel, Tabs } from "@/components/ui/Tabs";
import { adminApi, unwrap } from "@/lib/api";
import { cn } from "@/lib/cn";
import { personName } from "@/lib/format";
import { listingApi } from "@/lib/listingApi";
import { autoListingDescription, autoListingTitle, locationPath } from "@/lib/seo";
import { useAdminMe } from "@/lib/useAdminMe";
import type { components } from "@/types/admin-api";

type LocationDetail = components["schemas"]["LocationDetail"];
type Tab = "details" | "photos" | "pricing" | "timings" | "sections" | "tags" | "props" | "seo" | "publish";
const TABS: Tab[] = ["details", "photos", "pricing", "timings", "sections", "tags", "props", "seo", "publish"];

export default function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense
      fallback={
        <>
          <Skeleton className="h-96 w-full" />
        </>
      }
    >
      <EditListing id={id} />
    </Suspense>
  );
}

function EditListing({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : "details";
  const { can } = useAdminMe();
  const canEdit = can("locations.moderate");
  const canEditSeo = can("content.manage");

  const {
    data: location,
    error,
    isLoading,
    mutate,
  } = useSWR(`/v1/admin/locations/${id}`, () => adminApi.GET("/locations/{id}", { params: { path: { id } } }).then(unwrap<LocationDetail>));
  const { data: host } = useSWR(location ? `/v1/admin/users/${location.host_id}` : null, () =>
    adminApi.GET("/users/{id}", { params: { path: { id: location!.host_id } } }).then(unwrap),
  );
  const rules = useSWR(`/v1/locations/${id}/availability/rules`, () => listingApi.rules(id));

  function setTab(next: Tab) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", next);
    router.replace(`/locations/${id}/edit?${p.toString()}`, { scroll: false });
  }

  const checklist = useMemo(() => {
    if (!location) return [];
    return [
      { key: "photos", label: "At least 3 photos (the first is the cover)", done: location.media.length >= 3, tab: "photos" as Tab },
      location.price_on_request
        ? { key: "price", label: "Price on request (no prices needed)", done: true, tab: "pricing" as Tab }
        : { key: "price", label: "At least one price offered", done: location.booking_options.length > 0, tab: "pricing" as Tab },
      { key: "hours", label: "Weekly opening hours", done: (rules.data ?? []).length > 0, tab: "timings" as Tab },
      { key: "description", label: "A description of 80+ characters", done: location.description.trim().length >= 80, tab: "details" as Tab },
      {
        key: "coords",
        label: "Map coordinates (for map search)",
        done: location.latitude !== null && location.longitude !== null,
        tab: "details" as Tab,
      },
      { key: "category", label: "At least one category", done: location.categories.length > 0, tab: "tags" as Tab },
      {
        key: "space",
        label: "Space details (area, parking, restrooms)",
        done: location.area_sqft !== null && location.parking_spaces !== null && location.restroom_count !== null,
        tab: "details" as Tab,
      },
    ];
  }, [location, rules.data]);
  const missing = checklist.filter((c) => !c.done).length;

  if (isLoading) {
    return (
      <>
        <Skeleton className="mb-4 h-10 w-80" />
        <Skeleton className="h-96 w-full" />
      </>
    );
  }
  if (error || !location) {
    return (
      <>
        <ErrorState message={extractErrorMessage(error, "Failed to load the listing.")} onRetry={() => mutate()} />
      </>
    );
  }

  const cover = location.media[0];
  const refresh = () => {
    void mutate();
    void rules.mutate();
  };

  return (
    <>
      <Link href={`/locations/${id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back to listing
      </Link>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 sm:h-16 sm:w-24">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover.url} alt="Cover" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon aria-hidden className="h-5 w-5 text-slate-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="line-clamp-2 break-words text-lg font-semibold text-slate-900 sm:text-xl">{location.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
              <StatusBadge status={location.status} />
              {location.listing_code && (
                <span
                  title="Listing ID — only the host and the team see it"
                  className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700"
                >
                  {location.listing_code}
                </span>
              )}
              <span className="whitespace-nowrap">
                {location.city}, {location.country}
              </span>
              <span aria-hidden className="hidden sm:inline">
                ·
              </span>
              <span className="whitespace-nowrap">
                Host:{" "}
                <Link href={`/users/${location.host_id}`} className="underline hover:text-slate-800">
                  {host ? personName(host as { first_name: string | null; last_name: string | null }) : "…"}
                </Link>
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {missing > 0 && location.status !== "published" && (
            <Button onClick={() => setTab("publish")}>
              {missing} item{missing === 1 ? "" : "s"} left
            </Button>
          )}
          <Link
            href={`/locations/${id}`}
            className="inline-flex items-center gap-1.5 h-8 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-800 shadow-card transition-colors hover:bg-slate-50"
          >
            <ExternalLink aria-hidden className="h-3.5 w-3.5" /> Moderation & bookings
          </Link>
        </div>
      </div>

      {!canEdit && <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Your role can view this listing but not edit it.</p>}

      <Tabs<Tab>
        label="Listing editor"
        value={tab}
        onChange={setTab}
        items={[
          { value: "details", label: "Details" },
          { value: "photos", label: "Photos", badge: <Count n={location.media.length} /> },
          { value: "pricing", label: "Pricing", badge: <Count n={location.booking_options.length} /> },
          { value: "timings", label: "Timings" },
          { value: "sections", label: "Sections" },
          { value: "tags", label: "Features & rules" },
          { value: "props", label: "Props", badge: <Count n={location.props.length} /> },
          { value: "seo", label: "SEO" },
          { value: "publish", label: "Publish", badge: missing > 0 ? <Count n={missing} warn /> : undefined },
        ]}
      />

      {tab === "details" && (
        <TabPanel value="details">
          <DetailsTab location={location} canEdit={canEdit} onSaved={refresh} />
        </TabPanel>
      )}
      {tab === "photos" && (
        <TabPanel value="photos">
          <Card title="Gallery" description="Drag photos to reorder. The first photo is the cover shown in search and in Collections.">
            <PhotoManager locationId={id} canEdit={canEdit} onChanged={refresh} />
          </Card>
        </TabPanel>
      )}
      {tab === "pricing" && (
        <TabPanel value="pricing">
          <PricingEditor locationId={id} canEdit={canEdit} onChanged={refresh} priceOnRequest={Boolean(location?.price_on_request)} />
        </TabPanel>
      )}
      {tab === "timings" && (
        <TabPanel value="timings">
          <TimingsEditor locationId={id} timezone={location.timezone} canEdit={canEdit} onChanged={refresh} />
        </TabPanel>
      )}
      {tab === "sections" && (
        <TabPanel value="sections">
          <SectionsEditor locationId={id} canEdit={canEdit} />
        </TabPanel>
      )}
      {tab === "tags" && (
        <TabPanel value="tags">
          <TagsTab location={location} canEdit={canEdit} onSaved={refresh} />
        </TabPanel>
      )}
      {tab === "props" && (
        <TabPanel value="props">
          <PropsTab location={location} canEdit={canEdit} onSaved={refresh} />
        </TabPanel>
      )}
      {tab === "seo" && (
        <TabPanel value="seo">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card
              className="lg:col-span-2"
              title="Search & sharing"
              description="How this listing appears in Google and when its link is shared. Empty fields are written from the listing's title, city and description."
            >
              <SeoEditor
                type="location"
                entityKey={location.id}
                canEdit={canEditSeo}
                auto={{
                  title: autoListingTitle(location),
                  description: autoListingDescription(location),
                  path: locationPath(location),
                  image: location.media[0]?.url ?? null,
                }}
              />
            </Card>
            <Card title="Tips">
              <ul className="list-disc space-y-2 pl-4 text-[13px] leading-5 text-slate-600">
                <li>Lead with what people search for: the kind of space, the area and the shoot type — “Sunlit rooftop in Bandra for music videos”.</li>
                <li>Keep titles under 60 characters and descriptions under 155 so Google doesn&apos;t cut them off.</li>
                <li>A strong, landscape cover photo is used when the link is shared. Change it in Photos, or set a share image here.</li>
                <li>Only hide a listing from search if it shouldn&apos;t be found — a draft does that already.</li>
              </ul>
            </Card>
          </div>
        </TabPanel>
      )}
      {tab === "publish" && (
        <TabPanel value="publish">
          <PublishTab location={location} checklist={checklist} canEdit={canEdit} onTab={setTab} onChanged={refresh} />
        </TabPanel>
      )}
    </>
  );
}

function Count({ n, warn }: { n: number; warn?: boolean }) {
  return (
    <span className={cn("rounded-full px-1.5 text-[11px] font-semibold", warn ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600")}>
      {n}
    </span>
  );
}

/** Shared bottom bar for tabs with a form: appears only when there is something to save. */
function SaveBar({ dirty, busy, onSave, onReset }: { dirty: boolean; busy: boolean; onSave: () => void; onReset: () => void }) {
  if (!dirty) return null;
  return (
    <div className="sticky bottom-4 z-20 mt-6 flex animate-fade-in items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg">
      <span className="text-sm text-slate-600">You have unsaved changes.</span>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onReset} disabled={busy}>
          Discard
        </Button>
        <Button variant="primary" onClick={onSave} disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function DetailsTab({ location, canEdit, onSaved }: { location: LocationDetail; canEdit: boolean; onSaved: () => void }) {
  const initial = useMemo(() => detailsFromListing(location), [location]);
  const [value, setValue] = useState<ListingDetails>(initial);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ListingDetails, string>>>({});
  useEffect(() => setValue(initial), [initial]);
  const dirty = JSON.stringify(value) !== JSON.stringify(initial);

  async function save() {
    const found = validateDetails(value);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error("Fix the highlighted fields.");
      return;
    }
    setBusy(true);
    try {
      await adminApi.PATCH("/locations/{id}", { params: { path: { id: location.id } }, body: detailsToBody(value) as never }).then(unwrap);
      toast.success("Details saved.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset disabled={!canEdit} className="space-y-6">
      <Card title="Basics">
        <DetailsForm value={value} onChange={setValue} errors={errors} sections={["basics"]} />
      </Card>
      <Card title="Space details" description="Shown on the listing page and used by the search filters. Leave empty what you don't know.">
        <DetailsForm value={value} onChange={setValue} errors={errors} sections={["space"]} />
      </Card>
      <Card title="Address & map">
        <DetailsForm value={value} onChange={setValue} errors={errors} sections={["address"]} />
      </Card>
      <SaveBar dirty={dirty} busy={busy} onSave={save} onReset={() => setValue(initial)} />
    </fieldset>
  );
}

function TagsTab({ location, canEdit, onSaved }: { location: LocationDetail; canEdit: boolean; onSaved: () => void }) {
  const categories = useCatalogOptions("categories");
  const amenities = useCatalogOptions("amenities");
  const useCases = useCatalogOptions("use-cases");
  // Amenities and "allowed here" rules are the same kind of row; the listing stores both in one list.
  const initial = useMemo(
    () => ({
      category_ids: location.categories.map((c) => c.id),
      amenity_ids: [...location.amenities, ...location.rules].map((c) => c.id),
      use_case_ids: location.use_cases.map((c) => c.id),
      custom_amenities: location.custom_amenities,
      custom_rules: location.custom_rules,
    }),
    [location],
  );
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => setValue(initial), [initial]);
  const dirty = JSON.stringify(value) !== JSON.stringify(initial);

  async function save() {
    setBusy(true);
    try {
      await adminApi.PATCH("/locations/{id}", { params: { path: { id: location.id } }, body: value as never }).then(unwrap);
      toast.success("Features & rules saved.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const setIds = (ids: string[], kind: "amenity" | "rule") => {
    const others = value.amenity_ids.filter((id) => {
      const item = amenities.items.find((a) => a.id === id);
      return (item?.kind ?? "amenity") !== kind;
    });
    setValue({ ...value, amenity_ids: [...others, ...ids.filter((id) => !others.includes(id))] });
  };

  return (
    <fieldset disabled={!canEdit} className="space-y-6">
      <Card title="Categories & good for">
        <div className="space-y-6">
          <ChipSelect
            label="Categories"
            options={categories.items}
            selected={value.category_ids}
            max={20}
            onChange={(ids) => setValue({ ...value, category_ids: ids })}
          />
          <ChipSelect
            label="Good for"
            options={useCases.items}
            selected={value.use_case_ids}
            max={10}
            onChange={(ids) => setValue({ ...value, use_case_ids: ids })}
          />
        </div>
      </Card>
      <Card title="Amenities" description="What the place offers. Shown under “Amenities” on the listing page.">
        <div className="space-y-6">
          <GroupedChecks
            label="Tick what applies"
            options={amenities.items}
            kind="amenity"
            selected={value.amenity_ids}
            onChange={(ids) => setIds(ids, "amenity")}
          />
          <CustomPoints
            label="Your own amenities"
            hint="Anything the list above doesn't cover."
            placeholder="e.g. Rooftop water tank"
            values={value.custom_amenities}
            onChange={(next) => setValue({ ...value, custom_amenities: next })}
          />
        </div>
      </Card>
      <Card title="Location rules" description="What is and isn't allowed. Shown under “Location rules” on the listing page.">
        <div className="space-y-6">
          <GroupedChecks
            label="Allowed here"
            options={amenities.items}
            kind="rule"
            selected={value.amenity_ids}
            onChange={(ids) => setIds(ids, "rule")}
          />
          <CustomPoints
            label="Your own rules"
            hint="Write rules in your own words, e.g. “No shoes inside”."
            placeholder="e.g. No shoes inside the set"
            values={value.custom_rules}
            onChange={(next) => setValue({ ...value, custom_rules: next })}
          />
        </div>
      </Card>
      <SaveBar dirty={dirty} busy={busy} onSave={save} onReset={() => setValue(initial)} />
    </fieldset>
  );
}

function PropsTab({ location, canEdit, onSaved }: { location: LocationDetail; canEdit: boolean; onSaved: () => void }) {
  const initialRows = useMemo(() => propsFromListing(location.props), [location]);
  const [rows, setRows] = useState<PropRow[]>(initialRows);
  const [busy, setBusy] = useState(false);
  useEffect(() => setRows(initialRows), [initialRows]);
  // Compare what would be saved, not the row keys (which change on every reload).
  const dirty = JSON.stringify(propsToBody(rows)) !== JSON.stringify(propsToBody(initialRows));

  async function save() {
    const problem = validateProps(rows);
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    try {
      await adminApi.PATCH("/locations/{id}", { params: { path: { id: location.id } }, body: { props: propsToBody(rows) } as never }).then(unwrap);
      toast.success("Props saved.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset disabled={!canEdit} className="space-y-6">
      <Card title="Props" description="What comes with the place, and what the host can provide for an extra price.">
        <PropsEditor rows={rows} onChange={setRows} />
      </Card>
      <SaveBar dirty={dirty} busy={busy} onSave={save} onReset={() => setRows(initialRows)} />
    </fieldset>
  );
}

function PublishTab({
  location,
  checklist,
  canEdit,
  onTab,
  onChanged,
}: {
  location: LocationDetail;
  checklist: { key: string; label: string; done: boolean; tab: Tab }[];
  canEdit: boolean;
  onTab: (tab: Tab) => void;
  onChanged: () => void;
}) {
  const [confirm, setConfirm] = useState<"publish" | "unpublish" | null>(null);
  const [busy, setBusy] = useState(false);
  const missing = checklist.filter((c) => !c.done);
  const published = location.status === "published";
  const inReview = location.status === "submitted" || location.status === "under_review";

  async function run() {
    setBusy(true);
    try {
      if (confirm === "publish" && inReview) {
        await adminApi.POST("/locations/{id}/approve", { params: { path: { id: location.id } }, body: {} }).then(unwrap);
      } else {
        await listingApi.setStatus(location.id, confirm === "publish" ? "published" : "draft");
      }
      toast.success(confirm === "publish" ? "Listing is live." : "Listing moved back to draft.");
      setConfirm(null);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change the status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card
        className="lg:col-span-2"
        title="Ready to go live?"
        description="Listings that tick every box get far more bookings. You can publish without them, though."
      >
        <ul className="divide-y divide-slate-100">
          {checklist.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-3 py-2.5">
              <span className="flex items-center gap-2.5 text-sm">
                {item.done ? (
                  <CheckCircle2 aria-hidden className="h-5 w-5 text-green-600" />
                ) : (
                  <Circle aria-hidden className="h-5 w-5 text-slate-300" />
                )}
                <span className={item.done ? "text-slate-700" : "text-slate-900"}>
                  {item.label}
                  <span className="sr-only">{item.done ? " — done" : " — to do"}</span>
                </span>
              </span>
              {!item.done && (
                <Button size="sm" variant="ghost" onClick={() => onTab(item.tab)}>
                  Fix
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Status">
        <div className="mb-4">
          <StatusBadge status={location.status} />
          <p className="mt-2 text-sm text-slate-600">
            {published ? "Live: bookers can find and book it." : inReview ? "The host submitted it for review." : "Not visible to bookers yet."}
          </p>
        </div>
        {canEdit &&
          (published ? (
            <Button variant="danger" onClick={() => setConfirm("unpublish")}>
              Unpublish to draft
            </Button>
          ) : location.status === "suspended" ? (
            <p className="text-sm text-slate-600">
              Suspended listings are restored from the{" "}
              <Link href={`/locations/${location.id}`} className="underline">
                moderation page
              </Link>
              .
            </p>
          ) : (
            <Button variant="brand" onClick={() => setConfirm("publish")}>
              {inReview ? "Approve & publish" : "Publish now"}
            </Button>
          ))}
      </Card>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === "publish" ? "Publish this listing?" : "Unpublish this listing?"}
        description={
          confirm === "publish"
            ? missing.length > 0
              ? `${missing.length} checklist item(s) are still open. It will go live anyway.`
              : "It becomes visible and bookable straight away."
            : "It disappears from search. Existing bookings are not affected."
        }
        danger={confirm === "unpublish"}
        busy={busy}
        confirmLabel={confirm === "publish" ? "Publish" : "Unpublish"}
        onConfirm={run}
      />
    </div>
  );
}
