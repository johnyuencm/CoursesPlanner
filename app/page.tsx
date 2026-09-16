"use client";

import Link from "next/link";
import { ArrowUpRight, GraduationCap, KeyRound, Share2, Target } from "lucide-react";
import pathwayConfig from "@/config/pathways.json";
import { useApp } from "@/components/app-provider";
import { CatalogState } from "@/components/catalog-state";
import { OfficialLink, PageHeading } from "@/components/ui";
import { overviewSnapshot } from "@/lib/overview";
import { routes } from "@/lib/routes";
import { targetPathSnapshot } from "@/lib/target-path";
import type { Pathway } from "@/lib/types";

const pathways = pathwayConfig as Pathway[];

export default function OverviewPage() {
  const { catalog, plan, progress, openCourse, careerTargetId, courseTargetCode } = useApp();
  if (!catalog || !progress) return <CatalogState />;
  const selectedTarget = pathways.find((pathway) => pathway.id === careerTargetId) ?? null;
  const path = courseTargetCode ? targetPathSnapshot(courseTargetCode, catalog.courses, plan) : null;
  const snapshot = overviewSnapshot({
    catalog,
    plan,
    progress,
    targetName: path ? path.earliest.summary : selectedTarget?.name ?? null,
  });
  const nextUnlockLabel = snapshot.nextUnlock
    ? snapshot.nextUnlock.unlocks.length
      ? `${snapshot.nextUnlock.code} unlocks ${snapshot.nextUnlock.unlocks.length} course${snapshot.nextUnlock.unlocks.length === 1 ? "" : "s"}`
      : `${snapshot.nextUnlock.code} is open to take`
    : "No remaining eligible course";
  return (
    <div className="overview-stack">
      <PageHeading
        title="Overview"
        description="A lightweight snapshot of your local plan. Explore the course map to understand what every course unlocks."
      />
      <section className="status-card-row four" aria-label="Plan snapshot">
        <article className="status-card">
          <span className="status-kicker"><GraduationCap size={15} /> Credits</span>
          <strong>{snapshot.credits.current} / {snapshot.credits.required}</strong>
          <p className="muted">Modeled from your local plan. Not an official degree audit.</p>
        </article>
        <article className="status-card">
          <span className="status-kicker"><Target size={15} /> Target</span>
          <strong>{courseTargetCode ?? snapshot.targetName ?? "No target yet"}</strong>
          <p className="muted">
            {path
              ? path.earliest.summary
              : snapshot.targetName
                ? "Career direction for Paths."
                : "Choose a target course from Explore or the My Target control."}
          </p>
        </article>
        <article className="status-card">
          <span className="status-kicker"><KeyRound size={15} /> Critical prereq</span>
          {snapshot.criticalPrereq ? (
            <>
              <strong>
                <button className="text-button" onClick={() => openCourse(snapshot.criticalPrereq!.courseCode)}>
                  {snapshot.criticalPrereq.courseCode}
                </button>
              </strong>
              <p className="muted">{snapshot.criticalPrereq.message}</p>
            </>
          ) : (
            <>
              <strong>None blocking</strong>
              <p className="muted">No prerequisite or corequisite issue in this plan.</p>
            </>
          )}
        </article>
        <article className="status-card">
          <span className="status-kicker"><Share2 size={15} /> Next unlock</span>
          {snapshot.nextUnlock ? (
            <>
              <strong>
                <button className="text-button" onClick={() => openCourse(snapshot.nextUnlock!.code)}>
                  {snapshot.nextUnlock.code}
                </button>
              </strong>
              <p className="muted">{nextUnlockLabel}</p>
            </>
          ) : (
            <>
              <strong>None left</strong>
              <p className="muted">Every remaining catalog course is recorded or still locked.</p>
            </>
          )}
        </article>
      </section>
      <section className="overview-entry-card">
        <h2>Understand what every course unlocks</h2>
        <p>
          The course map is the product. Select any MSCS Seattle course to see what it requires and what it opens next.
          Plan, Courses, and Paths orbit that graph — this page is only a status doorway.
        </p>
        <div className="overview-entry-actions">
          <Link className="button button-primary" href={routes.explore}>Explore my course map</Link>
          <OfficialLink href={catalog.requirements.officialUrl} sources={catalog.sources}>Official program requirements</OfficialLink>
          <Link className="text-link" href={routes.plan}>Open plan <ArrowUpRight size={14} /></Link>
        </div>
      </section>
    </div>
  );
}
