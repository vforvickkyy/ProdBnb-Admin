"use client";

import useSWR from "swr";
import { adminApi, unwrap } from "@/lib/api";
import type { components } from "@/types/admin-api";

type CatalogItem = components["schemas"]["AdminCatalogItem"];
export type CatalogKind = "categories" | "amenities" | "use-cases";

export function useCatalogOptions(kind: CatalogKind) {
  const { data, error, isLoading, mutate } = useSWR(`/v1/admin/catalog/${kind}`, () =>
    adminApi.GET("/catalog/{kind}", { params: { path: { kind } } }).then(unwrap<CatalogItem[]>),
  );
  return { items: data ?? [], error, isLoading, mutate };
}
