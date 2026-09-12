"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Bookmark, Check, CircleHelp, Home, ListChecks, RefreshCw, Search, Share2, ShieldCheck, Target, TriangleAlert, X } from "lucide-react";
import { FormEvent, useState } from "react";
import pathwayConfig from "@/config/pathways.json";
import type { Pathway } from "@/lib/types";
import { useApp } from "./app-provider";
import { CourseDetail, CoursePicker } from "./course-dialogs";
import { OfficialLink, dateLabel } from "./ui";

const navigation = [
  { href: "/", label: "Degree Overview", icon: Home, short: "Overview" },
  { href: "/courses", label: "Course Catalog", icon: BookOpen, short: "Catalog" },
  { href: "/planner", label: "Plan Builder", icon: ListChecks, short: "Plan" },
  { href: "/map", label: "Prerequisite Graph", icon: Share2, short: "Graph" },
  { href: "/pathways", label: "Suggested Pathways", icon: Bookmark, short: "Pathways" },
];

const pathways = pathwayConfig as Pathway[];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const app = useApp();
  const [query, setQuery] = useState("");
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
    router.push(`/courses?q=${encodeURIComponent(trimmed)}`);
  };
  return <div className="app-shell">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <aside className="sidebar">
      <Link className="brand" href="/" aria-label="NEU MSCS Course Planner home"><span className="brand-mark">NEU MSCS</span><span className="brand-name">Course Planner</span></Link>
      <nav aria-label="Main navigation" className="main-nav">{navigation.map(({ href, label, short, icon: Icon }) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={pathname === href ? "nav-link active" : "nav-link"}><Icon size={18} strokeWidth={1.8} /><span className="nav-full">{label}</span><span className="nav-short">{short}</span></Link>)}</nav>
      <div className="sidebar-bottom">
        <p className="sidebar-tagline">Plan smarter.<br />Build what’s next.</p>
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
          <div className="target-control">
            <Target size={16} aria-hidden="true" />
            <label>My Target
              <select aria-label="Career target" value={app.careerTargetId ?? ""} onChange={(event) => app.setCareerTargetId(event.target.value || null)}>
                <option value="">Choose a direction</option>
                {pathways.map((pathway) => <option key={pathway.id} value={pathway.id}>{pathway.name}</option>)}
              </select>
            </label>
            <Link href="/pathways">{selectedTarget ? "View" : "Pathways"}</Link>
          </div>
          <details className="profile-menu">
            <summary aria-label="Local plan menu"><span className="avatar">LP</span><span>Local plan<small>This device</small></span></summary>
            <div className="profile-dropdown">
              <button type="button" disabled={app.catalogBusy} onClick={() => void app.refreshCatalog()}><RefreshCw size={14} className={app.catalogBusy ? "spin" : ""} />{app.catalogBusy ? "Loading…" : "Refresh catalog"}</button>
              <button type="button" onClick={app.resetPlan}>Reset local plan</button>
              {app.catalog && <OfficialLink href={app.catalog.requirements.officialUrl} sources={app.catalog.sources}>Official catalog</OfficialLink>}
              <span className="muted">{app.catalog ? `${app.catalog.requirements.catalogYear} · refreshed ${dateLabel(app.catalog.lastUpdated)}` : "Catalog not loaded"}</span>
            </div>
          </details>
        </div>
      </header>
      {(app.catalogError || app.catalogMessage) && <div className={`global-banner ${app.catalogError ? "warning" : "success"}`} role={app.catalogError ? "alert" : "status"}>{app.catalogError ? <TriangleAlert size={16} /> : <Check size={16} />}<span>{app.catalogError}{app.catalogError && app.catalog ? " Your last loaded catalog is still available." : ""}{app.catalogMessage}</span></div>}
      {app.storageError && <div className="global-banner warning" role="alert"><TriangleAlert size={17} /><span><strong>Changes are not being saved.</strong> {app.storageError} {app.persistence === "blocked" ? "The original saved data is preserved. Explicitly reset the plan to replace it and enable saving." : "Your current work remains in this tab. Retry saving before closing it."}</span>{app.persistence === "blocked" ? <button className="text-button" onClick={app.resetPlan}>Reset saved plan</button> : <button className="text-button" onClick={app.retrySave}>Retry save</button>}</div>}
      <main id="main-content" className="main-content">{children}</main>
      <footer className="workspace-footer"><span><CircleHelp size={14} /> A planning companion, not an official degree audit.</span><span>Saved only on this device.</span></footer>
    </div>
    {app.detailCode && <CourseDetail key={app.detailCode} code={app.detailCode} />}
    {app.picker && <CoursePicker />}
    <div className="announcement" role="status" aria-live="polite">{app.notice && <><Check size={16} /><span>{app.notice}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => app.announce("")}><X size={15} /></button></>}</div>
  </div>;
}
