"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "@/lib/navigation";
import { toast } from "sonner";
import { ArrowLeft, Check } from "lucide-react";
import { DetailsForm, detailsToBody, EMPTY_DETAILS, ListingDetails, validateDetails } from "@/components/listing/DetailsForm";
import { CustomPoints, GroupedChecks } from "@/components/listing/Features";
import { HostCandidate, HostPicker } from "@/components/listing/HostPicker";
import { PropRow, PropsEditor, propsToBody, validateProps } from "@/components/listing/PropsEditor";
import { useCatalogOptions } from "@/components/listing/useCatalogOptions";
import { Button } from "@/components/ui/Button";
import { Card, KeyValues } from "@/components/ui/Card";
import { ChipSelect } from "@/components/ui/ChipSelect";
import { PageHeader } from "@/components/ui/PageHeader";
import { Switch } from "@/components/ui/Switch";
import { adminApi, unwrap } from "@/lib/api";
import { cn } from "@/lib/cn";
import { personName } from "@/lib/format";
import { useAdminMe } from "@/lib/useAdminMe";
import type { components } from "@/types/admin-api";

type LocationDetail = components["schemas"]["LocationDetail"];

const STEPS = ["Host", "Basics", "Space", "Address", "Features", "Props", "Review"] as const;

/** The ticked list holds amenities and rules together; a toggle in one group leaves the other group alone. */
function mergeIds(all: string[], next: string[], kind: "amenity" | "rule", options: { id: string; kind?: "amenity" | "rule" }[]): string[] {
  const others = all.filter((id) => (options.find((o) => o.id === id)?.kind ?? "amenity") !== kind);
  return [...others, ...next.filter((id) => !others.includes(id))];
}

export default function NewListingPage() {
  const router = useRouter();
  const { can } = useAdminMe();
  const [step, setStep] = useState(0);
  const [host, setHost] = useState<HostCandidate | null>(null);
  const [grantHost, setGrantHost] = useState(false);
  const [details, setDetails] = useState<ListingDetails>(EMPTY_DETAILS);
  const [errors, setErrors] = useState<Partial<Record<keyof ListingDetails, string>>>({});
  const [tags, setTags] = useState({
    category_ids: [] as string[],
    amenity_ids: [] as string[],
    use_case_ids: [] as string[],
    custom_amenities: [] as string[],
    custom_rules: [] as string[],
  });
  const [props, setProps] = useState<PropRow[]>([]);
  const [busy, setBusy] = useState(false);
  const categories = useCatalogOptions("categories");
  const amenities = useCatalogOptions("amenities");
  const useCases = useCatalogOptions("use-cases");

  function next() {
    if (step === 0 && !host) {
      toast.error("Choose the host who will own this listing.");
      return;
    }
    if (step === 0 && host && !host.is_host && !grantHost) {
      toast.error("This person is not a host yet — tick “Make them a host” to continue.");
      return;
    }
    if (step === 1 || step === 2 || step === 3) {
      const found = validateDetails(details);
      const keysForStep: string[] =
        step === 1
          ? ["listing_code", "title", "capacity"]
          : step === 2
            ? ["area_sqft", "set_count", "parking_spaces", "restroom_count", "permission_details"]
            : ["city", "country", "latitude", "longitude"];
      const relevant = Object.fromEntries(Object.entries(found).filter(([k]) => keysForStep.includes(k)));
      setErrors(relevant);
      if (Object.keys(relevant).length > 0) return;
    }
    if (step === 5) {
      const problem = validateProps(props);
      if (problem) {
        toast.error(problem);
        return;
      }
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  async function create() {
    if (!host) return;
    setBusy(true);
    try {
      const created = await adminApi
        .POST("/locations", {
          body: {
            ...detailsToBody(details),
            ...tags,
            props: propsToBody(props),
            host_id: host.id,
            grant_host_role: !host.is_host && grantHost,
            status: "draft",
          } as never,
        })
        .then(unwrap<LocationDetail>);
      toast.success("Draft created. Add photos, pricing and timings, then publish.");
      router.push(`/locations/${created.id}/edit?tab=photos`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the listing.");
      setBusy(false);
    }
  }

  if (!can("locations.create")) {
    return (
      <>
        <PageHeader title="New listing" />
        <p className="text-sm text-slate-600">Your team role cannot create listings. Ask a super admin or moderator.</p>
      </>
    );
  }

  return (
    <>
      <Link href="/locations" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft aria-hidden className="h-4 w-4" /> Locations
      </Link>
      <PageHeader title="New listing" description="Create a listing on a host's behalf. It belongs to them, and they can manage it from their app." />

      <ol className="mb-6 flex flex-wrap items-center gap-2" aria-label="Steps">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              aria-current={i === step ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium transition-colors",
                i === step ? "bg-accent-500 text-snow" : i < step ? "bg-host-50 text-host-700 hover:bg-host-100" : "bg-slate-100 text-slate-500",
              )}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full text-xs">
                {i < step ? <Check aria-hidden className="h-3.5 w-3.5" /> : i + 1}
              </span>
              {label}
            </button>
            {i < STEPS.length - 1 && <span aria-hidden className="h-px w-4 bg-slate-300" />}
          </li>
        ))}
      </ol>

      <div className="max-w-3xl">
        {step === 0 && (
          <Card title="Who owns this listing?">
            <HostPicker value={host} onChange={setHost} />
            {host && !host.is_host && (
              <div className="mt-4 rounded-md bg-amber-50 p-3">
                <Switch
                  checked={grantHost}
                  onChange={setGrantHost}
                  label={`Make ${personName(host)} a host`}
                  description="They don't have the host role yet. It is granted when the listing is created, and recorded in the audit log."
                />
              </div>
            )}
          </Card>
        )}
        {step === 1 && (
          <Card title="Basics">
            <DetailsForm value={details} onChange={setDetails} errors={errors} sections={["basics"]} codeMode="new" />
          </Card>
        )}
        {step === 2 && (
          <Card title="Space details" description="Optional now — you can fill these in later.">
            <DetailsForm value={details} onChange={setDetails} errors={errors} sections={["space"]} />
          </Card>
        )}
        {step === 3 && (
          <Card title="Address & map">
            <DetailsForm value={details} onChange={setDetails} errors={errors} sections={["address"]} />
          </Card>
        )}
        {step === 4 && (
          <div className="space-y-6">
            <Card title="Categories & good for" description="Optional now — you can change these any time.">
              <div className="space-y-6">
                <ChipSelect
                  label="Categories"
                  options={categories.items}
                  selected={tags.category_ids}
                  max={20}
                  onChange={(ids) => setTags({ ...tags, category_ids: ids })}
                />
                <ChipSelect
                  label="Good for"
                  options={useCases.items}
                  selected={tags.use_case_ids}
                  max={10}
                  onChange={(ids) => setTags({ ...tags, use_case_ids: ids })}
                />
              </div>
            </Card>
            <Card title="Amenities">
              <div className="space-y-6">
                <GroupedChecks
                  label="Tick what applies"
                  options={amenities.items}
                  kind="amenity"
                  selected={tags.amenity_ids}
                  onChange={(ids) => setTags({ ...tags, amenity_ids: mergeIds(tags.amenity_ids, ids, "amenity", amenities.items) })}
                />
                <CustomPoints
                  label="Your own amenities"
                  placeholder="e.g. Rooftop water tank"
                  values={tags.custom_amenities}
                  onChange={(next) => setTags({ ...tags, custom_amenities: next })}
                />
              </div>
            </Card>
            <Card title="Location rules">
              <div className="space-y-6">
                <GroupedChecks
                  label="Allowed here"
                  options={amenities.items}
                  kind="rule"
                  selected={tags.amenity_ids}
                  onChange={(ids) => setTags({ ...tags, amenity_ids: mergeIds(tags.amenity_ids, ids, "rule", amenities.items) })}
                />
                <CustomPoints
                  label="Your own rules"
                  placeholder="e.g. No shoes inside the set"
                  values={tags.custom_rules}
                  onChange={(next) => setTags({ ...tags, custom_rules: next })}
                />
              </div>
            </Card>
          </div>
        )}
        {step === 5 && (
          <Card title="Props" description="Optional now — what comes with the place, and what the host can provide for a price.">
            <PropsEditor rows={props} onChange={setProps} />
          </Card>
        )}
        {step === 6 && host && (
          <Card title="Review" description="The listing is created as a draft. Next you'll add photos, pricing and opening hours, then publish.">
            <KeyValues
              items={[
                { label: "Host", value: `${personName(host)} (${host.email ?? "no email"})${!host.is_host ? " — will be made a host" : ""}` },
                { label: "Listing ID", value: details.listing_code ? details.listing_code.toUpperCase() : "Next automatic ID" },
                { label: "Title", value: details.title },
                { label: "Place", value: [details.city, details.region, details.country].filter(Boolean).join(", ") },
                { label: "Max crew size", value: details.capacity || "—" },
                {
                  label: "Space",
                  value:
                    [
                      details.area_sqft && `${details.area_sqft} sq ft`,
                      details.set_count && `${details.set_count} sets`,
                      details.parking_spaces && `${details.parking_spaces} parking`,
                      details.restroom_count && `${details.restroom_count} restrooms`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Not filled in",
                },
                { label: "Instant booking", value: details.instant_booking_enabled ? "On" : "Off" },
                { label: "Coordinates", value: details.latitude && details.longitude ? `${details.latitude}, ${details.longitude}` : "Not set" },
                {
                  label: "Tags",
                  value: `${tags.category_ids.length} categories · ${tags.amenity_ids.length} amenities & rules ticked · ${tags.custom_amenities.length + tags.custom_rules.length} written · ${tags.use_case_ids.length} use cases`,
                },
                { label: "Props", value: `${propsToBody(props).length} listed` },
              ]}
            />
          </Card>
        )}

        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" disabled={step === 0 || busy} onClick={() => setStep((s) => Math.max(0, s - 1))}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button variant="primary" onClick={next}>
              Continue
            </Button>
          ) : (
            <Button variant="brand" onClick={create} disabled={busy}>
              {busy ? "Creating…" : "Create draft listing"}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
