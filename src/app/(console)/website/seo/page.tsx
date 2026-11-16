"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { ImageIcon } from "lucide-react";
import { SeoEditor, type SeoAuto } from "@/components/website/SeoEditor";
import type { SitePage } from "@/components/website/pages";
import { useCatalogOptions } from "@/components/listing/useCatalogOptions";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { adminApi, unwrap, unwrapPaginated } from "@/lib/api";
import { useRouter } from "@/lib/navigation";
import {
  autoCollectionDescription,
  autoListingDescription,
  autoListingTitle,
  autoShootDescription,
  BUILT_IN_PAGES,
  locationPath,
  type SeoEntityType,
  type SeoValues,
  shootTitle,
  slugify,
  snippet,
  withBrand,
} from "@/lib/seo";
import { useAdminMe } from "@/lib/useAdminMe";
import type { components } from "@/types/admin-api";

type Tab = "pages" | "listings" | "collections" | "shoots";
const TABS: Tab[] = ["pages", "listings", "collections", "shoots"];
type Override = SeoValues & { entity_type: SeoEntityType; entity_key: string };
type Listing = components["schemas"]["AdminLocationListItem"];
type Collection = components["schemas"]["CollectionSummary"];

interface Row {
  key: string;
  label: string;
  sublabel?: string;
  image?: string | null;
  auto: SeoAuto;
}

interface Editing {
  type: SeoEntityType;
  row: Row;
}

function useOverrides(type: SeoEntityType) {
  return useSWR(`/v1/admin/site/seo?type=${type}`, () =>
    adminApi.GET("/site/seo", { params: { query: { type } } }).then(unwrap<Override[]>),
  );
}

function StatusBadges({ override }: { override?: Override }) {
  if (!override) return <Badge>Automatic</Badge>;
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {(override.meta_title || override.meta_description || override.og_image_url) && <Badge tone="info">Custom</Badge>}
      {override.noindex && <Badge tone="warning">Hidden from search</Badge>}
    </div>
  );
}

function RowList({
  rows,
  overrides,
  onOpen,
  thumbnails,
}: {
  rows: Row[];
  overrides: Map<string, Override>;
  onOpen: (row: Row) => void;
  thumbnails?: boolean;
}) {
  return (
    <ul className="-my-2 divide-y divide-slate-200">
      {rows.map((row) => {
        const override = overrides.get(row.key);
        const title = override?.meta_title || row.auto.title;
        const description = override?.meta_description || row.auto.description;
        return (
          <li key={row.key}>
            <button
              type="button"
              onClick={() => onOpen(row)}
              className="flex w-full items-center gap-3 rounded-md py-3 text-left hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
            >
              {thumbnails && (
                <span className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100">
                  {row.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon aria-hidden className="h-4 w-4 text-slate-400" />
                  )}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-900">{row.label}</span>
                <span className="block truncate text-xs text-slate-500">{title}</span>
                <span className="hidden truncate text-xs text-slate-400 sm:block">{snippet(description, 120)}</span>
              </span>
              <StatusBadges override={override} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function PagesTab({ onOpen }: { onOpen: (e: Editing) => void }) {
  const overrides = useOverrides("page");
  const pages = useSWR("/v1/admin/site/pages", () => adminApi.GET("/site/pages").then(unwrap<SitePage[]>));
  const map = useMemo(() => new Map((overrides.data ?? []).map((o) => [o.entity_key, o])), [overrides.data]);
  if (overrides.isLoading || pages.isLoading) return <Skeleton className="h-72 w-full rounded-xl" />;
  if (overrides.error || pages.error)
    return <ErrorState message={extractErrorMessage(overrides.error ?? pages.error, "Failed to load.")} onRetry={() => void pages.mutate()} />;
  const rows: Row[] = [
    ...BUILT_IN_PAGES.map((p) => ({ key: p.key, label: p.label, sublabel: p.path, auto: { title: p.title, description: p.description, path: p.path } })),
    ...(pages.data ?? []).map((p) => ({
      key: p.slug,
      label: p.title,
      sublabel: `/${p.slug}`,
      auto: { title: withBrand(p.title), description: p.title, path: `/${p.slug}` },
    })),
  ];
  return (
    <Card title="Website pages" description="The home page, the hosting page and every page from Website → Pages.">
      <RowList rows={rows} overrides={map} onOpen={(row) => onOpen({ type: "page", row })} />
    </Card>
  );
}

function ListingsTab({ onOpen }: { onOpen: (e: Editing) => void }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const overrides = useOverrides("location");
  const listings = useSWR(["/v1/admin/locations", "published", search, page], () =>
    adminApi
      .GET("/locations", { params: { query: { status: "published", search: search || undefined, page, pageSize: 20 } } })
      .then(unwrapPaginated<Listing>),
  );
  const map = useMemo(() => new Map((overrides.data ?? []).map((o) => [o.entity_key, o])), [overrides.data]);
  const rows: Row[] = (listings.data?.data ?? []).map((l) => ({
    key: l.id,
    label: l.title,
    image: l.cover_url,
    auto: { title: autoListingTitle(l), description: autoListingDescription(l), path: locationPath(l), image: l.cover_url },
  }));
  return (
    <Card
      title="Live listings"
      description="Each listing's page is written from its title, city and description. Override it for your most important listings."
      actions={
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search listings"
          label="Search listings"
        />
      }
    >
      {listings.isLoading || overrides.isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : listings.error ? (
        <ErrorState message={extractErrorMessage(listings.error, "Failed to load listings.")} onRetry={() => void listings.mutate()} />
      ) : rows.length === 0 ? (
        <EmptyState title="No live listings" description={search ? "Nothing matches that search." : "Published listings appear here."} />
      ) : (
        <>
          <RowList rows={rows} overrides={map} onOpen={(row) => onOpen({ type: "location", row })} thumbnails />
          <div className="mt-4">
            <Pagination page={page} pageSize={20} total={listings.data?.meta.total ?? 0} onPageChange={setPage} />
          </div>
        </>
      )}
    </Card>
  );
}

function CollectionsTab({ onOpen }: { onOpen: (e: Editing) => void }) {
  const overrides = useOverrides("collection");
  const collections = useSWR("/v1/admin/collections", () => adminApi.GET("/collections").then(unwrap<Collection[]>));
  const map = useMemo(() => new Map((overrides.data ?? []).map((o) => [o.entity_key, o])), [overrides.data]);
  if (overrides.isLoading || collections.isLoading) return <Skeleton className="h-72 w-full rounded-xl" />;
  const rows: Row[] = (collections.data ?? [])
    .filter((c) => c.is_published)
    .map((c) => ({
      key: c.id,
      label: c.title,
      image: c.cover_url,
      auto: { title: withBrand(c.title), description: autoCollectionDescription(c), path: `/collections/${c.slug}`, image: c.cover_url },
    }));
  return (
    <Card title="Published collections">
      {rows.length === 0 ? (
        <EmptyState title="No published collections" />
      ) : (
        <RowList rows={rows} overrides={map} onOpen={(row) => onOpen({ type: "collection", row })} thumbnails />
      )}
    </Card>
  );
}

function ShootsTab({ onOpen }: { onOpen: (e: Editing) => void }) {
  const overrides = useOverrides("use_case");
  const useCases = useCatalogOptions("use-cases");
  const map = useMemo(() => new Map((overrides.data ?? []).map((o) => [o.entity_key, o])), [overrides.data]);
  if (overrides.isLoading || useCases.isLoading) return <Skeleton className="h-72 w-full rounded-xl" />;
  const rows: Row[] = useCases.items.map((u) => ({
    key: u.id,
    label: u.name,
    image: u.cover_url,
    auto: {
      title: withBrand(shootTitle(u.name)),
      description: autoShootDescription(u),
      path: `/shoots/${slugify(u.name)}`,
      image: u.cover_url,
    },
  }));
  return (
    <Card
      title="Shoot types"
      description="Each use case from Catalog has its own landing page (for example /shoots/music-video) and a tile on the home page, using its cover."
    >
      <RowList rows={rows} overrides={map} onOpen={(row) => onOpen({ type: "use_case", row })} thumbnails />
    </Card>
  );
}

const TAB_LABEL: Record<Tab, string> = { pages: "Pages", listings: "Listings", collections: "Collections", shoots: "Shoot types" };

function SeoScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const param = searchParams.get("tab") as Tab | null;
  const tab: Tab = param && TABS.includes(param) ? param : "pages";
  const { can } = useAdminMe();
  const canEdit = can("content.manage");
  const [editing, setEditing] = useState<Editing | null>(null);

  return (
    <>
      <PageHeader
        title="SEO"
        description="Search titles, descriptions and share images for the website. Everything is written automatically; set your own only where it helps. Changes reach the website within a few minutes."
      />
      <Tabs<Tab>
        label="SEO areas"
        value={tab}
        onChange={(next) => router.replace(`/website/seo?tab=${next}`, { scroll: false })}
        items={TABS.map((value) => ({ value, label: TAB_LABEL[value] }))}
      />
      <div className="mt-6">
        {tab === "pages" && <PagesTab onOpen={setEditing} />}
        {tab === "listings" && <ListingsTab onOpen={setEditing} />}
        {tab === "collections" && <CollectionsTab onOpen={setEditing} />}
        {tab === "shoots" && <ShootsTab onOpen={setEditing} />}
      </div>
      <Sheet
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing?.row.label ?? ""}
        description={editing?.row.auto.path}
        width="max-w-2xl"
      >
        {editing && <SeoEditor type={editing.type} entityKey={editing.row.key} auto={editing.row.auto} canEdit={canEdit} />}
      </Sheet>
    </>
  );
}

export default function SeoPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <SeoScreen />
    </Suspense>
  );
}
