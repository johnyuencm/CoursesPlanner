"use client";

import { useMemo, useState } from "react";
import { Check, CheckCircle2, GitBranch, Info, Plus, Search, ShieldCheck, TriangleAlert, Undo2 } from "lucide-react";
import type { RequirementExpression } from "@/lib/types";
import { expressionLabel, getEligibility } from "@/lib/validation";
import { useApp } from "./app-provider";
import { CodeLinks } from "./course-card";
import { CreditSelect, EmptyState, Modal, OfficialLink, creditLabel } from "./ui";

function RequirementTree({ expression }: { expression: RequirementExpression }) {
  const { openCourse } = useApp();
  if (expression.type === "none") return <span className="muted">None listed in the catalog.</span>;
  if (expression.type === "unknown") return <div className="inline-warning"><TriangleAlert size={15} /><span>Needs review — {expression.text}</span></div>;
  if (expression.type === "course") return <span className="requirement-leaf"><button className="code-chip" onClick={() => openCourse(expression.code)}>{expression.code}</button>{expression.minimumGrade && <small>grade ≥ {expression.minimumGrade}</small>}{expression.concurrent && <small>may be concurrent</small>}</span>;
  return <div className="requirement-branch"><span className="rule-operator">{expression.type === "all" ? "ALL of the following (AND)" : "ANY of the following (OR)"}</span><ul>{expression.items.map((item, index) => <li key={index}><RequirementTree expression={item} /></li>)}</ul></div>;
}

export function CourseDetail({ code }: { code: string }) {
  const { catalog, plan, openCourse, openPicker, setCourseStatus, hydrated } = useApp();
  const course = catalog?.courses.find((item) => item.code === code);
  const [credits, setCredits] = useState(plan.completedCredits[code] ?? course?.credits ?? 0);
  if (!course) return <Modal title={code} eyebrow="Course details" onClose={() => openCourse(null)} drawer><div className="modal-body"><EmptyState icon={<Info />} title="Not in the current catalog">This referenced course is not available in the cached catalog. Its title, credits, and eligibility have not been inferred. Confirm it with your advisor or refresh the catalog.</EmptyState></div></Modal>;
  const completed = plan.completedCourses.includes(code);
  const waived = plan.waivedCourses.includes(code);
  const semester = plan.semesters.find((term) => term.courses.some((item) => item.code === code));
  const eligibility = getEligibility(course, new Set([...plan.completedCourses, ...plan.waivedCourses]));
  return <Modal title={course.title} eyebrow={course.code} onClose={() => openCourse(null)} drawer><div className="modal-body">
    <div className="detail-meta"><span className={`badge ${course.requirementType === "core" ? "badge-core" : ""}`}>{course.requirementType === "core" ? "Required core" : course.requirementType === "external" ? "External prerequisite" : course.requirementType === "breadth" ? "Breadth / elective" : "Elective"}</span><strong>{creditLabel(course)} credits</strong>{completed && <span className="status-label"><CheckCircle2 size={15} /> Completed</span>}{waived && <span className="status-label"><ShieldCheck size={15} /> Waived</span>}</div>
    <p className="detail-description">{course.description || "No description is available in the current cache."}</p>
    {course.breadthCategories.length > 0 && <div className="detail-tags">{course.breadthCategories.map((id) => <span className="badge" key={id}>{catalog?.requirements.breadthRequirements.categories.find((category) => category.id === id)?.name ?? id}</span>)}</div>}
    <section className="detail-section"><h3>Prerequisites</h3><RequirementTree expression={course.prerequisites} /><p className="raw-rule"><strong>Catalog wording</strong>{course.prerequisiteText || (course.prerequisites.type === "none" ? "None listed." : "Unavailable.")}</p></section>
    <section className="detail-section"><h3>Take together · corequisites</h3><RequirementTree expression={course.corequisites} />{course.corequisiteText && <p className="raw-rule"><strong>Catalog wording</strong>{course.corequisiteText}</p>}</section>
    <section className="detail-section"><h3><GitBranch size={16} /> What this can unlock</h3><p className="muted small-text">These courses reference {course.code}. Other requirements may still apply.</p><div className="detail-code-links">{course.unlocks.length ? <CodeLinks codes={course.unlocks} limit={1000} /> : <span className="muted">No downstream links found in this catalog.</span>}</div></section>
    <div className={`callout ${eligibility.status !== "eligible" ? "callout-warning" : ""}`}><Info size={18} /><div><strong>{eligibility.status === "eligible" ? "Prerequisite eligible from your completed history" : eligibility.status === "locked" ? "Prerequisites still to complete" : "Eligibility needs advisor review"}</strong><p>{eligibility.reasons.join(" ") || "Based on your completed and waived courses. Offerings are not verified."}</p>{eligibility.missing.length > 0 && <div className="detail-code-links"><CodeLinks codes={eligibility.missing} limit={1000} /></div>}</div></div>
    {course.uncertainties.length > 0 && <div className="callout callout-warning"><TriangleAlert size={18} /><div><strong>Catalog notes & uncertainty</strong><ul>{course.uncertainties.map((note, index) => <li key={index}>{note}</li>)}</ul></div></div>}
    <details className="technical-details"><summary>View parsed requirement expressions</summary><p>AND and OR groups are preserved. A reference link alone does not imply every linked course is required.</p><pre>{JSON.stringify({ prerequisites: course.prerequisites, corequisites: course.corequisites }, null, 2)}</pre></details>
    <OfficialLink href={course.officialUrl}>Read the official course description</OfficialLink>
    <section className="history-actions"><h3>Your course status</h3><p className="muted small-text">Marking a course completed attests that its minimum grades were met. A waiver satisfies a requirement, but earns no credits. Advisor approval is still needed.</p><CreditSelect course={course} value={credits} onChange={(value) => { setCredits(value); if (completed) setCourseStatus(code, "completed", value); }} /><div className="button-row">{completed || waived ? <button className="button button-secondary" onClick={() => setCourseStatus(code, "none")}><Undo2 size={15} /> Undo {waived ? "waiver" : "completion"}</button> : <><button className="button button-secondary" disabled={!hydrated} onClick={() => setCourseStatus(code, "completed", credits)}><Check size={15} /> Mark completed</button><button className="button button-secondary" disabled={!hydrated} onClick={() => setCourseStatus(code, "waived")}><ShieldCheck size={15} /> Mark waived</button></>}</div></section>
  </div><footer className="modal-footer"><span className="muted small-text">{semester ? `Planned in ${semester.name}` : completed ? "In your completed history" : waived ? "Requirement waived · 0 earned credits" : "Build a plan around your interests."}</span>{!completed && !waived && !semester && <button className="button button-primary" disabled={!hydrated} onClick={() => openPicker(undefined, code)}><Plus size={16} /> Add to my plan</button>}</footer></Modal>;
}

export function CoursePicker() {
  const { catalog, plan, setPlan, picker, closePicker, addCourse, announce } = useApp();
  const [search, setSearch] = useState(picker?.courseCode ?? "");
  const [selected, setSelected] = useState(picker?.courseCode ?? "");
  const [semesterId, setSemesterId] = useState(picker?.semesterId ?? plan.semesters[0]?.id ?? "");
  const selectedCourse = catalog?.courses.find((course) => course.code === selected);
  const [credits, setCredits] = useState(selectedCourse?.credits ?? 4);
  const [includeCorequisite, setIncludeCorequisite] = useState(false);
  const [newName, setNewName] = useState("");
  const present = useMemo(() => new Set([...plan.completedCourses, ...plan.waivedCourses, ...plan.semesters.flatMap((term) => term.courses.map((course) => course.code))]), [plan]);
  const matches = catalog?.courses.filter((course) => (course.requirementType !== "external" || !!search.trim()) && `${course.code} ${course.title}`.toLowerCase().replace(/\s/g, "").includes(search.toLowerCase().replace(/\s/g, ""))).slice(0, 50) ?? [];
  const companion = selectedCourse?.corequisites.type === "course" ? selectedCourse.corequisites.code : null;
  const companionCourse = companion ? catalog?.courses.find((course) => course.code === companion) : undefined;
  const companionInHistory = companion ? plan.completedCourses.includes(companion) || plan.waivedCourses.includes(companion) : false;
  const companionTerm = companion ? plan.semesters.find((term) => term.courses.some((course) => course.code === companion)) : undefined;
  const targetIndex = plan.semesters.findIndex((term) => term.id === semesterId);
  const companionTermIndex = companionTerm ? plan.semesters.findIndex((term) => term.id === companionTerm.id) : -1;
  const companionSatisfied = companionInHistory || (targetIndex >= 0 && companionTermIndex >= 0 && companionTermIndex <= targetIndex);
  const prior = new Set([...plan.completedCourses, ...plan.waivedCourses, ...plan.semesters.slice(0, Math.max(0, targetIndex)).flatMap((term) => term.courses.map((course) => course.code))]);
  const concurrent = new Set(plan.semesters.find((term) => term.id === semesterId)?.courses.map((course) => course.code) ?? []);
  if (includeCorequisite && companion) concurrent.add(companion);
  const eligibility = selectedCourse ? getEligibility(selectedCourse, prior, concurrent) : null;
  const createSemester = () => {
    if (plan.semesters.length >= 32) {
      announce("This local plan supports up to 32 terms.");
      return;
    }
    const id = crypto.randomUUID();
    setPlan((current) => ({ ...current, semesters: [...current.semesters, { id, name: newName.trim() || `Semester ${current.semesters.length + 1}`, type: "academic", courses: [] }] }));
    setSemesterId(id);
    setNewName("");
  };
  return <Modal title="Make room for what’s next." eyebrow="Add a course" onClose={closePicker}><div className="modal-body picker-body">
    <label className="field-label" htmlFor="picker-semester">Add to semester</label><div className="input-action-row"><select id="picker-semester" value={semesterId} onChange={(event) => setSemesterId(event.target.value)}><option value="">Choose a semester</option>{plan.semesters.map((term) => <option key={term.id} value={term.id}>{term.name}{term.type === "coop" ? " · co-op" : ""}</option>)}</select></div>
    <details className="new-semester-disclosure" open={plan.semesters.length === 0}><summary>Create a new semester</summary><div className="input-action-row"><input aria-label="New semester name" value={newName} placeholder={`Semester ${plan.semesters.length + 1}`} maxLength={100} onChange={(event) => setNewName(event.target.value)} /><button className="button button-secondary" disabled={plan.semesters.length >= 32} onClick={createSemester}><Plus size={15} /> Create</button></div></details>
    <label className="field-label" htmlFor="picker-search">Find a course</label><div className="search-field"><Search size={18} /><input id="picker-search" type="search" value={search} placeholder="Search course code or title…" onChange={(event) => setSearch(event.target.value)} /></div>
    <div className="picker-results" aria-label="Matching courses">{matches.length ? matches.map((course) => <button className={`picker-result ${selected === course.code ? "selected" : ""}`} key={course.code} disabled={present.has(course.code)} onClick={() => { setSelected(course.code); setCredits(course.credits); setIncludeCorequisite(false); }}><span><strong>{course.code}</strong><span>{course.title}</span></span><span>{present.has(course.code) ? "Already recorded" : `${creditLabel(course)} cr`}{selected === course.code && <CheckCircle2 size={17} />}</span></button>) : <EmptyState title="No matching courses">Try a different title or course code.</EmptyState>}</div><p className="muted small-text">Showing up to 50 matches. Search to narrow the catalog.</p>
    {selectedCourse && <div className="picker-selection"><div className="section-heading"><h3>{selectedCourse.code} selected</h3><CreditSelect course={selectedCourse} value={credits} onChange={setCredits} /></div>{selectedCourse.requirementType === "external" && <p className="inline-warning"><TriangleAlert size={15} /> External prerequisite. Not automatically eligible for degree credit.</p>}{companion && !companionSatisfied && <div className="callout callout-warning"><Info size={17} /><div><strong>{selected} must be taken with {companion}.</strong>{companionTerm ? <p>Move {companion} from {companionTerm.name} into the same semester to satisfy the corequisite.</p> : <label className="checkbox-label"><input type="checkbox" checked={includeCorequisite} onChange={(event) => setIncludeCorequisite(event.target.checked)} /> Also add {companion}{companionCourse ? ` · ${companionCourse.title} · ${creditLabel(companionCourse)} credits` : ""}</label>}</div></div>}{eligibility && eligibility.status !== "eligible" && <p className="inline-warning"><TriangleAlert size={15} /><span>{eligibility.status === "locked" ? "Prerequisites not yet met. " : "Prerequisite eligibility needs advisor review. "}{eligibility.reasons.join(" ") || expressionLabel(selectedCourse.prerequisites)} You can still add this course and resolve the audit warnings.</span></p>}</div>}
  </div><footer className="modal-footer"><span className="muted small-text">Catalog only. Offerings not verified.</span><button className="button button-primary" disabled={!selectedCourse || !semesterId || present.has(selected)} onClick={() => { if (selectedCourse && semesterId) { addCourse(selected, semesterId, credits, includeCorequisite); closePicker(); } }}><Plus size={16} /> Add to semester</button></footer></Modal>;
}
