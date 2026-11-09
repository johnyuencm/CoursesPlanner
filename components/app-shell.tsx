"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Bookmark, Check, CircleHelp, ListChecks, RefreshCw, Search, Share2, ShieldCheck, TriangleAlert, X, type LucideIcon } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import pathwayConfig from "@/config/pathways.json";
import { primaryNav } from "@/lib/routes";
import { PERSONA_PROMPT } from "@/lib/pathway-overlay";
import type { Pathway } from "@/lib/types";
import { useApp, useRoutes, type Notice } from "./app-provider";
import { CourseDetail, CoursePicker } from "./course-dialogs";
import { CourseTargetControl } from "./target-path";
import { OfficialLink, dateLabel } from "./ui";

const navIcons: Record<ReturnType<typeof primaryNav>[number]["label"], LucideIcon> = {
  Explore: Share2,
  Plan: ListChecks,
  Courses: BookOpen,
  Paths: Bookmark,
};

const pathways = pathwayConfig as Pathway[];

/** `university` and `program` come from the snapshot (server layout), so the first HTML names them. */
export function AppShell({ university, program, children }: { university: string; program: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const app = useApp();
  const routes = useRoutes();
  const [query, setQuery] = useState("");
  const menuRef = useRef<HTMLDetailsElement>(null);
  // The plan menu closes on an outside click, like every other menu.
  useEffect(() => {
    const close = (event: PointerEvent) => { if (menuRef.current?.open && !menuRef.current.contains(event.target as Node)) menuRef.current.open = false; };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const selectedTarget = pathways.find((pathway) => pathway.id === app.careerTargetId);
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    const compact = trimmed.toUpperCase().replace(/\s+/g, "");
    const match = app.catalog?.courses.find((course) => course.code.replace(/\s/g, "") === compact);
    if (match) {
      app.openCourse(match.code);
      return;
    }
    // A new search on Courses replaces the entry, so Back does not walk through every search.
    const href = `${routes.courses}?q=${encodeURIComponent(trimmed)}`;
    if (pathname === routes.courses) router.replace(href);
    else router.push(href);
  };
  return <div className="app-shell">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <aside className="sidebar">
      <Link className="brand" href={routes.explore} aria-label={`Course Map: ${university} ${program}`}><span className="brand-mark">Course Map</span><span className="brand-name">{university}</span><span className="brand-program">{program}</span></Link>
      <nav aria-label="Main navigation" className="main-nav">{primaryNav(routes).map(({ href, label }) => {
        const Icon = navIcons[label];
        return <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={pathname === href ? "nav-link active" : "nav-link"}><Icon size={18} strokeWidth={1.8} /><span className="nav-full">{label}</span><span className="nav-short">{label}</span></Link>;
      })}</nav>
      <div className="sidebar-bottom">
        <p className="sidebar-tagline">Understand what every course unlocks.</p>
        <Link className="sidebar-status-link" href={routes.overview}>Status overview</Link>
        <Link className="sidebar-status-link" href="/">Change college or program</Link>
        <span className="sidebar-underline" aria-hidden="true" />
        <svg className="sidebar-mountains" viewBox="0 0 220 54" aria-hidden="true"><path d="M0 54 38 26 72 44 112 14 148 36 220 8v46Z" fill="currentColor" /></svg>
        <div className="local-note"><ShieldCheck size={13} /> Private by design. Saved on this device.</div>
      </div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <form className="top-search" onSubmit={submitSearch} role="search">
          <Search size={16} />
          <input aria-label="Search courses, topics, or keywords" type="search" placeholder="Search courses, topics, or keywords…" value={query} onChange={(event) => setQuery(event.target.value)} />
        </form>
        <div className="top-utilities">
          <CourseTargetControl />
          <div className="target-control path-direction">
            <label>Become
              <select aria-label={PERSONA_PROMPT} value={app.careerTargetId ?? ""} onChange={(event) => app.setCareerTargetId(event.target.value || null)}>
                <option value="">Choose a persona</option>
                {pathways.map((pathway) => <option key={pathway.id} value={pathway.id}>{pathway.name}</option>)}
              </select>
            </label>
            <Link href={routes.paths}>{selectedTarget ? "View" : "Paths"}</Link>
          </div>
          <details className="profile-menu" ref={menuRef} onKeyDown={(event) => { if (event.key === "Escape" && menuRef.current?.open) { menuRef.current.open = false; menuRef.current.querySelector("summary")?.focus(); } }} onClick={(event) => { if ((event.target as HTMLElement).closest(".profile-dropdown a, .profile-dropdown button") && menuRef.current) menuRef.current.open = false; }}>
            <summary aria-label="Local plan menu"><span className="avatar">LP</span><span>Local plan<small>This device</small></span></summary>
            <div className="profile-dropdown">
              {app.refreshAvailable && <button type="button" disabled={app.catalogBusy} onClick={() => void app.refreshCatalog()}><RefreshCw size={14} className={app.catalogBusy ? "spin" : ""} />{app.catalogBusy ? "Loading…" : "Refresh catalog"}</button>}
              <Link href="/">Change college or program</Link>
              <button type="button" onClick={app.resetPlan}>Reset local plan</button>
              {app.catalog && <OfficialLink href={app.catalog.requirements.officialUrl} sources={app.catalog.sources}>Official catalog</OfficialLink>}
              {app.catalog && <span className="muted">{app.catalog.requirements.catalogYear} catalog, refreshed {dateLabel(app.catalog.lastUpdated)}</span>}
            </div>
          </details>
        </div>
      </header>
      {/* Without a catalog, the page shows the load error in place (CatalogState). The banner covers a failed refresh only. */}
      {((app.catalogError && app.catalog) || app.catalogMessage) && <div className={`global-banner ${app.catalogError ? "warning" : "success"}`} role={app.catalogError ? "alert" : "status"}>{app.catalogError ? <TriangleAlert size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}<span>{app.catalogError ? `${app.catalogError} The last loaded catalog is still in use.` : app.catalogMessage}</span></div>}
      {app.storageError && <div className="global-banner warning" role="alert"><TriangleAlert size={17} /><span><strong>Changes are not being saved.</strong> {app.storageError} {app.persistence === "blocked" ? "The saved data is kept as it is. Reset the plan to replace it and turn saving back on. You can undo the reset." : "Your current work remains in this tab. Retry saving before closing it."}</span>{app.persistence === "blocked" ? <button className="text-button" onClick={app.resetPlan}>Reset saved plan</button> : <button className="text-button" onClick={app.retrySave}>Retry save</button>}</div>}
      <main id="main-content" className="main-content"><div key={pathname} className="route-view">{children}</div></main>
      <footer className="workspace-footer"><span><CircleHelp size={14} /> Understand what every course unlocks. A planning companion, not an official degree audit.</span><span>Saved only on this device.</span></footer>
    </div>
    {app.detailCode && <CourseDetail key={app.detailCode} code={app.detailCode} />}
    {app.picker && <CoursePicker />}
    <Toast notice={app.notice} dismiss={() => app.announce("")} />
  </div>;
}

/** The one toast. It replaces the previous toast, hides after 6 s (10 s with an action) and waits while hovered or focused. */
function Toast({ notice, dismiss }: { notice: Notice | null; dismiss: () => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!notice || paused) return;
    const timer = window.setTimeout(dismiss, notice.action ? 10_000 : 6_000);
    return () => window.clearTimeout(timer);
  }, [notice, paused, dismiss]);
  useEffect(() => setPaused(false), [notice?.id]);
  const warning = notice?.tone === "warning";
  return <div className="announcement" role="status" aria-live="polite" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
    {notice && <div key={notice.id} className={warning ? "toast toast-warning" : "toast"}>
      {warning ? <TriangleAlert size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
      <span>{notice.message}</span>
      {notice.action && <button type="button" className="toast-action" onClick={() => { notice.action?.run(); }}>{notice.action.label}</button>}
      <button type="button" className="icon-button" aria-label="Dismiss notification" onClick={dismiss}><X size={15} /></button>
    </div>}
  </div>;
}
