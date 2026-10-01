"use client";

import { BookOpen, RefreshCw } from "lucide-react";
import { useApp } from "./app-provider";
import { EmptyState, LoadingState } from "./ui";

export function CatalogState() {
  const { catalogBusy, refreshAvailable, refreshCatalog } = useApp();
  return catalogBusy ? <LoadingState /> : <EmptyState icon={<BookOpen size={25} />} title="The catalog isn’t ready yet" action={refreshAvailable ? <button className="button button-primary" onClick={() => void refreshCatalog()}><RefreshCw size={16} /> Load official catalog</button> : undefined}>{refreshAvailable ? "No course information has been invented. Load the official catalog to explore the course map." : "No course information has been invented. Catalog loading is not available on this deployment."}</EmptyState>;
}
