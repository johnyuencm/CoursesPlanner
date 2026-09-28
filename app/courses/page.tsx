"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowDownWideNarrow, ChevronRight, Filter, Search, X } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { CatalogState } from "@/components/catalog-state";
import { CourseCard } from "@/components/course-card";
import { EmptyState, LoadingState, PageHeading } from "@/components/ui";
import { catalogTakeStatus, DEFAULT_CATALOG_FILTERS, filterCatalogCourses } from "@/lib/catalog-view";
import { routes } from "@/lib/routes";

const topics = ["Robotics", "AI / ML", "Systems", "Software Engineering", "Data", "Networks / Security"];
const unlockThresholds = [0, 1, 2, 3, 4, 5];

function Explorer() {
  const { catalog, plan } = useApp();
  const params = useSearchParams();
  const qParam = params.get("q") ?? "";
  const typeParam = params.get("type");
  const categoryParam = params.get("category");
  const [search, setSearch] = useState(qParam);
  const [type, setType] = useState(typeParam ?? "all");
  const [category, setCategory] = useState(categoryParam ?? "all");
  const [credits, setCredits] = useState("all");
  const [noPrereq, setNoPrereq] = useState(false);
  const [takeNow, setTakeNow] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [minUnlocks, setMinUnlocks] = useState<number | null>(null);
  const [topic, setTopic] = useState("all");
  const [sort, setSort] = useState("code");
  const [limit, setLimit] = useState(18);
  useEffect(() => { setSearch(qParam); }, [qParam]);
  useEffect(() => { if (typeParam) setType(typeParam); }, [typeParam]);
  useEffect(() => { if (categoryParam) { setCategory(categoryParam); setType((current) => typeParam ?? "breadth"); } }, [categoryParam, typeParam]);
  const filters = useMemo(() => ({
    ...DEFAULT_CATALOG_FILTERS,
    search,
    type,
    category,
    credits,
    topic,
    noPrereq,
    takeNow,
    blocked,
    minUnlocks,
  }), [search, type, category, credits, topic, noPrereq, takeNow, blocked, minUnlocks]);
  const courses = useMemo(() => {
    if (!catalog) return [];
    return filterCatalogCourses(catalog.courses, plan, filters).sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title)
        : sort === "credits"
          ? a.credits - b.credits || a.code.localeCompare(b.code)
          : sort === "unlocks"
            ? b.unlocks.length - a.unlocks.length || a.code.localeCompare(b.code, undefined, { numeric: true })
            : a.code.localeCompare(b.code, undefined, { numeric: true }),
    );
  }, [catalog, plan, filters, sort]);
  if (!catalog) return <CatalogState />;
  const catalogCourses = catalog.courses.filter((course) => course.requirementType !== "external");
  const takeNowCount = catalogCourses.filter((course) => catalogTakeStatus(course, plan) === "can-take-now").length;
  const blockedCount = catalogCourses.filter((course) => catalogTakeStatus(course, plan) === "blocked").length;
  const filterCount =
    Number(type !== "all") +
    Number(category !== "all") +
    Number(credits !== "all") +
    Number(noPrereq) +
    Number(takeNow) +
    Number(blocked) +
    Number(minUnlocks !== null) +
    Number(topic !== "all") +
    Number(!!search);
  const reset = () => {
    setSearch("");
    setType("all");
    setCategory("all");
    setCredits("all");
    setNoPrereq(false);
    setTakeNow(false);
    setBlocked(false);
    setMinUnlocks(null);
    setTopic("all");
    setLimit(18);
  };
  const toggleTakeNow = () => {
    setTakeNow((current) => {
      const next = !current;
      if (next) setBlocked(false);
      return next;
    });
    setLimit(18);
  };
  const toggleBlocked = () => {
    setBlocked((current) => {
      const next = !current;
      if (next) setTakeNow(false);
      return next;
    });
    setLimit(18);
  };
  const codeNeedle = search.trim().toUpperCase().replace(/\s+/g, "");
  const looksLikeCode = /^[A-Z]{2,}\d{3,4}[A-Z]?$/.test(codeNeedle);
  const knownCode = catalog.courses.some((course) => course.code.replace(/\s/g, "") === codeNeedle);
  return <>
    <PageHeading title="Courses" description="Official MSCS Seattle courses, ranked by what they require and what they unlock. Search a code, then open the dependency graph for that course." />
    <div className="page-with-rail">
      <div className="page-main">
        <section className="explorer-toolbar" aria-label="Course filters">
          <div className="explorer-search-row"><div className="search-field search-large"><Search size={18} /><input aria-label="Search courses by code, title, or keywords" type="search" placeholder="Search by course code, title, or keywords…" value={search} onChange={(event) => { setSearch(event.target.value); setLimit(18); }} />{search && <button className="icon-button" aria-label="Clear search" onClick={() => setSearch("")}><X size={16} /></button>}</div></div>
          <div className="topic-filter-row"><span className="small-text muted">Take status</span><div className="topic-pills pill-row">
            <button type="button" className={`topic-pill ${takeNow ? "selected" : ""}`} aria-pressed={takeNow} onClick={toggleTakeNow}>I can take now</button>
            <button type="button" className={`topic-pill ${blocked ? "selected" : ""}`} aria-pressed={blocked} onClick={toggleBlocked}>Blocked</button>
            <button type="button" className={`topic-pill ${noPrereq ? "selected" : ""}`} aria-pressed={noPrereq} onClick={() => { setNoPrereq((current) => !current); setLimit(18); }}>No prereqs</button>
          </div></div>
          <div className="topic-filter-row"><span className="small-text muted">Filter by category</span><div className="topic-pills pill-row">
            {[["all", "All"], ["core", "Core"], ["breadth", "Breadth"], ["elective", "Elective"]].map(([value, label]) => <button key={value} className={`topic-pill ${type === value ? "selected" : ""}`} aria-pressed={type === value} onClick={() => { setType(value); if (value !== "breadth") setCategory("all"); setLimit(18); }}>{label}</button>)}
            {topics.map((item) => <button key={item} className={`topic-pill ${topic === item ? "selected" : ""}`} aria-pressed={topic === item} onClick={() => { setTopic(topic === item ? "all" : item); setLimit(18); }}>{item}</button>)}
          </div></div>
          <div className="filter-bottom-row">
            <div className="switch-row">
              <label className="sort-select">Area <select aria-label="Breadth area" value={category} onChange={(event) => { setCategory(event.target.value); if (event.target.value !== "all") setType("breadth"); setLimit(18); }}><option value="all">All areas</option>{catalog.requirements.breadthRequirements.categories.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
              <label className="sort-select">Unlocks &gt; N <select aria-label="Minimum unlocks" value={minUnlocks === null ? "any" : String(minUnlocks)} onChange={(event) => { setMinUnlocks(event.target.value === "any" ? null : Number(event.target.value)); setLimit(18); }}><option value="any">Any</option>{unlockThresholds.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label className="sort-select">Credits <select value={credits} onChange={(event) => { setCredits(event.target.value); setLimit(18); }}><option value="all">Any credits</option>{Array.from(new Set(catalog.courses.flatMap((course) => [course.credits, course.maxCredits ?? course.credits]))).sort((a, b) => a - b).map((value) => <option key={value} value={value}>{value} credits</option>)}<option value="variable">Variable credits</option></select></label>
            </div>
            <label className="sort-select"><ArrowDownWideNarrow size={16} /><span className="sr-only">Sort courses</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="code">Course code</option><option value="title">Course title</option><option value="credits">Credits, low to high</option><option value="unlocks">Unlocks, high to low</option></select></label>
            {filterCount > 0 && <button className="text-button" onClick={reset}><X size={14} /> Clear filters ({filterCount})</button>}
          </div>
        </section>
        <div className="results-heading"><p role="status"><strong>{courses.length}</strong> {courses.length === 1 ? "course" : "courses"}{type === "elective" && <span className="muted"> · Breadth counts here only when not used for breadth requirements.</span>}</p></div>
        {takeNow && <p className="eligibility-caption">I can take now uses completed and waived courses from your plan. Courses already on the plan are omitted. Offerings are not verified.</p>}
        {blocked && <p className="eligibility-caption">Blocked courses still need a prerequisite from your completed or waived history. Open details for the remaining chain.</p>}
        {courses.length ? <><div className="course-grid">{courses.slice(0, limit).map((course) => <CourseCard key={course.code} course={course} />)}</div>{courses.length > limit && <div className="load-more"><button className="button button-secondary" onClick={() => setLimit((current) => current + 18)}>Show more courses ({courses.length - limit} remaining)</button></div>}</> : <EmptyState icon={<Filter size={27} />} title={looksLikeCode && !knownCode ? `${search.trim().toUpperCase()} is not in this catalog.` : "A different search might open a door."} action={<button className="button button-secondary" onClick={reset}>Reset all filters</button>}>{looksLikeCode && !knownCode ? "This planner publishes official MSCS Seattle program courses plus the cataloged prerequisites they name. Undergraduate or other-campus listings are omitted." : "No courses match these filters. Try a broader interest, a different code, or fewer filters."}</EmptyState>}
        <p className="page-footnote">Prerequisite links are navigation aids, not a flattened checklist. Open course details for exact AND/OR rules, grade floors, corequisites, and uncertainties.</p>
      </div>
      <aside className="page-rail">
        <section className="rail-card">
          <h2>Prerequisite status</h2>
          <div className="availability-pair"><div className="availability-stat eligible"><strong>{takeNowCount}</strong><span>I can take now</span></div><div className="availability-stat locked"><strong>{blockedCount}</strong><span>Blocked</span></div></div>
          <p>Based on completed and waived courses in your plan. Offerings are not verified.</p>
        </section>
        <section className="rail-card">
          <h3>Filter legend</h3>
          <div className="filter-legend"><div><span className="badge badge-core">Core</span> Required for the degree</div><div><span className="badge badge-breadth">Breadth</span> Satisfies a breadth area</div><div><span className="badge badge-elective">Elective</span> Counts as elective credit</div>{topics.map((item) => <div key={item}><span className="topic-chip">{item}</span> Catalog topic tag</div>)}</div>
        </section>
        <section className="rail-card">
          <h3>Popular searches</h3>
          {topics.map((item) => <button className="popular-search" key={item} onClick={() => { setSearch(item); setLimit(18); }}>{item}<ChevronRight size={14} /></button>)}
        </section>
        <section className="rail-card">
          <h3>Not sure what to take?</h3>
          <p>Open the course map to see what each course unlocks, or browse recommended paths. Neither is a degree audit.</p>
          <Link className="text-link" href={routes.explore}>Explore the course map</Link>
          <Link className="text-link" href={routes.paths}>View suggested paths</Link>
        </section>
      </aside>
    </div>
  </>;
}

export default function ExplorerPage() { return <Suspense fallback={<LoadingState />}><Explorer /></Suspense>; }
