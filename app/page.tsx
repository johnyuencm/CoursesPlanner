"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, BookOpen, Check, GitBranch, GraduationCap, Layers3, Plus, Star, TriangleAlert } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { CourseCard } from "@/components/course-card";
import { CatalogState } from "@/components/catalog-state";
import { Meter, OfficialLink, PageHeading, creditLabel } from "@/components/ui";
import { expressionLabel, getEligibility } from "@/lib/validation";

export default function OverviewPage() {
  const { catalog, plan, progress, openCourse, openPicker } = useApp();
  const [sort, setSort] = useState("code");
  const [nextTab, setNextTab] = useState<"eligible" | "locked">("eligible");
  const courseMap = useMemo(() => new Map(catalog?.courses.map((course) => [course.code, course]) ?? []), [catalog]);
  const recordedCodes = useMemo(() => {
    const codes = [...plan.completedCourses, ...plan.waivedCourses, ...plan.semesters.flatMap((semester) => semester.courses.map((item) => item.code))];
    return [...new Set(codes)];
  }, [plan]);
  const yourCourses = useMemo(() => recordedCodes.map((code) => courseMap.get(code)).filter((course) => course !== undefined).sort((a, b) => sort === "title" ? a.title.localeCompare(b.title) : a.code.localeCompare(b.code, undefined, { numeric: true })), [recordedCodes, courseMap, sort]);
  if (!catalog || !progress) return <CatalogState />;
  const { requirements, courses } = catalog;
  const coreCourses = requirements.coreCourses.map((code) => courses.find((course) => course.code === code)).filter((course) => course !== undefined);
  const zeroCreditCore = coreCourses.filter((course) => course.credits === 0);
  const coreSatisfied = progress.core.filter((item) => item.satisfied).length;
  const emptyPlan = plan.completedCourses.length === 0 && plan.waivedCourses.length === 0 && plan.semesters.every((semester) => semester.courses.length === 0);
  const catalogNotes = [...new Set([...requirements.uncertainties, ...catalog.warnings])];
  const target = plan.semesters.find((semester) => semester.type === "academic" && semester.courses.length === 0) ?? [...plan.semesters].reverse().find((semester) => semester.type === "academic") ?? plan.semesters[plan.semesters.length - 1];
  const targetIndex = target ? plan.semesters.findIndex((semester) => semester.id === target.id) : -1;
  const prior = new Set([...plan.completedCourses, ...plan.waivedCourses, ...plan.semesters.slice(0, Math.max(0, targetIndex)).flatMap((semester) => semester.courses.map((course) => course.code))]);
  const concurrent = new Set(target?.courses.map((course) => course.code) ?? []);
  const recorded = new Set(recordedCodes);
  const nextRows = courses.filter((course) => course.requirementType !== "external" && !recorded.has(course.code)).map((course) => ({ course, eligibility: getEligibility(course, prior, concurrent) }));
  const eligible = nextRows.filter((row) => row.eligibility.status === "eligible").slice(0, 6);
  const locked = nextRows.filter((row) => row.eligibility.status !== "eligible").slice(0, 6);
  const planStatus = progress.satisfied && !emptyPlan
    ? { title: "On Track", detail: "Modeled requirements satisfied", success: true }
    : emptyPlan
      ? { title: "Not started", detail: "Add courses to begin", success: false }
      : { title: "In progress", detail: progress.issues.length ? `${progress.issues.length} plan issue${progress.issues.length === 1 ? "" : "s"}` : "Requirements still open", success: false };
  return <>
    <PageHeading title="Degree Overview" description="Track your progress, explore your courses, and plan what’s next." actions={<div className="heading-program"><strong>M.S. in Computer Science</strong><span>{requirements.totalCredits} total credits</span></div>} />
    <div className="page-with-rail">
      <div className="page-main">
        <section className="status-card-row" aria-label="Degree progress">
          <article className="status-card"><span className="status-kicker"><GraduationCap size={15} /> Total credits</span><strong>{progress.totalCredits} / {requirements.totalCredits}</strong><Meter value={progress.totalCredits} max={requirements.totalCredits} label="Total credits" /></article>
          <article className="status-card"><span className="status-kicker"><BookOpen size={15} /> Core</span><strong>{coreSatisfied} / {progress.core.length}</strong><Meter value={coreSatisfied} max={progress.core.length} label="Core courses" /></article>
          <article className="status-card"><span className="status-kicker"><Layers3 size={15} /> Breadth</span><strong>{progress.breadth.assignedCourses.length} / {progress.breadth.coursesRequired}</strong><Meter value={progress.breadth.assignedCourses.length} max={progress.breadth.coursesRequired} label="Breadth courses" /><p className="muted">{progress.breadth.categoriesSatisfied.length}/{progress.breadth.minCategories} areas</p></article>
          <article className="status-card"><span className="status-kicker"><Star size={15} /> Electives</span><strong>{progress.electiveCredits} / {progress.requiredElectiveCredits}</strong><Meter value={progress.electiveCredits} max={progress.requiredElectiveCredits} label="Elective credits" /></article>
          <article className={`status-card ${planStatus.success ? "success" : ""}`}><span className="status-kicker"><GraduationCap size={15} /> Plan status</span><strong>{planStatus.title}</strong><p className="muted">{planStatus.detail}</p></article>
        </section>
        <section>
          <div className="your-courses-heading"><h2>Your Courses ({yourCourses.length})</h2><label className="sort-select">Sort by <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="code">Code</option><option value="title">Title</option></select></label></div>
          <div className="course-grid">
            {yourCourses.map((course) => <CourseCard key={course.code} course={course} compact />)}
            <button className="add-course-tile" onClick={() => openPicker()}><Plus size={22} /><strong>Add Course</strong><span>Open the catalog picker</span></button>
          </div>
        </section>
        {zeroCreditCore.map((course) => <div className="recitation-note" key={course.code}><span className="recitation-icon"><GitBranch size={17} /></span><div><strong>Don’t forget the recitation.</strong><p><button className="text-button" onClick={() => openCourse(course.code)}>{course.code} — {course.title}</button> is a required {course.credits}-credit core course. {course.corequisites.type === "course" ? `Take it alongside ${course.corequisites.code}.` : course.corequisites.type === "none" ? "No corequisite is listed." : `Review its full corequisite rule: ${expressionLabel(course.corequisites)}.`}</p></div><button className="text-button" onClick={() => openCourse(course.code)}>View details <ArrowUpRight size={15} /></button></div>)}
      </div>
      <aside className="page-rail">
        <section className="rail-card">
          <h2>What can I take next?</h2>
          <p>Prerequisite eligible for {target?.name ?? "your next term"}. Offerings are not verified.</p>
          <div className="next-tabs"><button className={nextTab === "eligible" ? "selected" : ""} onClick={() => setNextTab("eligible")}>Eligible ({nextRows.filter((row) => row.eligibility.status === "eligible").length})</button><button className={nextTab === "locked" ? "selected" : ""} onClick={() => setNextTab("locked")}>Locked ({nextRows.filter((row) => row.eligibility.status !== "eligible").length})</button></div>
          {(nextTab === "eligible" ? eligible : locked).map(({ course, eligibility }) => <article className="next-course-row" key={course.code}><button onClick={() => openCourse(course.code)}><strong>{course.code}</strong><span>{course.title}</span>{nextTab === "locked" && <small>{eligibility.status === "uncertain" ? "Needs review" : `Requires ${eligibility.missing.join(" or ") || "prerequisite review"}`}</small>}</button><span>{creditLabel(course)} cr</span>{nextTab === "eligible" && <button className="button button-small button-add" onClick={() => openPicker(target?.id, course.code)}><Plus size={14} /></button>}</article>)}
          {nextTab === "eligible" && !eligible.length && <p className="muted">No prerequisite-eligible matches for this term.</p>}
          {nextTab === "locked" && !locked.length && <p className="muted">No locked matches in this list.</p>}
        </section>
        <section className="rail-card">
          <h3>Prerequisite summary</h3>
          {progress.issues.length === 0 ? <ul className="prereq-summary"><li className="ok"><Check size={14} /> No blocking prerequisite or corequisite issues in this plan.</li><li className="ok"><Check size={14} /> Eligibility uses completed and waived history, plus earlier terms.</li></ul> : <ul className="prereq-summary">{progress.issues.slice(0, 5).map((issue, index) => <li className="warn" key={`${issue.courseCode}-${issue.kind}-${index}`}><TriangleAlert size={14} />{issue.courseCode}: {issue.message}</li>)}</ul>}
          <div className="rail-tip"><p>Tip: Prerequisites are checked from catalog rules and your local plan. Term offerings are unknown.</p></div>
        </section>
        <section className="rail-card">
          <OfficialLink href={requirements.officialUrl} sources={catalog.sources}>Official program requirements</OfficialLink>
          {catalogNotes.length > 0 && <details className="catalog-notes"><summary>Catalog data notes ({catalogNotes.length})</summary><ul>{catalogNotes.map((note) => <li key={note}>{note}</li>)}</ul></details>}
        </section>
      </aside>
    </div>
  </>;
}
