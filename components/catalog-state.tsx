"use client";

import { BookOpen, RefreshCw } from "lucide-react";
import { useApp } from "./app-provider";
import { EmptyState, LoadingState } from "./ui";

/**
 * `quiet`: render nothing while the catalog loads. Use it only when the server-rendered content below is enough until the catalog loads.
 * Do not use it when this view is the main tool of the page (the map, the planner board): that page shows the loading state (#140).
 */
export function CatalogState({ quiet = false }: { quiet?: boolean }) {
  const { catalogBusy, catalogError, reloadCatalog } = useApp();
  if (catalogBusy && quiet) return null;
  return catalogBusy ? <LoadingState /> : <EmptyState icon={<BookOpen size={25} />} title="The course catalog did not load" action={<button className="button button-primary" onClick={() => void reloadCatalog()}><RefreshCw size={16} aria-hidden="true" /> Try again</button>}>{catalogError ? `${catalogError} ` : ""}Check your connection, then try again. The map shows only official catalog data, so nothing appears until it loads.</EmptyState>;
}
