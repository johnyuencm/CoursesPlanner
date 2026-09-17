"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, RotateCcw } from "lucide-react";
import type { DiscoveredProgram, ProgramDirectoryResponse, ProgramRoadmap } from "@/lib/types";
import type { UniversityRoadmapSummary } from "@/catalog-service/source-types";
import {
  groupUniversities,
  isProgramSelectable,
  isUniversitySelectable,
  programDisplayName,
  programStatusText,
  sortPrograms,
  universityStatusText,
} from "@/lib/roadmaps";

type RoadmapListResponse = { universities: UniversityRoadmapSummary[] };
type PendingRequest = { token: number; controller: AbortController };
type RequestRef = { current: PendingRequest | null };

const jsonError = (data: unknown, fallback: string): string =>
  typeof data === "object" && data !== null && "error" in data && typeof (data as { error: unknown }).error === "string"
    ? (data as { error: string }).error
    : fallback;

const isAbortError = (error: unknown): boolean => error instanceof Error && error.name === "AbortError";

export type RoadmapSelectorViewProps = {
  universities: UniversityRoadmapSummary[];
  loading: boolean;
  error: string | null;
  universityId: string;
  programs: DiscoveredProgram[];
  programsLoading: boolean;
  programsError: string | null;
  programId: string;
  roadmapLoading: boolean;
  roadmapError: string | null;
  onUniversityChange: (id: string) => void;
  onProgramChange: (id: string) => void;
  onReset: () => void;
  onRetryUniversities: () => void;
  onRetryPrograms: () => void;
  onRetryRoadmap: () => void;
};

export function RoadmapSelectorView({
  universities,
  loading,
  error,
  universityId,
  programs,
  programsLoading,
  programsError,
  programId,
  roadmapLoading,
  roadmapError,
  onUniversityChange,
  onProgramChange,
  onReset,
  onRetryUniversities,
  onRetryPrograms,
  onRetryRoadmap,
}: RoadmapSelectorViewProps) {
  const { us, world } = useMemo(() => groupUniversities(universities), [universities]);
  const orderedPrograms = useMemo(() => sortPrograms(programs), [programs]);
  const readyPrograms = useMemo(() => orderedPrograms.filter(isProgramSelectable), [orderedPrograms]);
  const otherPrograms = useMemo(() => orderedPrograms.filter((program) => !isProgramSelectable(program)), [orderedPrograms]);
  const readyCount = readyPrograms.length;
  const renderProgram = (program: DiscoveredProgram) => (
    <option key={program.id} value={program.id} disabled={!isProgramSelectable(program)}>
      {programDisplayName(program)} · {programStatusText(program)}
    </option>
  );

  return (
    <section className="roadmap-selector" aria-label="University and program prerequisite roadmaps" aria-busy={loading || programsLoading || roadmapLoading}>
      <div className="roadmap-selector-heading">
        <div>
          <h2><BookOpen size={18} /> Prerequisite roadmaps</h2>
          <p className="muted small-text">Explore a ready university program without leaving the current plan. Northeastern MSCS stays the default.</p>
        </div>
        {universityId && <button type="button" className="button button-secondary button-small" onClick={onReset}><RotateCcw size={14} /> Back to Northeastern MSCS</button>}
      </div>
      <p id="roadmap-selector-guide" className="roadmap-selector-guide">Ready programs appear first. Other discovered programs stay visible with their status but cannot open until ready.</p>
      <div className="roadmap-status-guide" role="note" aria-label="Roadmap status guide">
        <strong>Status guide</strong>
        <span><b>Ready</b> can open</span>
        <span><b>Queued</b> waiting for crawl</span>
        <span><b>Unverified</b> needs review</span>
        <span><b>Unsupported</b> has no supported roadmap</span>
        <span><b>Unavailable</b> failed to load</span>
      </div>
      <div className="roadmap-selector-fields">
        <label className="field-label" htmlFor="roadmap-university">University
          <select id="roadmap-university" aria-describedby="roadmap-selector-guide" value={universityId} disabled={loading} onChange={(event) => onUniversityChange(event.target.value)}>
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
            <select id="roadmap-program" aria-describedby="roadmap-selector-guide" value={programId} disabled={programsLoading} onChange={(event) => onProgramChange(event.target.value)}>
              <option value="">Choose a ready program</option>
              {readyPrograms.length ? <optgroup label={`Ready programs (${readyPrograms.length})`}>{readyPrograms.map(renderProgram)}</optgroup> : null}
              {otherPrograms.length ? <optgroup label="Other discovered programs (not ready)">{otherPrograms.map(renderProgram)}</optgroup> : null}
            </select>
          </label>
        )}
      </div>
      <div className="roadmap-selector-status" role="status" aria-live="polite">
        {loading ? <span>Loading universities…</span>
          : error ? <span className="roadmap-selector-error">Unable to load universities: {error} <button type="button" className="text-button" onClick={onRetryUniversities}>Retry loading universities</button></span>
          : !universityId ? <span className="muted">Select a university to browse its ready programs.</span>
          : programsLoading ? <span>Loading programs…</span>
          : programsError ? <span className="roadmap-selector-error">Unable to load programs: {programsError} <button type="button" className="text-button" onClick={onRetryPrograms}>Retry loading programs</button></span>
          : !programs.length ? <span className="muted">No programs discovered for this university yet.</span>
          : roadmapLoading ? <span>Loading roadmap…</span>
          : roadmapError ? <span className="roadmap-selector-error">Unable to load roadmap: {roadmapError} <button type="button" className="text-button" onClick={onRetryRoadmap}>Retry loading roadmap</button></span>
          : programId ? <span>Showing the selected roadmap.</span>
          : <span className="muted">{readyCount} ready program{readyCount === 1 ? "" : "s"} · other programs are still being crawled.</span>}
      </div>
    </section>
  );
}

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
  const requestSequence = useRef(0);
  const universityRequest = useRef<PendingRequest | null>(null);
  const programsRequest = useRef<PendingRequest | null>(null);
  const roadmapRequest = useRef<PendingRequest | null>(null);

  const beginRequest = (request: RequestRef): PendingRequest => {
    request.current?.controller.abort();
    const pending = { token: ++requestSequence.current, controller: new AbortController() };
    request.current = pending;
    return pending;
  };
  const isCurrent = (request: RequestRef, pending: PendingRequest): boolean =>
    request.current?.token === pending.token && !pending.controller.signal.aborted;
  const cancelRequest = (request: RequestRef) => {
    request.current?.controller.abort();
    request.current = null;
  };
  const cancelAll = () => {
    cancelRequest(universityRequest);
    cancelRequest(programsRequest);
    cancelRequest(roadmapRequest);
  };

  const loadUniversities = async () => {
    const pending = beginRequest(universityRequest);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/roadmaps", { cache: "no-store", signal: pending.controller.signal });
      const data = (await response.json()) as RoadmapListResponse & { error?: string };
      if (!response.ok) throw new Error(jsonError(data, "Universities could not be loaded."));
      if (!isCurrent(universityRequest, pending)) return;
      setUniversities(data.universities);
    } catch (err) {
      if (!isCurrent(universityRequest, pending) || isAbortError(err)) return;
      setError(err instanceof Error ? err.message : "Universities could not be loaded.");
    } finally {
      if (isCurrent(universityRequest, pending)) {
        universityRequest.current = null;
        setLoading(false);
      }
    }
  };

  const loadPrograms = async (id: string) => {
    const pending = beginRequest(programsRequest);
    setProgramsLoading(true);
    setProgramsError(null);
    try {
      const response = await fetch(`/api/roadmaps?university=${encodeURIComponent(id)}`, { cache: "no-store", signal: pending.controller.signal });
      const data = (await response.json()) as ProgramDirectoryResponse & { error?: string };
      if (!response.ok) throw new Error(jsonError(data, "Programs could not be loaded."));
      if (!isCurrent(programsRequest, pending)) return;
      setPrograms(data.programs);
    } catch (err) {
      if (!isCurrent(programsRequest, pending) || isAbortError(err)) return;
      setProgramsError(err instanceof Error ? err.message : "Programs could not be loaded.");
    } finally {
      if (isCurrent(programsRequest, pending)) {
        programsRequest.current = null;
        setProgramsLoading(false);
      }
    }
  };

  const loadRoadmap = async (selectedUniversityId: string, selectedProgramId: string) => {
    const pending = beginRequest(roadmapRequest);
    setRoadmapLoading(true);
    setRoadmapError(null);
    try {
      const response = await fetch(
        `/api/roadmaps?university=${encodeURIComponent(selectedUniversityId)}&program=${encodeURIComponent(selectedProgramId)}`,
        { cache: "no-store", signal: pending.controller.signal },
      );
      const data = (await response.json()) as ProgramRoadmap & { error?: string };
      if (!response.ok) throw new Error(jsonError(data, "Roadmap could not be loaded."));
      if (!isCurrent(roadmapRequest, pending)) return;
      onRoadmapChange(data);
    } catch (err) {
      if (!isCurrent(roadmapRequest, pending) || isAbortError(err)) return;
      setRoadmapError(err instanceof Error ? err.message : "Roadmap could not be loaded.");
    } finally {
      if (isCurrent(roadmapRequest, pending)) {
        roadmapRequest.current = null;
        setRoadmapLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadUniversities();
    return cancelAll;
  }, []);

  const selectUniversity = (id: string) => {
    cancelRequest(programsRequest);
    cancelRequest(roadmapRequest);
    setProgramsLoading(false);
    setRoadmapLoading(false);
    setUniversityId(id);
    setProgramId("");
    setPrograms([]);
    setProgramsError(null);
    setRoadmapError(null);
    onRoadmapChange(null);
    if (id) void loadPrograms(id);
  };

  const selectProgram = (id: string) => {
    const selectedUniversityId = universityId;
    cancelRequest(roadmapRequest);
    setRoadmapLoading(false);
    setProgramId(id);
    setRoadmapError(null);
    onRoadmapChange(null);
    if (id && selectedUniversityId) void loadRoadmap(selectedUniversityId, id);
  };

  const reset = () => {
    cancelRequest(programsRequest);
    cancelRequest(roadmapRequest);
    setUniversityId("");
    setProgramId("");
    setPrograms([]);
    setProgramsLoading(false);
    setProgramsError(null);
    setRoadmapLoading(false);
    setRoadmapError(null);
    onRoadmapChange(null);
  };

  return <RoadmapSelectorView
    universities={universities}
    loading={loading}
    error={error}
    universityId={universityId}
    programs={programs}
    programsLoading={programsLoading}
    programsError={programsError}
    programId={programId}
    roadmapLoading={roadmapLoading}
    roadmapError={roadmapError}
    onUniversityChange={selectUniversity}
    onProgramChange={selectProgram}
    onReset={reset}
    onRetryUniversities={() => void loadUniversities()}
    onRetryPrograms={() => { if (universityId) void loadPrograms(universityId); }}
    onRetryRoadmap={() => { if (universityId && programId) void loadRoadmap(universityId, programId); }}
  />;
}
