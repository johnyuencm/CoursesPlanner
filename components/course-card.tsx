"use client";

import { ArrowRight, Check, Plus } from "lucide-react";
import type { Course } from "@/lib/types";
import { getEligibility } from "@/lib/validation";
import { useApp } from "./app-provider";
import { creditLabel } from "./ui";

export function CodeLinks({ codes, limit = 3 }: { codes: string[]; limit?: number }) {
  const { openCourse } = useApp();
  return <>{codes.slice(0, limit).map((code) => <button key={code} className="code-chip" onClick={() => openCourse(code)}>{code}</button>)}</>;
}

export function requirementBadge(type: Course["requirementType"]) {
  if (type === "core") return { label: "Core", className: "badge badge-core" };
  if (type === "breadth") return { label: "Breadth", className: "badge badge-breadth" };
  if (type === "elective") return { label: "Elective", className: "badge badge-elective" };
  return { label: "External", className: "badge" };
}

export function courseStatus(course: Course, completed: boolean, waived: boolean, planned: boolean, prior: Set<string>) {
  if (completed) return { label: "Completed", className: "completed" };
  if (waived) return { label: "Waived", className: "completed" };
  if (planned) return { label: "Planned", className: "planned" };
  const eligibility = getEligibility(course, prior);
  if (eligibility.status === "eligible") return { label: "Prerequisite eligible", className: "eligible" };
  if (eligibility.status === "locked") return { label: "Locked", className: "locked" };
  return { label: "Needs review", className: "review" };
}

export function CourseCard({ course, compact = false }: { course: Course; compact?: boolean }) {
  const { plan, openCourse, openPicker, hydrated } = useApp();
  const completed = plan.completedCourses.includes(course.code);
  const waived = plan.waivedCourses.includes(course.code);
  const planned = plan.semesters.some((semester) => semester.courses.some((item) => item.code === course.code));
  const prior = new Set([...plan.completedCourses, ...plan.waivedCourses]);
  const status = courseStatus(course, completed, waived, planned, prior);
  const badge = requirementBadge(course.requirementType);
  const topic = course.topics[0];
  return <article className={`course-card ${course.requirementType === "core" ? "core-course" : ""} ${compact ? "compact-course" : ""}`}>
    <div className="course-card-top"><button className="course-title-button" onClick={() => openCourse(course.code)}><span className="course-code">{course.code}</span><h3>{course.title}</h3></button><span className={`status-pill ${status.className}`}>{status.label}</span></div>
    <div className="course-meta-row"><span className={badge.className}>{badge.label}</span>{topic && <span className="topic-chip">{topic}</span>}</div>
    {!compact && <div className="course-relationships"><div><span className="relationship-label">Prerequisites</span><div className="relationship-chips">{course.prerequisiteCodes.length ? <><CodeLinks codes={course.prerequisiteCodes} />{course.prerequisiteCodes.length > 3 && <button className="text-button" onClick={() => openCourse(course.code)}>+{course.prerequisiteCodes.length - 3}</button>}</> : <span className="muted">{course.prerequisites.type === "none" ? "None" : "Needs review"}</span>}</div></div><div><span className="relationship-label">Unlocks</span><div className="relationship-chips">{course.unlocks.length ? <><CodeLinks codes={course.unlocks} limit={2} />{course.unlocks.length > 2 && <button className="text-button" onClick={() => openCourse(course.code)}>+{course.unlocks.length - 2}</button>}</> : <span className="muted">None listed</span>}</div></div></div>}
    {course.corequisiteCodes.length > 0 && <p className="coreq-note">Corequisite links <CodeLinks codes={course.corequisiteCodes} /></p>}
    <div className="course-card-credits"><span className="credits">{creditLabel(course)} credits</span></div>
    {!compact && <div className="course-card-footer"><button className="button button-secondary button-small" onClick={() => openCourse(course.code)}>Details</button>{completed || waived ? <span className="status-label"><Check size={14} />{waived ? "Waived" : "Completed"}</span> : planned ? <button className="text-button" onClick={() => openCourse(course.code)}>In your plan</button> : <button className="button button-primary button-small" disabled={!hydrated} onClick={() => openPicker(undefined, course.code)}><Plus size={14} /> Add to Plan</button>}</div>}
  </article>;
}

export function CourseRow({ course, onAdd }: { course: Course; onAdd?: () => void }) {
  const { openCourse } = useApp();
  return <div className="course-row"><button className="course-row-title" onClick={() => openCourse(course.code)}><strong>{course.code}</strong><span>{course.title}</span></button><span className="credits">{creditLabel(course)} cr</span><button className="icon-button" aria-label={onAdd ? `Add ${course.code} to plan` : `View ${course.code}`} onClick={onAdd ?? (() => openCourse(course.code))}>{onAdd ? <Plus size={17} /> : <ArrowRight size={17} />}</button></div>;
}
