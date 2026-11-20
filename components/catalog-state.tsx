"use client";

import { BookOpen, RefreshCw } from "lucide-react";
import { useApp } from "./app-provider";
import { EmptyState, LoadingState } from "./ui";

/**
 * `quiet`: render nothing while the catalog loads. Use it only when the server-rendered content below is enough until the catalog loads.
 * Do not use it when this view is the main tool of the page (the map, the planner board): that page shows the loading state (#140).
 */
export function CatalogState({ quiet = false }: { quiet?: boolean }) {
  const { catalogBusy, reloadCatalog } = useApp();
  if (catalogBusy && quiet) return null;
  if (catalogBusy) return <LoadingState />;
  const retry = () => {
    // Try again goes away while the catalog loads again. If the page has a heading, focus moves there, because the heading stays (#145).
    // shortcut: Explore and Courses have no `main h1` while the catalog is missing, so there focus still drops to the body; give them a focus target in https://github.com/johnyuencm/CoursesPlanner/issues/149.
    const heading = document.querySelector<HTMLElement>("main h1");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus();
    }
    void reloadCatalog();
  };
  // Plain words only: the provider sends the raw error to the console (#145).
  // One sentence for a lost connection and for a server error. Keep it on one line at 360 px, or the card grows past 15rem (globals.css).
  return <EmptyState role="alert" icon={<BookOpen size={25} />} title="The course catalog did not load" action={<button className="button button-primary" onClick={retry}><RefreshCw size={16} aria-hidden="true" /> Try again</button>}>Check your connection, or try later.</EmptyState>;
}
