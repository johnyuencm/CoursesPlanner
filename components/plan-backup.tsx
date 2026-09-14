"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Download, Upload } from "lucide-react";
import { MAX_PLAN_BACKUP_BYTES, parsePlanBackup } from "@/lib/plan";
import { useApp } from "./app-provider";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The backup could not be read.";
}

export function PlanBackup() {
  const { exportPlanBackup, restorePlanBackup, hydrated } = useApp();
  const fileInput = useRef<HTMLInputElement>(null);
  const reading = useRef(false);
  const mounted = useRef(true);
  const [isReading, setIsReading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const exportBackup = () => {
    try {
      const blob = new Blob([exportPlanBackup()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "course-plan-backup.json";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setMessage("Backup downloaded. This is separate from the saved-on-this-device status.");
    } catch (error) {
      setMessage(`Backup could not be created: ${errorMessage(error)}`);
    }
  };

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || reading.current || !hydrated) return;
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

  return <div className="planner-backup" aria-label="Plan backup">
    <button className="button button-secondary" type="button" disabled={!hydrated || isReading} onClick={exportBackup}><Download size={16} /> Download backup</button>
    <button className="button button-secondary" type="button" disabled={!hydrated || isReading} onClick={() => fileInput.current?.click()}><Upload size={16} /> {isReading ? "Reading backup…" : "Restore backup"}</button>
    <input ref={fileInput} hidden aria-label="Choose a plan backup JSON file" type="file" accept="application/json,.json" onChange={importBackup} />
    <p className="muted" role="status">{message}</p>
  </div>;
}
