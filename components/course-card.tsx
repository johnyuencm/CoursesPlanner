"use client";

import Link from "next/link";
import { ArrowRight, Check, Plus, Share2 } from "lucide-react";
import type { Course, Pathway, StudentPlan } from "@/lib/types";
import type { CourseDependencyStats } from "@/lib/catalog-view";
import { catalogTakeStatus, courseDependencyStats } from "@/lib/catalog-view";
import { exploreFocusHref } from "@/lib/routes";
import { useApp } from "./app-provider";
import { SetAsTargetButton } from "./target-path";
import { RequirementChips } from "./requirement-tree";
import { creditLabel } from "./ui";
import pathwayConfig from "@/config/pathways.json";

const pathways = pathwayConfig as Pathway[];

export function CodeLinks({ codes, limit = 3, onSelect }: { codes: string[]; limit?: number; onSelect?: (code: string) => void }) {
  const { openCourse } = useApp();
  return <>{codes.slice(0, limit).map((code) => <button key={code} className="code-chip" type="button" onClick={() => (onSelect ?? openCourse)(code)}>{code}</button>)}</>;
}

export function requirementBadge(type: Course["requirementType"]) {
  if (type === "core") return { label: "Core", className: "badge badge-core" };
  if (type === "breadth") return { label: "Breadth", className: "badge badge-breadth" };
  if (type === "elective") return { label: "Elective", className: "badge badge-elective" };
  return { label: "External", className: "badge" };
}

export function courseStatus(course: Course, completed: boolean, waived: boolean, planned: boolean, plan: StudentPlan) {
  if (completed) return { label: "Completed", className: "completed" };
  if (waived) return { label: "Waived", className: "completed" };
  if (planned) return { label: "Planned", className: "planned" };
  const take = catalogTakeStatus(course, plan);
  if (take === "can-take-now") return { label: "I can take now", className: "eligible" };
  if (take === "blocked") return { label: "Blocked", className: "locked" };
  return { label: "Needs review", className: "review" };
}

export function CourseDependencyFields({
  stats,
  graphHref,
  onViewGraph,
}: {
  stats: CourseDependencyStats;
  graphHref: string;
  onViewGraph?: () => void;
}) {
  const pathwayLabel = stats.requiredByPathwayCount === 1 ? "pathway" : "pathways";
  return <div className="dependency-fields">
    <dl className="dependency-stats">
      <div><dt>Prereqs</dt><dd>{stats.prereqCount}</dd></div>
      <div><dt>Unlocks</dt><dd>{stats.unlockCount}</dd></div>
      <div><dt>Required by</dt><dd>{stats.requiredByPathwayCount} {pathwayLabel}</dd></div>
      {/* The catalog source carries no term offerings, so only show the row when a source provides them (T3). */}
      {stats.terms.length > 0 && <div><dt>Terms</dt><dd>{stats.terms.join(", ")}</dd></div>}
    </dl>
    <Link className="text-link view-graph-link" href={graphHref} onClick={onViewGraph}><Share2 size={14} /> View dependency graph</Link>
  </div>;
}

export function CourseCard({ course, compact = false }: { course: Course; compact?: boolean }) {
  const { plan, openCourse, openPicker, hydrated, setWorkspaceSelection, careerTargetId } = useApp();
  const completed = plan.completedCourses.includes(course.code);
  const waived = plan.waivedCourses.includes(course.code);
  const planned = plan.semesters.some((semester) => semester.courses.some((item) => item.code === course.code));
  const status = courseStatus(course, completed, waived, planned, plan);
  const badge = requirementBadge(course.requirementType);
  const topic = course.topics[0];
  const stats = courseDependencyStats(course, pathways, careerTargetId);
  const graphHref = exploreFocusHref(course.code);
  const focusExplore = () => {
    setWorkspaceSelection({ selectedCode: course.code, focusCode: course.code });
    openCourse(null);
  };
  return <article className={`course-card ${course.requirementType === "core" ? "core-course" : ""} ${compact ? "compact-course" : ""}`}>
    <div className="course-card-top"><button className="course-title-button" onClick={() => openCourse(course.code)}><span className="course-code">{course.code}</span><h3>{course.title}</h3></button><span className={`status-pill ${status.className}`}>{status.label}</span></div>
    <div className="course-meta-row"><span className={badge.className}>{badge.label}</span>{topic && <span className="topic-chip">{topic}</span>}</div>
    {!compact && <CourseDependencyFields stats={stats} graphHref={graphHref} onViewGraph={focusExplore} />}
    {!compact && <div className="course-relationships"><div><span className="relationship-label">Prerequisites</span><div className="relationship-chips">{course.prerequisiteCodes.length || course.prerequisites.type !== "none" ? <RequirementChips expression={course.prerequisites} /> : <span className="muted">{course.prerequisites.type === "none" ? "None" : "Needs review"}</span>}</div></div><div><span className="relationship-label">Unlocks</span><div className="relationship-chips">{course.unlocks.length ? <><CodeLinks codes={course.unlocks} limit={2} />{course.unlocks.length > 2 && <button className="text-button" onClick={() => openCourse(course.code)}>+{course.unlocks.length - 2}</button>}</> : <span className="muted">None listed</span>}</div></div></div>}
    {course.corequisiteCodes.length > 0 && <p className="coreq-note">Corequisite links <CodeLinks codes={course.corequisiteCodes} /></p>}
    <div className="course-card-credits"><span className="credits">{creditLabel(course)} credits</span></div>
    {!compact && <div className="course-card-footer"><button className="button button-secondary button-small" onClick={() => openCourse(course.code)}>Details</button>{completed || waived ? <span className="status-label"><Check size={14} />{waived ? "Waived" : "Completed"}</span> : planned ? <button className="text-button" onClick={() => openCourse(course.code)}>In your plan</button> : <button className="button button-primary button-small" disabled={!hydrated} onClick={() => openPicker(undefined, course.code)}><Plus size={14} /> Add to Plan</button>}<SetAsTargetButton code={course.code} compact /></div>}
  </article>;
}

export function CourseRow({ course, onAdd }: { course: Course; onAdd?: () => void }) {
  const { openCourse } = useApp();
  return <div className="course-row"><button className="course-row-title" onClick={() => openCourse(course.code)}><strong>{course.code}</strong><span>{course.title}</span></button><span className="credits">{creditLabel(course)} cr</span><button className="icon-button" aria-label={onAdd ? `Add ${course.code} to plan` : `View ${course.code}`} onClick={onAdd ?? (() => openCourse(course.code))}>{onAdd ? <Plus size={17} /> : <ArrowRight size={17} />}</button></div>;
}
