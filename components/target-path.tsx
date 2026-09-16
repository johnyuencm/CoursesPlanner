"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { CalendarPlus, CircleAlert, Target } from "lucide-react";
import { routes, targetPathHref } from "@/lib/routes";
import { matchCourseTarget, targetPathSnapshot } from "@/lib/target-path";
import { useApp } from "./app-provider";

export function CourseTargetControl() {
  const { catalog, courseTargetCode, setCourseTargetCode } = useApp();
  const [draft, setDraft] = useState(courseTargetCode ?? "");
  useEffect(() => {
    setDraft(courseTargetCode ?? "");
  }, [courseTargetCode]);
  const options = catalog?.courses.filter((course) => course.requirementType !== "external") ?? [];
  const commit = (value: string) => {
    const match = matchCourseTarget(value, catalog?.courses ?? []);
    setCourseTargetCode(match);
    setDraft(match ?? "");
  };
  return (
    <div className="target-control">
      <Target size={16} aria-hidden="true" />
      <label>
        My Target
        <input
          list="course-target-options"
          value={draft}
          placeholder="CS 6510"
          aria-label="Target course"
          autoComplete="off"
          onChange={(event) => {
            const value = event.target.value;
            setDraft(value);
            const match = matchCourseTarget(value, catalog?.courses ?? []);
            if (match && match.replace(/\s/g, "") === value.toUpperCase().replace(/\s/g, "")) {
              setCourseTargetCode(match);
            }
          }}
          onBlur={() => commit(draft)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit(draft);
            }
          }}
        />
      </label>
      <datalist id="course-target-options">
        {options.map((course) => (
          <option key={course.code} value={course.code} label={`${course.code} · ${course.title}`} />
        ))}
      </datalist>
      <Link href={courseTargetCode ? `${routes.explore}` : routes.paths}>{courseTargetCode ? "Path" : "Paths"}</Link>
    </div>
  );
}

export function TargetPathCard({ compact = false }: { compact?: boolean }) {
  const { catalog, plan, courseTargetCode, setCourseTargetCode, addTargetChain, openCourse, hydrated } = useApp();
  const snapshot = useMemo(
    () => (catalog && courseTargetCode ? targetPathSnapshot(courseTargetCode, catalog.courses, plan) : null),
    [catalog, courseTargetCode, plan],
  );
  if (!courseTargetCode) {
    return (
      <section className="target-path-card" id="target-path" aria-label="Path to target">
        <div className="target-path-heading">
          <span className="status-kicker"><Target size={15} /> Path to target</span>
        </div>
        <p className="muted">Choose a target course to see completed work, remaining prerequisites, and the earliest feasible term.</p>
      </section>
    );
  }
  if (!catalog || !snapshot) {
    return (
      <section className="target-path-card" id="target-path" aria-label="Path to target">
        <p className="muted">Catalog is still loading the path for {courseTargetCode}.</p>
      </section>
    );
  }
  const { path, earliest } = snapshot;
  const error = path.status !== "ok" || (earliest.reason !== "ok" && earliest.reason !== "already-recorded");
  const canAdd = hydrated && earliest.placements.length > 0 && earliest.reason === "ok";
  const submit = (event: FormEvent) => {
    event.preventDefault();
    addTargetChain();
  };
  return (
    <section className={`target-path-card ${error ? "has-error" : ""}`} id="target-path" aria-label="Path to target">
      <div className="target-path-heading">
        <span className="status-kicker"><Target size={15} /> Path to {path.target}</span>
        <p className="target-path-summary">{earliest.summary}</p>
        <button type="button" className="text-button" onClick={() => setCourseTargetCode(null)}>Clear target</button>
      </div>
      {error ? (
        <p className="inline-warning"><CircleAlert size={15} /><span>{earliest.summary}</span></p>
      ) : (
        <ol className={`target-path-chain ${compact ? "compact" : ""}`}>
          {path.nodes.map((node) => (
            <li key={`${node.role}-${node.code}`} className={`target-path-node ${node.role}`}>
              <button type="button" className="code-chip" onClick={() => openCourse(node.code)}>{node.code}</button>
              <span className="muted">{node.role === "target" ? "Target" : node.role === "completed" ? "Completed" : node.role === "waived" ? "Waived" : node.role === "planned" ? "Planned" : "Remaining"}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="muted small-text">
        {earliest.usedOfferings
          ? "Earliest term uses catalog term offerings where they exist."
          : "Catalog term offerings are unknown. Earliest term packs remaining courses into your academic plan terms."}
      </p>
      {canAdd ? (
        <form onSubmit={submit} className="target-path-cta">
          <button type="submit" className="button button-primary">
            <CalendarPlus size={15} /> Add missing chain
          </button>
          <Link className="text-link" href={targetPathHref}>Open in Plan</Link>
        </form>
      ) : earliest.reason === "ok" || earliest.reason === "already-recorded" ? null : (
        <p className="muted small-text">Add missing chain is unavailable until this path can be scheduled. Why-blocked details are a follow-up.</p>
      )}
    </section>
  );
}

export function SetAsTargetButton({ code, compact = false }: { code: string; compact?: boolean }) {
  const { courseTargetCode, setCourseTargetCode } = useApp();
  if (courseTargetCode === code) {
    return compact ? <span className="status-label">Current target</span> : <span className="status-label">Current target</span>;
  }
  return (
    <button
      type="button"
      className={compact ? "text-button" : "button button-secondary button-small"}
      onClick={() => setCourseTargetCode(code)}
    >
      <Target size={14} /> Set as target
    </button>
  );
}
