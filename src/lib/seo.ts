"use client";

import useSWR from "swr";
import { API_BASE_URL, BRAND_NAME } from "@/lib/config";

/**
 * SEO helpers shared by Website → SEO, Website → Pages and the listing editor's SEO tab.
 *
 * The "automatic" values below mirror what the website writes when no override is set, so the
 * preview an admin sees matches the real search result. Keep them in step with the website's
 * src/lib/seo.ts.
 */

/** Roughly what Google shows before cutting off. Longer is allowed, just truncated in results. */
export const TITLE_LIMIT = 60;
export const DESCRIPTION_LIMIT = 155;

export type SeoEntityType = "page" | "location" | "collection" | "use_case" | "category";

export interface SeoValues {
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  noindex: boolean;
}

/** Same rules as the website's slugify (used for addresses like /shoots/music-video). */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export function snippet(text: string, max = DESCRIPTION_LIMIT): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

/** The website's title template: "<page> · <brand>". An override replaces the whole title. */
export function withBrand(title: string): string {
  return `${title} · ${BRAND_NAME}`;
}

export function locationPath(listing: { id: string; title: string; city?: string | null }): string {
  const words = slugify([listing.title, listing.city].filter(Boolean).join(" "));
  return `/locations/${words ? `${words}-${listing.id}` : listing.id}`;
}

export function fillTokens(text: string, supportEmail = "support@example.com"): string {
  return text.replaceAll("{{brand}}", BRAND_NAME).replaceAll("{{support_email}}", supportEmail);
}

/** Built-in website pages that take SEO overrides (editable text pages are added from the API). */
const BRAND_DESCRIPTION =
  "Book homes, rooftops, studios, cafés and heritage spaces for film, photo and ad shoots. Browse real locations, see prices up front and book directly with the host.";

export const BUILT_IN_PAGES: { key: string; label: string; path: string; title: string; description: string }[] = [
  {
    key: "home",
    label: "Home page",
    path: "/",
    title: `${BRAND_NAME} · Find the perfect location for your next shoot`,
    description: BRAND_DESCRIPTION,
  },
  {
    key: "host",
    label: "List your location",
    path: "/host",
    title: withBrand("List your location for shoots"),
    description: `Earn from your home, rooftop, café or studio by hosting film, photo and ad shoots on ${BRAND_NAME}. You set the price, the hours and the rules.`,
  },
  {
    key: "shoots",
    label: "Shoot types (all)",
    path: "/shoots",
    title: withBrand("Locations for every kind of shoot"),
    description: `Music videos, ads, films, photo shoots and more — browse shoot locations by what you're making on ${BRAND_NAME}.`,
  },
];

/** Mirrors the website's automatic listing description. */
export function autoListingDescription(listing: {
  description: string;
  city: string;
  region?: string | null;
  capacity?: number | null;
}): string {
  if (listing.description.trim()) return snippet(listing.description);
  const where = [listing.city, listing.region].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", ");
  const crew = listing.capacity ? `, for up to ${listing.capacity} people` : "";
  return snippet(`A shoot location${where ? ` in ${where}` : ""}${crew}. Book on ${BRAND_NAME}.`);
}

export function autoListingTitle(listing: { title: string; city: string }): string {
  return withBrand(listing.city ? `${listing.title}, ${listing.city}` : listing.title);
}

export function autoCollectionDescription(collection: { title: string; description: string; listing_count: number }): string {
  return snippet(collection.description || `${collection.listing_count} hand-picked shoot locations: ${collection.title}. Book on ${BRAND_NAME}.`);
}

/** Shoot-type (use case) landing pages on the website: /shoots/<slug>. */
export function shootTitle(name: string): string {
  return `${name} shoot locations`;
}

export function autoShootDescription(useCase: { name: string; description: string | null }): string {
  return snippet(
    useCase.description?.trim() ||
      `Find locations for ${useCase.name.toLowerCase()} shoots — homes, studios and unique spaces with prices up front. Book on ${BRAND_NAME}.`,
  );
}

interface PublicSiteConfig {
  site: { primary_domain: string | null; url: string | null };
}

/** The website's public address (primary domain), for previews and "view on site" links. */
export function useSiteUrl(): string | null {
  const { data } = useSWR(API_BASE_URL ? `${API_BASE_URL}/v1/site-config` : null, (url: string) =>
    fetch(url).then(async (r) => ((await r.json()) as { data: PublicSiteConfig }).data),
  );
  return data?.site.url ?? null;
}
