"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowDownWideNarrow, ChevronRight, Filter, Search, X } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { CatalogState } from "@/components/catalog-state";
import { CourseCard } from "@/components/course-card";
import { EmptyState, LoadingState, PageHeading } from "@/components/ui";
import { routes } from "@/lib/routes";
import { getEligibility } from "@/lib/validation";

const topics = ["Robotics", "AI / ML", "Systems", "Software Engineering", "Data", "Networks / Security"];

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
  const [eligible, setEligible] = useState(false);
  const [topic, setTopic] = useState("all");
  const [sort, setSort] = useState("code");
  const [limit, setLimit] = useState(18);
  useEffect(() => { setSearch(qParam); }, [qParam]);
  useEffect(() => { if (typeParam) setType(typeParam); }, [typeParam]);
  useEffect(() => { if (categoryParam) { setCategory(categoryParam); setType((current) => typeParam ?? "breadth"); } }, [categoryParam, typeParam]);
  const prior = useMemo(() => new Set([...plan.completedCourses, ...plan.waivedCourses]), [plan.completedCourses, plan.waivedCourses]);
  const courses = useMemo(() => {
    if (!catalog) return [];
    const normalized = search.toLowerCase().replace(/\s/g, "");
    return catalog.courses.filter((course) => {
      if (course.requirementType === "external" && !normalized) return false;
      const haystack = `${course.code} ${course.title} ${course.topics.join(" ")} ${course.description}`.toLowerCase().replace(/\s/g, "");
      if (normalized && !haystack.includes(normalized)) return false;
      if (type === "core" && course.requirementType !== "core") return false;
      if (type === "breadth" && course.breadthCategories.length === 0) return false;
      if (type === "elective" && !course.electiveEligible) return false;
      if (category !== "all" && !course.breadthCategories.includes(category)) return false;
      if (credits === "variable" && (course.maxCredits === undefined || course.maxCredits === course.credits)) return false;
      if (credits !== "all" && credits !== "variable" && (Number(credits) < course.credits || Number(credits) > (course.maxCredits ?? course.credits))) return false;
      if (noPrereq && course.prerequisites.type !== "none") return false;
      if (eligible && getEligibility(course, prior).status !== "eligible") return false;
      if (topic !== "all" && !course.topics.includes(topic)) return false;
      return true;
    }).sort((a, b) => sort === "title" ? a.title.localeCompare(b.title) : sort === "credits" ? a.credits - b.credits || a.code.localeCompare(b.code) : a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [catalog, search, type, category, credits, noPrereq, eligible, topic, prior, sort]);
  if (!catalog) return <CatalogState />;
  const catalogCourses = catalog.courses.filter((course) => course.requirementType !== "external");
  const eligibleCount = catalogCourses.filter((course) => getEligibility(course, prior).status === "eligible").length;
  const lockedCount = catalogCourses.length - eligibleCount;
  const filterCount = Number(type !== "all") + Number(category !== "all") + Number(credits !== "all") + Number(noPrereq) + Number(eligible) + Number(topic !== "all") + Number(!!search);
  const reset = () => { setSearch(""); setType("all"); setCategory("all"); setCredits("all"); setNoPrereq(false); setEligible(false); setTopic("all"); setLimit(18); };
  const codeNeedle = search.trim().toUpperCase().replace(/\s+/g, "");
  const looksLikeCode = /^[A-Z]{2,}\d{3,4}[A-Z]?$/.test(codeNeedle);
  const knownCode = catalog.courses.some((course) => course.code.replace(/\s/g, "") === codeNeedle);
  return <>
    <PageHeading title="Courses" description="Official MSCS Seattle courses. Search a code to see cataloged prerequisites and what those courses unlock." />
    <div className="page-with-rail">
      <div className="page-main">
        <section className="explorer-toolbar" aria-label="Course filters">
          <div className="explorer-search-row"><div className="search-field search-large"><Search size={18} /><input aria-label="Search courses by code, title, or keywords" type="search" placeholder="Search by course code, title, or keywords…" value={search} onChange={(event) => { setSearch(event.target.value); setLimit(18); }} />{search && <button className="icon-button" aria-label="Clear search" onClick={() => setSearch("")}><X size={16} /></button>}</div></div>
          <div className="topic-filter-row"><span className="small-text muted">Filter by category</span><div className="topic-pills pill-row">
            {[["all", "All"], ["core", "Core"], ["breadth", "Breadth"], ["elective", "Elective"]].map(([value, label]) => <button key={value} className={`topic-pill ${type === value ? "selected" : ""}`} aria-pressed={type === value} onClick={() => { setType(value); if (value !== "breadth") setCategory("all"); setLimit(18); }}>{label}</button>)}
            {topics.map((item) => <button key={item} className={`topic-pill ${topic === item ? "selected" : ""}`} aria-pressed={topic === item} onClick={() => { setTopic(topic === item ? "all" : item); setLimit(18); }}>{item}</button>)}
          </div></div>
          <div className="filter-bottom-row">
            <div className="switch-row">
              <label className="checkbox-label"><input type="checkbox" checked={noPrereq} onChange={(event) => setNoPrereq(event.target.checked)} /> No prerequisites</label>
              <label className="checkbox-label"><input type="checkbox" checked={eligible} onChange={(event) => setEligible(event.target.checked)} /> Prerequisite eligible</label>
              <label className="sort-select">Breadth area <select value={category} onChange={(event) => { setCategory(event.target.value); if (event.target.value !== "all") setType("breadth"); setLimit(18); }}><option value="all">All areas</option>{catalog.requirements.breadthRequirements.categories.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
              <label className="sort-select">Credits <select value={credits} onChange={(event) => { setCredits(event.target.value); setLimit(18); }}><option value="all">Any credits</option>{Array.from(new Set(catalog.courses.flatMap((course) => [course.credits, course.maxCredits ?? course.credits]))).sort((a, b) => a - b).map((value) => <option key={value} value={value}>{value} credits</option>)}<option value="variable">Variable credits</option></select></label>
            </div>
            <label className="sort-select"><ArrowDownWideNarrow size={16} /><span className="sr-only">Sort courses</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="code">Course code</option><option value="title">Course title</option><option value="credits">Credits, low to high</option></select></label>
            {filterCount > 0 && <button className="text-button" onClick={reset}><X size={14} /> Clear filters ({filterCount})</button>}
          </div>
        </section>
        <div className="results-heading"><p role="status"><strong>{courses.length}</strong> {courses.length === 1 ? "course" : "courses"}{type === "elective" && <span className="muted"> · Breadth counts here only when not used for breadth requirements.</span>}</p></div>
        {eligible && <p className="eligibility-caption">Prerequisite eligible — offerings not verified. Planned courses do not count as completed history in this filter; use “What can I take next?” for semester-aware eligibility.</p>}
        {courses.length ? <><div className="course-grid">{courses.slice(0, limit).map((course) => <CourseCard key={course.code} course={course} />)}</div>{courses.length > limit && <div className="load-more"><button className="button button-secondary" onClick={() => setLimit((current) => current + 18)}>Show more courses ({courses.length - limit} remaining)</button></div>}</> : <EmptyState icon={<Filter size={27} />} title={looksLikeCode && !knownCode ? `${search.trim().toUpperCase()} is not in this catalog.` : "A different search might open a door."} action={<button className="button button-secondary" onClick={reset}>Reset all filters</button>}>{looksLikeCode && !knownCode ? "This planner publishes official MSCS Seattle program courses plus the cataloged prerequisites they name. Undergraduate or other-campus listings are omitted." : "No courses match these filters. Try a broader interest, a different code, or fewer filters."}</EmptyState>}
        <p className="page-footnote">Prerequisite links are navigation aids, not a flattened checklist. Open course details for exact AND/OR rules, grade floors, corequisites, and uncertainties.</p>
      </div>
      <aside className="page-rail">
        <section className="rail-card">
          <h2>Prerequisite status</h2>
          <div className="availability-pair"><div className="availability-stat eligible"><strong>{eligibleCount}</strong><span>Prerequisite eligible</span></div><div className="availability-stat locked"><strong>{lockedCount}</strong><span>Locked or needs review</span></div></div>
          <p>Based on completed and waived courses only. Offerings are not verified.</p>
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
