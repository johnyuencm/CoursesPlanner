"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, RotateCcw } from "lucide-react";
import type { DiscoveredProgram, ProgramDirectoryResponse, ProgramRoadmap } from "@/lib/types";
import type { UniversityRoadmapSummary } from "@/catalog-service/source-types";
import {
  groupUniversities,
  isProgramSelectable,
  isUniversitySelectable,
  programStatusText,
  universityStatusText,
} from "@/lib/roadmaps";

type RoadmapListResponse = { universities: UniversityRoadmapSummary[] };

const jsonError = (data: unknown, fallback: string): string =>
  typeof data === "object" && data !== null && "error" in data && typeof (data as { error: unknown }).error === "string"
    ? (data as { error: string }).error
    : fallback;

export function RoadmapSelector({ onRoadmapChange }: { onRoadmapChange: (roadmap: ProgramRoadmap | null) => void }) {
  const [universities, setUniversities] = useState<UniversityRoadmapSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [universityId, setUniversityId] = useState("");
  const [programs, setPrograms] = useState<DiscoveredProgram[]>([]);
  const [programsLoading, setProgramsLoading] = useState(false);
  const [programsError, setProgramsError] = useState<string | null>(null);
  const [programId, setProgramId] = useState("");
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [roadmapError, setRoadmapError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/roadmaps", { cache: "no-store" });
        const data = (await response.json()) as RoadmapListResponse & { error?: string };
        if (!response.ok) throw new Error(jsonError(data, "Universities could not be loaded."));
        setUniversities(data.universities);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Universities could not be loaded.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectUniversity = async (id: string) => {
    setUniversityId(id);
    setProgramId("");
    setPrograms([]);
    setProgramsError(null);
    setRoadmapError(null);
    onRoadmapChange(null);
    if (!id) return;
    setProgramsLoading(true);
    try {
      const response = await fetch(`/api/roadmaps?university=${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = (await response.json()) as ProgramDirectoryResponse & { error?: string };
      if (!response.ok) throw new Error(jsonError(data, "Programs could not be loaded."));
      setPrograms(data.programs);
    } catch (err) {
      setProgramsError(err instanceof Error ? err.message : "Programs could not be loaded.");
    } finally {
      setProgramsLoading(false);
    }
  };

  const selectProgram = async (id: string) => {
    setProgramId(id);
    setRoadmapError(null);
    onRoadmapChange(null);
    if (!id || !universityId) return;
    setRoadmapLoading(true);
    try {
      const response = await fetch(
        `/api/roadmaps?university=${encodeURIComponent(universityId)}&program=${encodeURIComponent(id)}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as ProgramRoadmap & { error?: string };
      if (!response.ok) throw new Error(jsonError(data, "Roadmap could not be loaded."));
      onRoadmapChange(data);
    } catch (err) {
      setRoadmapError(err instanceof Error ? err.message : "Roadmap could not be loaded.");
    } finally {
      setRoadmapLoading(false);
    }
  };

  const reset = () => {
    setUniversityId("");
    setProgramId("");
    setPrograms([]);
    setProgramsError(null);
    setRoadmapError(null);
    onRoadmapChange(null);
  };

  const { us, world } = useMemo(() => groupUniversities(universities), [universities]);
  const readyCount = useMemo(() => programs.filter(isProgramSelectable).length, [programs]);

  return (
    <section className="roadmap-selector" aria-label="University and program prerequisite roadmaps">
      <div className="roadmap-selector-heading">
        <div>
          <h2><BookOpen size={18} /> Prerequisite roadmaps</h2>
          <p className="muted small-text">Explore a ready university program without leaving the current plan. Northeastern MSCS stays the default.</p>
        </div>
        {universityId && <button type="button" className="button button-secondary button-small" onClick={reset}><RotateCcw size={14} /> Back to Northeastern MSCS</button>}
      </div>
      <div className="roadmap-selector-fields">
        <label className="field-label" htmlFor="roadmap-university">University
          <select id="roadmap-university" value={universityId} disabled={loading || Boolean(error)} onChange={(event) => void selectUniversity(event.target.value)}>
            <option value="">Northeastern MSCS (default)</option>
            <optgroup label="United States">
              {us.map((entry) => (
                <option key={entry.id} value={entry.id} disabled={!isUniversitySelectable(entry)}>
                  {entry.university} · {universityStatusText(entry)}
                </option>
              ))}
            </optgroup>
            <optgroup label="World">
              {world.map((entry) => (
                <option key={entry.id} value={entry.id} disabled={!isUniversitySelectable(entry)}>
                  {entry.university} · {universityStatusText(entry)}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        {universityId && (
          <label className="field-label" htmlFor="roadmap-program">Program
            <select id="roadmap-program" value={programId} disabled={programsLoading || Boolean(programsError)} onChange={(event) => void selectProgram(event.target.value)}>
              <option value="">Choose a ready program</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id} disabled={!isProgramSelectable(program)}>
                  {program.name ?? program.id} · {programStatusText(program)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="roadmap-selector-status" role="status" aria-live="polite">
        {loading ? <span>Loading universities…</span>
          : error ? <span className="muted">Unable to load universities: {error}</span>
          : !universityId ? <span className="muted">Select a university to browse its ready programs.</span>
          : programsLoading ? <span>Loading programs…</span>
          : programsError ? <span className="muted">Unable to load programs: {programsError}</span>
          : !programs.length ? <span className="muted">No programs discovered for this university yet.</span>
          : roadmapLoading ? <span>Loading roadmap…</span>
          : roadmapError ? <span className="muted">Unable to load roadmap: {roadmapError}</span>
          : programId ? <span>Showing the selected roadmap.</span>
          : <span className="muted">{readyCount} ready program{readyCount === 1 ? "" : "s"} · other programs are still being crawled.</span>}
      </div>
    </section>
  );
}
