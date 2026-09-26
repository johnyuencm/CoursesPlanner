"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { CalendarPlus, CircleAlert, Lock, Target, TriangleAlert } from "lucide-react";
import { previewChainInsert, type ChainInsertPreview } from "@/lib/plan";
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

const roleLabel = (role: ChainInsertPreview["nodes"][number]["role"]) =>
  role === "target" ? "Target" : role === "completed" ? "Completed" : role === "waived" ? "Waived" : role === "planned" ? "Planned" : "Remaining";

export function PrerequisiteChainView({
  preview,
  compact = false,
  kicker,
  onSelectCode,
  onApply,
  applyEnabled,
  extraHeading,
  extraFooter,
}: {
  preview: ChainInsertPreview;
  compact?: boolean;
  kicker: ReactNode;
  onSelectCode: (code: string) => void;
  onApply: () => void;
  applyEnabled: boolean;
  extraHeading?: ReactNode;
  extraFooter?: ReactNode;
}) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (applyEnabled && preview.canApply) onApply();
  };
  const errors = preview.conflicts.filter((item) => item.severity === "error");
  const warnings = preview.conflicts.filter((item) => item.severity === "warning");
  return (
    <>
      <div className="target-path-heading">
        <span className="status-kicker">{kicker}</span>
        <p className="target-path-summary">{preview.summary}</p>
        {extraHeading}
      </div>
      {preview.blocked ? (
        <div className="why-blocked-copy">
          <p className="why-blocked-title">Why can&apos;t I take this?</p>
          <ul className="why-blocked-reasons">
            {preview.why.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {preview.nodes.length ? (
        <ol className={`target-path-chain ${compact ? "compact" : ""}`}>
          {preview.nodes.map((node) => (
            <li key={`${node.role}-${node.code}`} className={`target-path-node ${node.role}`}>
              <button type="button" className="code-chip" onClick={() => onSelectCode(node.code)}>{node.code}</button>
              <span className="muted">{roleLabel(node.role)}</span>
            </li>
          ))}
        </ol>
      ) : errors.length ? (
        <p className="inline-warning"><CircleAlert size={15} /><span>{preview.summary}</span></p>
      ) : null}
      {preview.earliestTermName ? (
        <p className="muted small-text">Earliest term for {preview.code}: <strong>{preview.earliestTermName}</strong>.</p>
      ) : null}
      {preview.reusedCodes.length ? (
        <p className="muted small-text">Keeps existing plan/history for {preview.reusedCodes.join(", ")}.</p>
      ) : null}
      {preview.termLoads.length ? (
        <ul className="chain-load-list" aria-label="Proposed term placements">
          {preview.termLoads.map((load) => (
            <li key={load.termName} className={load.overload ? "overload" : undefined}>
              <strong>{load.termName}</strong>
              <span>{load.addedCodes.join(", ")}</span>
              <span className="muted">{load.totalCredits} cr{load.created ? " · new term" : ""}{load.overload ? " · overload" : ""}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {warnings.length ? (
        <ul className="why-blocked-conflicts warning">
          {warnings.map((item) => (
            <li key={item.message}><TriangleAlert size={14} /> {item.message}</li>
          ))}
        </ul>
      ) : null}
      {errors.length ? (
        <ul className="why-blocked-conflicts error">
          {errors.map((item) => (
            <li key={item.message}><CircleAlert size={14} /> {item.message}</li>
          ))}
        </ul>
      ) : null}
      {preview.canApply ? (
        <form onSubmit={submit} className="target-path-cta">
          <button type="submit" className="button button-primary" disabled={!applyEnabled}>
            <CalendarPlus size={15} /> Add prerequisite chain to plan
          </button>
          {extraFooter}
        </form>
      ) : preview.applyBlockedReason && preview.summary !== preview.applyBlockedReason ? (
        <p className="muted small-text">{preview.applyBlockedReason}</p>
      ) : extraFooter ? (
        <div className="target-path-cta">{extraFooter}</div>
      ) : null}
    </>
  );
}

export function TargetPathCard({ compact = false }: { compact?: boolean }) {
  const { catalog, plan, courseTargetCode, setCourseTargetCode, addPrerequisiteChain, openCourse, hydrated } = useApp();
  const snapshot = useMemo(
    () => (catalog && courseTargetCode ? targetPathSnapshot(courseTargetCode, catalog.courses, plan) : null),
    [catalog, courseTargetCode, plan],
  );
  const preview = useMemo(
    () => (catalog && courseTargetCode ? previewChainInsert(courseTargetCode, catalog.courses, plan, catalog) : null),
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
  if (!catalog || !snapshot || !preview) {
    return (
      <section className="target-path-card" id="target-path" aria-label="Path to target">
        <p className="muted">Catalog is still loading the path for {courseTargetCode}.</p>
      </section>
    );
  }
  const error = snapshot.path.status !== "ok" || (snapshot.earliest.reason !== "ok" && snapshot.earliest.reason !== "already-recorded");
  return (
    <section className={`target-path-card ${error || preview.blocked ? "has-error" : ""}`} id="target-path" aria-label="Path to target">
      <PrerequisiteChainView
        preview={preview}
        compact={compact}
        kicker={<><Target size={15} /> Path to {snapshot.path.target}</>}
        onSelectCode={openCourse}
        onApply={() => addPrerequisiteChain(courseTargetCode)}
        applyEnabled={hydrated}
        extraHeading={<button type="button" className="text-button" onClick={() => setCourseTargetCode(null)}>Clear target</button>}
        extraFooter={<Link className="text-link" href={targetPathHref}>Open in Plan</Link>}
      />
      <p className="muted small-text">
        {snapshot.earliest.usedOfferings
          ? "Earliest term uses catalog term offerings where they exist."
          : "Catalog term offerings are unknown. Earliest term packs remaining courses into your academic plan terms."}
      </p>
    </section>
  );
}

export function WhyBlockedCard({
  code,
  compact = false,
  id = "why-blocked",
}: {
  code: string;
  compact?: boolean;
  id?: string;
}) {
  const { catalog, plan, addPrerequisiteChain, openCourse, hydrated } = useApp();
  const preview = useMemo(
    () => (catalog ? previewChainInsert(code, catalog.courses, plan, catalog) : null),
    [catalog, code, plan],
  );
  if (!catalog || !preview || !preview.blocked) return null;
  return (
    <section className={`target-path-card why-blocked-card ${preview.canApply ? "" : "has-error"}`} id={id} aria-label={`Why ${code} is blocked`}>
      <PrerequisiteChainView
        preview={preview}
        compact={compact}
        kicker={<><Lock size={15} /> Blocked · {code}</>}
        onSelectCode={openCourse}
        onApply={() => addPrerequisiteChain(code)}
        applyEnabled={hydrated}
      />
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
