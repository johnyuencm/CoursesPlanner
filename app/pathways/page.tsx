"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Compass,
  Edit3,
  Info,
  Plus,
  RotateCcw,
  Save,
  TriangleAlert,
} from "lucide-react";
import pathwayConfig from "@/config/pathways.json";
import type { Course, Pathway } from "@/lib/types";
import { getEligibility } from "@/lib/validation";
import { useApp } from "@/components/app-provider";
import { CatalogState } from "@/components/catalog-state";
import { requirementBadge } from "@/components/course-card";
import { PageHeading, creditLabel } from "@/components/ui";

const STORAGE_KEY = "neu-mscs-planner-pathways-v1";

function validPathways(value: unknown): value is Pathway[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) return false;
  const ids = new Set<string>();
  return value.every((pathway) => {
    if (!pathway || typeof pathway !== "object") return false;
    const item = pathway as Record<string, unknown>;
    if (typeof item.id !== "string" || item.id.length === 0 || item.id.length > 80 || ids.has(item.id)) return false;
    ids.add(item.id);
    return typeof item.name === "string" && item.name.length > 0 && item.name.length <= 100 && item.name.trim() === item.name &&
      typeof item.description === "string" && item.description.length <= 300 && item.description.trim() === item.description &&
      Array.isArray(item.groups) && item.groups.length > 0 && item.groups.length <= 12 && item.groups.every((group) => {
        if (!group || typeof group !== "object") return false;
        const record = group as Record<string, unknown>;
        return typeof record.label === "string" && record.label.length > 0 && record.label.length <= 100 && record.label.trim() === record.label &&
          Array.isArray(record.courses) && record.courses.length <= 30 && new Set(record.courses).size === record.courses.length &&
          record.courses.every((code) => typeof code === "string" && /^[A-Z]{2,6} \d{2,4}[A-Z]{0,2}$/.test(code));
      });
  });
}

const defaults = pathwayConfig as Pathway[];

export default function PathwaysPage() {
  const { catalog, openCourse, openPicker, plan, announce, careerTargetId } = useApp();
  const [pathways, setPathways] = useState<Pathway[]>(defaults);
  const [selectedId, setSelectedId] = useState(careerTargetId && defaults.some((pathway) => pathway.id === careerTargetId) ? careerTargetId : defaults[0].id);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed: unknown = JSON.parse(saved);
      if (!validPathways(parsed)) throw new Error("saved pathway format is invalid");
      setPathways(parsed);
      setSelectedId((current) => parsed.some((pathway) => pathway.id === current) ? current : parsed[0].id);
    } catch (error) {
      setLoadError(`Custom pathway recommendations were not loaded: ${error instanceof Error ? error.message : "unknown browser storage error"}. Defaults remain available.`);
    }
  }, []);

  useEffect(() => {
    if (careerTargetId && pathways.some((pathway) => pathway.id === careerTargetId)) setSelectedId(careerTargetId);
  }, [careerTargetId]);

  const selected = pathways.find((pathway) => pathway.id === selectedId) ?? pathways[0];
  const courseMap = useMemo(() => new Map(catalog?.courses.map((course) => [course.code, course]) ?? []), [catalog]);
  const recorded = useMemo(() => new Set([...plan.completedCourses, ...plan.waivedCourses, ...plan.semesters.flatMap((semester) => semester.courses.map((course) => course.code))]), [plan]);
  const prior = useMemo(() => new Set([...plan.completedCourses, ...plan.waivedCourses]), [plan.completedCourses, plan.waivedCourses]);
  if (!catalog) return <CatalogState />;

  const replaceSelected = (change: (pathway: Pathway) => Pathway) => setPathways((current) => current.map((pathway) => pathway.id === selected.id ? change(pathway) : pathway));
  const save = () => {
    try {
      if (!validPathways(pathways)) throw new Error("recommendations contain an invalid course code or empty group");
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pathways));
      setMessage("Custom recommendations saved on this device.");
      setLoadError(null);
      setEditing(false);
      announce("Suggested pathway recommendations saved. Degree requirements were not changed.");
    } catch (error) {
      setMessage(null);
      setLoadError(`Recommendations were not saved: ${error instanceof Error ? error.message : "browser storage is unavailable"}.`);
    }
  };
  const reset = () => {
    if (!window.confirm("Reset every suggested pathway to the project defaults on this device? Your degree plan will not change.")) return;
    setPathways(defaults);
    setSelectedId(defaults[0].id);
    setEditing(false);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      setLoadError(null);
      setMessage("Default recommendations restored. Your degree plan was not changed.");
      announce("Default pathway recommendations restored.");
    } catch (error) {
      setMessage(null);
      setLoadError(`Defaults are restored in this tab, but browser storage could not be updated: ${error instanceof Error ? error.message : "browser storage is unavailable"}.`);
    }
  };
  const recommended = selected.groups.flatMap((group) => group.courses);
  const inPlan = recommended.filter((code) => recorded.has(code)).length;
  const eligibleNext = recommended.filter((code) => !recorded.has(code)).map((code) => courseMap.get(code)).filter((course): course is Course => course !== undefined && getEligibility(course, prior).status === "eligible");

  return <>
    <PageHeading title={`${selected.name} Pathway`} description="Personalized course recommendations for a career direction. These never change official degree rules." actions={<div className="heading-actions"><button className="button button-secondary" onClick={() => setEditing((value) => !value)}><Edit3 size={15} /> {editing ? "Stop editing" : "Edit suggestions"}</button>{editing && <button className="button button-primary" onClick={save}><Save size={15} /> Save on this device</button>}</div>} />
    <div className="recommendation-banner"><Info size={18} /><div><strong>Suggested pathway — not a degree requirement.</strong><p>Recommendations never change your official core, breadth, elective, or credit audit. Confirm course fit and availability with your advisor.</p></div></div>
    {(loadError || message) && <div className={`global-banner ${loadError ? "warning" : "success"}`} role={loadError ? "alert" : "status"}>{loadError ? <TriangleAlert size={16} /> : <Check size={16} />}<span>{loadError ?? message}</span></div>}
    <nav className="pathway-tabs" aria-label="Suggested pathways">{pathways.map((pathway) => <button key={pathway.id} className={selected.id === pathway.id ? "selected" : ""} onClick={() => setSelectedId(pathway.id)}><strong>{pathway.name}</strong></button>)}</nav>
    <div className="pathway-layout">
      <section className="pathway-detail">
        <header>{editing ? <div>{<><label className="field-label" htmlFor="pathway-name">Pathway name</label><input id="pathway-name" value={selected.name} maxLength={100} onChange={(event) => replaceSelected((pathway) => ({ ...pathway, name: event.target.value }))} /><label className="field-label" htmlFor="pathway-description">Description</label><textarea id="pathway-description" value={selected.description} maxLength={300} rows={3} onChange={(event) => replaceSelected((pathway) => ({ ...pathway, description: event.target.value }))} /></>}</div> : <div><p>{selected.description}</p></div>}</header>
        <div className="pathway-groups">{selected.groups.map((group, groupIndex) => <section key={`${selected.id}-${groupIndex}`} className="pathway-group"><div className="pathway-group-heading">{editing ? <input aria-label={`Group ${groupIndex + 1} label`} value={group.label} maxLength={100} onChange={(event) => replaceSelected((pathway) => ({ ...pathway, groups: pathway.groups.map((item, index) => index === groupIndex ? { ...item, label: event.target.value } : item) }))} /> : <><span>{String(groupIndex + 1).padStart(2, "0")}</span><h3>{group.label}</h3></>}<span>{group.courses.length} courses</span></div>
          {editing ? <label className="pathway-code-editor"><span>Course codes · comma separated</span><textarea rows={3} value={group.courses.join(", ")} onChange={(event) => { const courses = [...new Set(event.target.value.toUpperCase().split(",").map((code) => code.trim()).filter(Boolean))]; replaceSelected((pathway) => ({ ...pathway, groups: pathway.groups.map((item, index) => index === groupIndex ? { ...item, courses } : item) })); }} /></label> : <div className="pathway-course-list">{group.courses.map((code) => {
            const course = courseMap.get(code);
            const badge = course ? requirementBadge(course.requirementType) : null;
            return <article className={`pathway-course ${!course ? "missing" : ""}`} key={code}><button className="pathway-course-main" onClick={() => openCourse(code)}><strong>{code}</strong><span>{course?.title ?? "Not found in current catalog"}</span><small>{course ? `${creditLabel(course)} credits` : "Recommendation retained, details unverified"}</small></button><div>{badge && <span className={badge.className}>{badge.label}</span>}{recorded.has(code) ? <span className="status-label"><Check size={14} /> Recorded</span> : course ? <button className="button button-small button-add" onClick={() => openPicker(undefined, code)}><Plus size={14} /> Plan</button> : <button className="text-button" onClick={() => openCourse(code)}>Review</button>}</div></article>;
          })}</div>}
        </section>)}</div>
        {editing && <div className="pathway-edit-actions"><button className="button button-secondary" onClick={() => replaceSelected((pathway) => ({ ...pathway, groups: [...pathway.groups, { label: "New group", courses: [] }] }))}><Plus size={15} /> Add recommendation group</button><button className="text-button" onClick={reset}><RotateCcw size={14} /> Restore all defaults</button></div>}
      </section>
      <aside className="page-rail">
        <section className="rail-card">
          <h2>Readiness</h2>
          <p>{inPlan} of {recommended.length} recommended courses are in your plan or history.</p>
        </section>
        <section className="rail-card">
          <h3>Validation</h3>
          <p>These recommendations do not change degree rules. Graduation status still comes only from the modeled catalog audit.</p>
        </section>
        <section className="rail-card">
          <h3>Next recommended courses</h3>
          <p>Prerequisite eligible from completed and waived history. Offerings are not verified.</p>
          {eligibleNext.length ? eligibleNext.map((course) => <article className="next-course-row" key={course.code}><button onClick={() => openCourse(course.code)}><strong>{course.code}</strong><span>{course.title}</span></button><span>{creditLabel(course)} cr</span><button className="button button-small button-add" onClick={() => openPicker(undefined, course.code)}><Plus size={14} /></button></article>) : <p className="muted">No remaining recommended courses are prerequisite eligible yet.</p>}
        </section>
      </aside>
    </div>
    <section className="pathway-closing"><div><Compass size={24} /><h2>Your direction can change.</h2><p>Use these ideas as a starting point. Degree validation stays grounded in official catalog rules.</p></div><button className="button button-primary" onClick={() => openPicker()}><Plus size={15} /> Add a course to my plan</button></section>
  </>;
}
