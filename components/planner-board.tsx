"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  ArrowDown,
  ArrowUp,
  BriefcaseBusiness,
  CalendarPlus,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  GripVertical,
  Info,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import type { Course, PlannedCourse, Semester } from "@/lib/types";
import { getEligibility } from "@/lib/validation";
import { useApp } from "./app-provider";
import { PlanBackup } from "./plan-backup";
import { CatalogState } from "./catalog-state";
import { requirementBadge } from "./course-card";
import { CreditSelect, EmptyState, Meter, PageHeading, creditLabel } from "./ui";

function PlanCourseCard({
  item,
  semester,
  terms,
  course,
  onMove,
  onRemove,
  onCredits,
}: {
  item: PlannedCourse;
  semester: Semester;
  terms: Semester[];
  course?: Course;
  onMove: (targetId: string) => void;
  onRemove: () => void;
  onCredits: (credits: number) => void;
}) {
  const { openCourse, setCourseStatus } = useApp();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `course:${semester.id}:${item.code}`,
    data: { kind: "course", semesterId: semester.id, code: item.code },
  });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const badge = course ? requirementBadge(course.requirementType) : null;
  const topic = course?.topics[0];

  return <article ref={setNodeRef} style={style} className={`plan-course ${isDragging ? "dragging" : ""}`}>
    <button className="drag-handle" aria-label={`Drag ${item.code} to another semester`} {...attributes} {...listeners}><GripVertical size={17} /></button>
    <button className="plan-course-title" onClick={() => openCourse(item.code)}><strong>{item.code}</strong><span>{course?.title ?? "Course not found in current catalog"}</span></button>
    <span className="status-pill planned">Planned</span>
    <div className="plan-course-chips">{badge && <span className={badge.className}>{badge.label}</span>}{topic && <span className="topic-chip">{topic}</span>}</div>
    <span className="plan-course-credits">{course ? `${item.credits ?? course.credits} credits` : "Unknown"}</span>
    {course && course.maxCredits !== undefined && course.maxCredits > course.credits && <CreditSelect course={course} value={item.credits ?? course.credits} onChange={onCredits} id={`credits-${semester.id}-${item.code.replace(/\s/g, "-")}`} />}
    <div className="plan-course-actions">
      <label className="compact-select"><span className="sr-only">Move {item.code}</span><select value={semester.id} onChange={(event) => onMove(event.target.value)}>{terms.map((term) => <option key={term.id} value={term.id}>Move to {term.name}</option>)}</select></label>
      <button className="icon-button" title="Mark completed" aria-label={`Mark ${item.code} completed`} onClick={() => setCourseStatus(item.code, "completed", item.credits ?? course?.credits)}><Check size={15} /></button>
      <button className="icon-button" title="Mark waived" aria-label={`Mark ${item.code} waived`} onClick={() => setCourseStatus(item.code, "waived")}><ShieldCheck size={15} /></button>
      <button className="icon-button danger" title="Remove" aria-label={`Remove ${item.code} from ${semester.name}`} onClick={onRemove}><X size={15} /></button>
    </div>
  </article>;
}

function SemesterName({ name, onCommit }: { name: string; onCommit: (name: string) => void }) {
  const [value, setValue] = useState(name);
  useEffect(() => setValue(name), [name]);
  const commit = () => {
    const next = value.trim();
    if (next) onCommit(next);
    else setValue(name);
  };
  return <input className="semester-name" aria-label="Semester name" value={value} maxLength={100} onChange={(event) => setValue(event.target.value)} onBlur={commit} onKeyDown={(event) => {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") { setValue(name); event.currentTarget.blur(); }
  }} />;
}

function SemesterColumn({
  semester,
  index,
  terms,
  courseMap,
  onRename,
  onType,
  onMoveTerm,
  onMoveCourse,
  onRemoveCourse,
  onCredits,
  onRemoveTerm,
}: {
  semester: Semester;
  index: number;
  terms: Semester[];
  courseMap: Map<string, Course>;
  onRename: (name: string) => void;
  onType: (type: Semester["type"]) => void;
  onMoveTerm: (direction: -1 | 1) => void;
  onMoveCourse: (code: string, targetId: string) => void;
  onRemoveCourse: (code: string) => void;
  onCredits: (code: string, credits: number) => void;
  onRemoveTerm: () => void;
}) {
  const { openPicker } = useApp();
  const { setNodeRef, isOver } = useDroppable({ id: `semester:${semester.id}`, data: { kind: "semester", semesterId: semester.id } });
  const credits = semester.courses.reduce((sum, item) => sum + (item.credits ?? courseMap.get(item.code)?.credits ?? 0), 0);
  return <section ref={setNodeRef} className={`semester-column ${semester.type === "coop" ? "coop-term" : ""} ${isOver ? "drop-target" : ""}`} aria-label={semester.name}>
    <header className="semester-header">
      <div className="semester-order"><span>{String(index + 1).padStart(2, "0")}</span><button className="icon-button" disabled={index === 0} aria-label={`Move ${semester.name} earlier`} onClick={() => onMoveTerm(-1)}><ArrowUp size={14} /></button><button className="icon-button" disabled={index === terms.length - 1} aria-label={`Move ${semester.name} later`} onClick={() => onMoveTerm(1)}><ArrowDown size={14} /></button></div>
      <SemesterName name={semester.name} onCommit={onRename} />
      <div className="semester-meta"><label><span className="sr-only">Semester type</span><select value={semester.type} onChange={(event) => onType(event.target.value as Semester["type"])}><option value="academic">Academic term</option><option value="coop">Internship / co-op</option></select></label><span>{semester.type === "coop" ? "Experience term" : `${credits} planned credits`}</span></div>
      <button className="icon-button danger semester-remove" aria-label={`Remove ${semester.name}`} onClick={onRemoveTerm}><Trash2 size={15} /></button>
    </header>
    {semester.type === "coop" ? <div className="coop-card"><BriefcaseBusiness size={28} /><strong>Internship / co-op</strong><p>Experience term. Courses remain optional and count only when the catalog marks them eligible.</p></div> : null}
    <div className="semester-courses">
      {semester.courses.map((item) => <PlanCourseCard key={item.code} item={item} semester={semester} terms={terms} course={courseMap.get(item.code)} onMove={(targetId) => onMoveCourse(item.code, targetId)} onRemove={() => onRemoveCourse(item.code)} onCredits={(value) => onCredits(item.code, value)} />)}
      {!semester.courses.length && semester.type === "academic" && <div className="term-empty"><span>Drop courses here</span><small>or use Add course</small></div>}
    </div>
    <button className="add-term-course" onClick={() => openPicker(semester.id)}><Plus size={15} /> Add course</button>
  </section>;
}

function AuditPanel({ onMoveCourse }: { onMoveCourse: (code: string, fromId: string, targetId: string) => void }) {
  const { catalog, progress, plan, openCourse, openPicker } = useApp();
  if (!catalog || !progress) return null;
  return <aside className="audit-panel" id="plan-issue-rail" tabIndex={-1}>
    <div className="audit-heading"><span className="section-kicker"><CircleAlert size={15} /> WHY IS THIS BLOCKED?</span><span className={`audit-status ${progress.issues.length ? "incomplete" : "complete"}`}>{progress.issues.length ? <Clock3 size={16} /> : <CheckCircle2 size={16} />}{progress.issues.length ? `${progress.issues.length} issue${progress.issues.length === 1 ? "" : "s"}` : "No blocking issues"}</span></div>
    <h2>{progress.issues.length ? "Plan checks that need attention." : "No prerequisite, corequisite, duplicate, or credit issues found."}</h2>
    <section className="audit-issues">{progress.issues.length ? progress.issues.map((issue, index) => <div className={`audit-issue ${issue.severity}`} key={`${issue.semesterId}-${issue.courseCode}-${issue.kind}-${index}`}>{issue.severity === "error" ? <TriangleAlert size={17} /> : <Info size={17} />}<div><strong>{issue.courseCode} · {issue.kind}</strong><p>{issue.message}</p>{issue.relatedCourses.length > 0 && <div className="button-row">{issue.relatedCourses.map((code) => {
      const issueIndex = plan.semesters.findIndex((semester) => semester.id === issue.semesterId);
      const issueTerm = plan.semesters[issueIndex];
      const earlierTerm = issueIndex > 0 ? plan.semesters.slice(0, issueIndex).findLast((semester) => semester.type === "academic") : undefined;
      const resolutionTerm = issue.kind === "corequisite" ? issueTerm : earlierTerm;
      const plannedTerm = plan.semesters.find((semester) => semester.courses.some((course) => course.code === code));
      const plannedTermIndex = plannedTerm ? plan.semesters.findIndex((semester) => semester.id === plannedTerm.id) : -1;
      const canMoveEarlier = plannedTerm !== undefined && plannedTermIndex >= issueIndex;
      return <span key={code}><button className="text-button" onClick={() => openCourse(code)}>View {code}</button>{resolutionTerm && (canMoveEarlier && plannedTerm ? <button className="text-button" onClick={() => onMoveCourse(code, plannedTerm.id, resolutionTerm.id)}>Move to {resolutionTerm.name}</button> : !plannedTerm ? <button className="text-button" onClick={() => openPicker(resolutionTerm.id, code)}>Add to {resolutionTerm.name}</button> : null)}</span>;
    })}</div>}</div></div>) : <div className="audit-clear"><CheckCircle2 size={18} /><span>Modeled plan checks are clear. Offerings are still unverified.</span></div>}</section>
    <details className="audit-notes"><summary>What this audit cannot verify</summary><ul>{progress.notes.map((note) => <li key={note}>{note}</li>)}</ul></details>
    <NextCourses />
  </aside>;
}

function NextCourses() {
  const { catalog, plan, openCourse, openPicker } = useApp();
  const [semesterId, setSemesterId] = useState(plan.semesters[0]?.id ?? "");
  const [query, setQuery] = useState("");
  if (!catalog) return null;
  const effectiveSemesterId = plan.semesters.some((semester) => semester.id === semesterId) ? semesterId : plan.semesters[0]?.id ?? "";
  const targetIndex = plan.semesters.findIndex((semester) => semester.id === effectiveSemesterId);
  const prior = new Set([...plan.completedCourses, ...plan.waivedCourses, ...plan.semesters.slice(0, Math.max(0, targetIndex)).flatMap((semester) => semester.courses.map((course) => course.code))]);
  const concurrent = new Set(plan.semesters[targetIndex]?.courses.map((course) => course.code) ?? []);
  const recorded = new Set([...plan.completedCourses, ...plan.waivedCourses, ...plan.semesters.flatMap((semester) => semester.courses.map((course) => course.code))]);
  const candidates = catalog.courses.filter((course) => course.requirementType !== "external" && !recorded.has(course.code) && (!query || `${course.code} ${course.title}`.toLowerCase().includes(query.toLowerCase())));
  const rows = candidates.map((course) => ({ course, eligibility: getEligibility(course, prior, concurrent) }));
  const eligible = rows.filter((row) => row.eligibility.status === "eligible").slice(0, 8);
  const locked = rows.filter((row) => row.eligibility.status !== "eligible").slice(0, 8);
  const term = plan.semesters[targetIndex];
  return <section className="next-courses">
    <div className="section-heading"><div><span className="section-kicker"><Sparkles size={15} /> RECOMMENDED NEXT COURSES</span><h2>Prerequisite eligible</h2><p>Eligibility only. Actual offerings are not verified.</p></div><div className="next-controls"><label>Target term<select value={effectiveSemesterId} onChange={(event) => setSemesterId(event.target.value)}>{plan.semesters.map((semester) => <option value={semester.id} key={semester.id}>{semester.name}</option>)}</select></label><div className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Filter courses…" aria-label="Filter next courses" /></div></div></div>
    {!term ? <EmptyState title="Add an academic term">Create a semester to calculate next-course eligibility.</EmptyState> : <div className="next-grid"><div><h3><CheckCircle2 size={17} /> Prerequisite eligible <span>{rows.filter((row) => row.eligibility.status === "eligible").length}</span></h3>{eligible.length ? eligible.map(({ course }) => <article className="next-course-row" key={course.code}><button onClick={() => openCourse(course.code)}><strong>{course.code}</strong><span>{course.title}</span></button><span>{creditLabel(course)} cr</span><button className="button button-small button-add" onClick={() => openPicker(effectiveSemesterId, course.code)}><Plus size={14} /> Plan</button></article>) : <p className="muted">No eligible matches. Complete more prerequisites or clear the search.</p>}</div><div><h3><TriangleAlert size={17} /> Locked or uncertain <span>{rows.filter((row) => row.eligibility.status !== "eligible").length}</span></h3>{locked.length ? locked.map(({ course, eligibility }) => <article className="next-course-row locked" key={course.code}><button onClick={() => openCourse(course.code)}><strong>{course.code}</strong><span>{course.title}</span><small>{eligibility.status === "uncertain" ? "Needs review" : `Requires ${eligibility.missing.join(" or ") || "prerequisite review"}`}</small></button><button className="text-button" onClick={() => openCourse(course.code)}>Details</button></article>) : <p className="muted">No locked matches.</p>}</div></div>}
  </section>;
}

export default function PlannerBoard() {
  const { catalog, plan, setPlan, hydrated, persistence, resetPlan, openPicker, announce, progress } = useApp();
  const [activeCourse, setActiveCourse] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const courseMap = useMemo(() => new Map(catalog?.courses.map((course) => [course.code, course]) ?? []), [catalog]);
  if (!catalog) return <>
    <PageHeading title="Build My Plan" description="Your local plan remains available for backup while the catalog is unavailable." actions={<div className="heading-actions"><span className={`save-status ${persistence}`}><span />{!hydrated ? "Loading local plan" : persistence === "saved" ? "Saved on this device" : persistence === "blocked" ? "Saving blocked" : persistence === "error" ? "Save failed" : "Preparing"}</span></div>} />
    <PlanBackup />
    <CatalogState />
  </>;

  const updateTerms = (change: (terms: Semester[]) => Semester[]) => setPlan((current) => ({ ...current, semesters: change(current.semesters) }));
  const moveCourse = (code: string, fromId: string, targetId: string) => {
    if (fromId === targetId) return;
    const target = plan.semesters.find((semester) => semester.id === targetId);
    if (!target) {
      announce("Choose an existing term before moving a course.");
      return;
    }
    if (target.courses.length >= 32) {
      announce(`${target.name} supports up to 32 planned courses.`);
      return;
    }
    updateTerms((terms) => {
      const item = terms.find((term) => term.id === fromId)?.courses.find((course) => course.code === code);
      const currentTarget = terms.find((term) => term.id === targetId);
      if (!item || !currentTarget || currentTarget.courses.length >= 32 || currentTarget.courses.some((course) => course.code === code)) return terms;
      return terms.map((term) => term.id === fromId ? { ...term, courses: term.courses.filter((course) => course.code !== code) } : term.id === targetId ? { ...term, courses: [...term.courses, item] } : term);
    });
  };
  const dragStart = (event: DragStartEvent) => setActiveCourse(String(event.active.data.current?.code ?? ""));
  const dragEnd = (event: DragEndEvent) => {
    const data = event.active.data.current;
    const target = event.over?.data.current;
    if (data?.kind === "course" && target?.kind === "semester") moveCourse(String(data.code), String(data.semesterId), String(target.semesterId));
    setActiveCourse(null);
  };
  const addTerm = (type: Semester["type"] = "academic") => {
    if (plan.semesters.length >= 32) {
      announce("This local plan supports up to 32 terms.");
      return;
    }
    updateTerms((terms) => [...terms, { id: crypto.randomUUID(), name: type === "coop" ? "Internship / Co-op" : `Semester ${terms.length + 1}`, type, courses: [] }]);
  };

  return <>
    <PageHeading title="Build My Plan" description="Arrange semesters, test prerequisites, and see every degree requirement update as you go." actions={<div className="heading-actions"><span className={`save-status ${persistence}`}><span />{!hydrated ? "Loading local plan" : persistence === "saved" ? "Saved on this device" : persistence === "blocked" ? "Saving blocked" : persistence === "error" ? "Save failed" : "Preparing"}</span><PlanBackup /><button className="button button-secondary" onClick={() => document.getElementById("plan-issue-rail")?.focus()}>Review audit</button><button className="button button-secondary" onClick={() => openPicker()}><Plus size={16} /> Add course</button></div>} />
    {progress && <section className="status-card-row four" aria-label="Plan status">
      <article className="status-card"><span className="status-kicker">Total credits in plan</span><strong>{progress.totalCredits} / {progress.requiredCredits}</strong><Meter value={progress.totalCredits} max={progress.requiredCredits} label="Total credits in plan" /></article>
      <article className="status-card"><span className="status-kicker">Requirements status</span><strong>{Number(progress.core.every((item) => item.satisfied)) + Number(progress.breadth.satisfied) + Number(progress.electiveCredits >= progress.requiredElectiveCredits)} / 3</strong><p className="muted">Core, breadth, and elective credit buckets</p></article>
      <article className={`status-card ${progress.issues.length === 0 ? "success" : ""}`}><span className="status-kicker">Plan validity</span><strong>{progress.issues.length === 0 ? "No blocking issues" : `${progress.issues.length} issue${progress.issues.length === 1 ? "" : "s"}`}</strong><p className="muted">{progress.satisfied ? "Modeled requirements are satisfied." : "Keep resolving catalog-based checks."}</p></article>
      <article className="status-card"><span className="status-kicker">Plan timeline</span><strong>{plan.semesters[plan.semesters.length - 1]?.name ?? "No terms"}</strong><p className="muted">Last term in this local plan — not a graduation date</p></article>
    </section>}
    <div className="planner-layout"><div className="planner-main">
      <div className="planner-actions"><div><button className="button button-secondary" disabled={plan.semesters.length >= 32} onClick={() => addTerm("academic")}><CalendarPlus size={15} /> Add semester</button><button className="button button-secondary" disabled={plan.semesters.length >= 32} onClick={() => addTerm("coop")}><BriefcaseBusiness size={15} /> Add internship / co-op</button></div><button className="text-button danger-text" onClick={resetPlan}><RotateCcw size={14} /> Reset local plan</button></div>
      <p className="drag-note"><GripVertical size={15} /> Drag courses between terms. Keyboard users can focus a drag handle, press Space, use arrow keys, then press Space again. Every course also has a Move menu.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={dragStart} onDragCancel={() => setActiveCourse(null)} onDragEnd={dragEnd}>
        <div className="semester-board">{plan.semesters.map((semester, index) => <SemesterColumn key={semester.id} semester={semester} index={index} terms={plan.semesters} courseMap={courseMap} onRename={(name) => updateTerms((terms) => terms.map((term) => term.id === semester.id ? { ...term, name } : term))} onType={(type) => updateTerms((terms) => terms.map((term) => term.id === semester.id ? { ...term, type } : term))} onMoveTerm={(direction) => updateTerms((terms) => { const next = [...terms]; const target = index + direction; if (target < 0 || target >= next.length) return terms; [next[index], next[target]] = [next[target], next[index]]; return next; })} onMoveCourse={(code, targetId) => moveCourse(code, semester.id, targetId)} onRemoveCourse={(code) => updateTerms((terms) => terms.map((term) => term.id === semester.id ? { ...term, courses: term.courses.filter((course) => course.code !== code) } : term))} onCredits={(code, credits) => updateTerms((terms) => terms.map((term) => term.id === semester.id ? { ...term, courses: term.courses.map((course) => course.code === code ? { ...course, credits } : course) } : term))} onRemoveTerm={() => { if (semester.courses.length && !window.confirm(`Remove ${semester.name} and its ${semester.courses.length} planned course${semester.courses.length === 1 ? "" : "s"}? Course history is unchanged.`)) return; updateTerms((terms) => terms.filter((term) => term.id !== semester.id)); }} />)}</div>
        <DragOverlay>{activeCourse && <div className="drag-overlay"><GripVertical size={16} /><strong>{activeCourse}</strong><span>{courseMap.get(activeCourse)?.title}</span></div>}</DragOverlay>
      </DndContext>
      {!plan.semesters.length && <EmptyState icon={<CalendarPlus size={25} />} title="Start with your first semester" action={<button className="button button-primary" onClick={() => addTerm()}><Plus size={15} /> Add semester</button>}>Create a term, then add courses from the catalog.</EmptyState>}
    </div><AuditPanel onMoveCourse={moveCourse} /></div>
    {progress && <section className="suggestion-strip" aria-label="Smart suggestions">
      {progress.core.some((item) => !item.satisfied) && <article className="suggestion-card core"><strong>Core remaining</strong><p>{progress.core.filter((item) => !item.satisfied).map((item) => item.code).join(", ")} still needed for modeled core.</p></article>}
      {!progress.breadth.satisfied && <article className="suggestion-card breadth"><strong>Breadth diversity</strong><p>{progress.breadth.assignedCourses.length}/{progress.breadth.coursesRequired} breadth courses; {progress.breadth.categoriesSatisfied.length}/{progress.breadth.minCategories} required areas represented.</p></article>}
      {progress.electiveCredits < progress.requiredElectiveCredits && <article className="suggestion-card elective"><strong>Elective credits</strong><p>{progress.electiveCredits}/{progress.requiredElectiveCredits} eligible elective credits counted in this plan.</p></article>}
      {progress.core.every((item) => item.satisfied) && progress.breadth.satisfied && progress.electiveCredits >= progress.requiredElectiveCredits && <article className="suggestion-card ok"><strong>Modeled requirements</strong><p>Core, breadth, and elective credit targets are met in this plan model. Offerings are not verified.</p></article>}
    </section>}
  </>;
}
