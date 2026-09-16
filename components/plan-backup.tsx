"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Download, Upload } from "lucide-react";
import { canRestorePlanBackup, MAX_PLAN_BACKUP_BYTES, parsePlanBackup, summarizePlan } from "@/lib/plan";
import type { StudentPlan } from "@/lib/types";
import { useApp } from "./app-provider";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The backup could not be read.";
}

function CurrentPlanSummary({ plan }: { plan: StudentPlan }) {
  const summary = summarizePlan(plan);
  return <div className="plan-backup-summary" aria-label="Current plan summary">
    <p>
      <strong>Current plan on this device.</strong>{" "}
      {summary.termCount} term{summary.termCount === 1 ? "" : "s"}, {summary.plannedCourseCount} planned course{summary.plannedCourseCount === 1 ? "" : "s"}, {summary.completedCount} completed, {summary.waivedCount} waived.
    </p>
    {summary.terms.length > 0 && <ul>{summary.terms.map((term) => <li key={term.id}><strong>{term.name}</strong>{term.courseCodes.length ? `: ${term.courseCodes.join(", ")}` : " (empty)"}</li>)}</ul>}
    {summary.completedCourses.length > 0 && <p>Completed: {summary.completedCourses.join(", ")}</p>}
    {summary.waivedCourses.length > 0 && <p>Waived: {summary.waivedCourses.join(", ")}</p>}
  </div>;
}

export function PlanBackup() {
  const { catalog, exportPlanBackup, restorePlanBackup, hydrated, persistence, plan } = useApp();
  const fileInput = useRef<HTMLInputElement>(null);
  const reading = useRef(false);
  const mounted = useRef(true);
  const [isReading, setIsReading] = useState(false);
  const [message, setMessage] = useState("");
  const [acknowledgedOutageRestore, setAcknowledgedOutageRestore] = useState(false);
  const catalogAvailable = catalog !== null;
  const storageBlocked = persistence === "blocked";
  const restoreEnabled = !isReading && canRestorePlanBackup({
    hydrated,
    catalogAvailable,
    acknowledgedOutageRestore,
  });

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (catalogAvailable) setAcknowledgedOutageRestore(false);
  }, [catalogAvailable]);

  const exportBackup = () => {
    try {
      const download = exportPlanBackup();
      const blob = new Blob([download.body], { type: download.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = download.filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setMessage(download.message);
    } catch (error) {
      setMessage(`Backup could not be created: ${errorMessage(error)}`);
    }
  };

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || reading.current || !restoreEnabled) return;
    if (file.size > MAX_PLAN_BACKUP_BYTES) {
      setMessage("Backup could not be restored: the file is larger than 1 MB. Your current plan is unchanged.");
      return;
    }

    reading.current = true;
    setIsReading(true);
    try {
      const candidate = parsePlanBackup(await file.text());
      if (!mounted.current) return;
      if (!window.confirm("Restore this backup? It permanently replaces the current plan on this device. Download a backup first if you may need the current plan.")) {
        setMessage("Backup restore cancelled. Your current plan is unchanged.");
        return;
      }
      if (restorePlanBackup(candidate)) setMessage("Backup restored and saved on this device.");
      else setMessage("Backup could not be restored because this browser could not save it. Your current plan is unchanged.");
    } catch (error) {
      if (mounted.current) setMessage(`Backup could not be restored: ${errorMessage(error)} Your current plan is unchanged.`);
    } finally {
      reading.current = false;
      if (mounted.current) setIsReading(false);
    }
  };

  return <div className={`planner-backup${catalogAvailable ? "" : " planner-backup-outage"}`} aria-label="Plan backup">
    {storageBlocked && <p className="plan-backup-banner" role="status">Saving is blocked. Download saves a recovery copy of the unreadable browser data, not the empty on-screen plan.</p>}
    {!catalogAvailable && hydrated && <>
      <p className="plan-backup-banner" role="status">The catalog is unavailable, so the semester board is hidden. Review the current plan below before restoring a backup over it.</p>
      <CurrentPlanSummary plan={plan} />
      <label className="plan-backup-ack">
        <input type="checkbox" checked={acknowledgedOutageRestore} onChange={(event) => setAcknowledgedOutageRestore(event.target.checked)} />
        I have reviewed the current plan above and want to restore a backup over it.
      </label>
    </>}
    <div className="planner-backup-actions">
      <button className="button button-secondary" type="button" disabled={!hydrated || isReading} onClick={exportBackup}><Download size={16} /> {storageBlocked ? "Download recovery copy" : "Download backup"}</button>
      <button className="button button-secondary" type="button" disabled={!restoreEnabled} title={!catalogAvailable && !acknowledgedOutageRestore ? "Review the current plan and confirm before restoring." : undefined} onClick={() => fileInput.current?.click()}><Upload size={16} /> {isReading ? "Reading backup…" : "Restore backup"}</button>
    </div>
    <input ref={fileInput} hidden aria-label="Choose a plan backup JSON file" type="file" accept="application/json,.json" onChange={importBackup} />
    <p className="muted" role="status">{message}</p>
  </div>;
}
