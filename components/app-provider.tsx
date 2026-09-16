"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { Catalog, DegreeProgress, StudentPlan } from "@/lib/types";
import {
  DEFAULT_WORKSPACE_SELECTION,
  parseWorkspaceSelection,
  sameWorkspaceSelection,
  WORKSPACE_SELECTION_KEY,
  type WorkspaceSelection,
} from "@/lib/graph";
import {
  addableLineCourses,
  addableProgramCodes,
  appendCoursesToSemester,
  applyRemainingPathToPlan,
  createPlanBackupDownload,
  emptyPlan,
  loadPlan,
  parsePlan,
  recordedCourseCodes,
  restorePlan,
  STORAGE_KEY,
  suggestedPrerequisiteFix,
  type PlanBackupDownload,
} from "@/lib/plan";
import { targetPathSnapshot } from "@/lib/target-path";
import { validatePlan } from "@/lib/validation";

type PickerState = { semesterId?: string; courseCode?: string } | null;
type CourseStatus = "completed" | "waived" | "none";
type PersistenceStatus = "loading" | "saved" | "blocked" | "error";

interface AppContextValue {
  catalog: Catalog | null;
  catalogBusy: boolean;
  catalogError: string | null;
  catalogMessage: string | null;
  refreshCatalog: () => Promise<void>;
  plan: StudentPlan;
  setPlan: Dispatch<SetStateAction<StudentPlan>>;
  progress: DegreeProgress | null;
  hydrated: boolean;
  persistence: PersistenceStatus;
  storageError: string | null;
  retrySave: () => void;
  resetPlan: () => void;
  exportPlanBackup: () => PlanBackupDownload;
  restorePlanBackup: (candidate: StudentPlan) => boolean;
  detailCode: string | null;
  openCourse: (code: string | null) => void;
  picker: PickerState;
  openPicker: (semesterId?: string, courseCode?: string) => void;
  closePicker: () => void;
  setCourseStatus: (code: string, status: CourseStatus, credits?: number) => void;
  addCourse: (code: string, semesterId: string, credits: number, includeCorequisite?: boolean) => void;
  addCourses: (codes: Iterable<string>, semesterId: string) => void;
  careerTargetId: string | null;
  setCareerTargetId: (id: string | null) => void;
  courseTargetCode: string | null;
  setCourseTargetCode: (code: string | null) => void;
  addTargetChain: () => void;
  workspaceSelection: WorkspaceSelection;
  setWorkspaceSelection: (next: WorkspaceSelection) => void;
  notice: string;
  announce: (message: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);
const CAREER_TARGET_KEY = "neu-mscs-career-target-v1";
const COURSE_TARGET_KEY = "neu-mscs-course-target-v1";

let sessionCatalog: Catalog | null = null;
let catalogGetInflight: Promise<Catalog> | null = null;

function isCatalogPayload(data: unknown): data is Catalog {
  if (!data || typeof data !== "object") return false;
  const value = data as Catalog;
  return (
    Array.isArray(value.courses) &&
    Boolean(value.requirements) &&
    Array.isArray(value.requirements.coreCourses) &&
    Array.isArray(value.requirements.breadthRequirements?.categories) &&
    typeof value.requirements.totalCredits === "number"
  );
}

async function loadCatalogFromNetwork(refresh: boolean): Promise<{ catalog: Catalog; refreshStatus: string | null }> {
  const response = await fetch("/api/catalog", { method: refresh ? "POST" : "GET", cache: "no-store" });
  const refreshStatus = response.headers.get("x-catalog-refresh");
  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
        ? data.error
        : "The catalog could not be loaded.",
    );
  }
  if (!isCatalogPayload(data)) throw new Error("The catalog response is incomplete. Your previous catalog has been retained.");
  sessionCatalog = data;
  return { catalog: data, refreshStatus };
}

async function requestCatalog(refresh: boolean): Promise<{ catalog: Catalog; refreshStatus: string | null }> {
  if (!refresh && sessionCatalog) return { catalog: sessionCatalog, refreshStatus: null };
  if (!refresh) {
    if (!catalogGetInflight) {
      catalogGetInflight = loadCatalogFromNetwork(false).then((result) => result.catalog).finally(() => {
        catalogGetInflight = null;
      });
    }
    return { catalog: await catalogGetInflight, refreshStatus: null };
  }
  return loadCatalogFromNetwork(true);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogBusy, setCatalogBusy] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogMessage, setCatalogMessage] = useState<string | null>(null);
  const [plan, setPlan] = useState<StudentPlan>(() => emptyPlan());
  const [hydrated, setHydrated] = useState(false);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [blockedRawStorage, setBlockedRawStorage] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [persistence, setPersistence] = useState<PersistenceStatus>("loading");
  const [detailCode, openCourse] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerState>(null);
  const [notice, announce] = useState("");
  const [careerTargetId, setCareerTargetIdState] = useState<string | null>(null);
  const [courseTargetCode, setCourseTargetCodeState] = useState<string | null>(null);
  // Graph/plan selection is independent of course-level My Target (`courseTargetCode`).
  const [workspaceSelection, setWorkspaceSelectionState] = useState<WorkspaceSelection>(DEFAULT_WORKSPACE_SELECTION);

  const fetchCatalog = useCallback(async (refresh: boolean) => {
    setCatalogBusy(true);
    setCatalogError(null);
    setCatalogMessage(null);
    try {
      if (refresh) sessionCatalog = null;
      const { catalog: nextCatalog, refreshStatus } = await requestCatalog(refresh);
      setCatalog(nextCatalog);
      if (refresh) {
        setCatalogMessage(refreshStatus === "cooldown"
          ? "Refresh cooldown active. The current validated catalog remains loaded."
          : "Catalog cache rebuilt. Any stale-source fallbacks remain listed in catalog warnings.");
      }
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : "Unable to reach the catalog. Try again.");
    } finally { setCatalogBusy(false); }
  }, []);

  useEffect(() => { void fetchCatalog(false); }, [fetchCatalog]);
  useEffect(() => {
    try {
      const loaded = loadPlan(window.localStorage);
      setPlan(loaded.plan);
      if (loaded.error) {
        setStorageBlocked(true);
        setBlockedRawStorage(loaded.raw);
        setStorageError(loaded.error);
        setPersistence("blocked");
      }
    } catch (error) {
      setStorageBlocked(true);
      setBlockedRawStorage(null);
      setStorageError(error instanceof Error ? error.message : "Browser storage is unavailable.");
      setPersistence("blocked");
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CAREER_TARGET_KEY);
      if (saved) setCareerTargetIdState(saved);
    } catch {
      /* Career target is optional; plan persistence is separate. */
    }
    try {
      const saved = window.localStorage.getItem(COURSE_TARGET_KEY);
      if (saved) setCourseTargetCodeState(saved);
    } catch {
      /* Course target is optional; plan persistence is separate. */
    }
    try {
      const saved = window.localStorage.getItem(WORKSPACE_SELECTION_KEY);
      if (saved) setWorkspaceSelectionState(parseWorkspaceSelection(JSON.parse(saved)));
    } catch {
      /* Graph/plan selection is optional; plan persistence is separate. */
    }
  }, []);
  const setCareerTargetId = useCallback((id: string | null) => {
    setCareerTargetIdState(id);
    try {
      if (id) window.localStorage.setItem(CAREER_TARGET_KEY, id);
      else window.localStorage.removeItem(CAREER_TARGET_KEY);
    } catch {
      /* Ignore optional preference write failures. */
    }
  }, []);
  const setCourseTargetCode = useCallback((code: string | null) => {
    setCourseTargetCodeState(code);
    try {
      if (code) window.localStorage.setItem(COURSE_TARGET_KEY, code);
      else window.localStorage.removeItem(COURSE_TARGET_KEY);
    } catch {
      /* Ignore optional preference write failures. */
    }
  }, []);
  const setWorkspaceSelection = useCallback((next: WorkspaceSelection) => {
    setWorkspaceSelectionState((current) => (sameWorkspaceSelection(current, next) ? current : next));
    try {
      window.localStorage.setItem(WORKSPACE_SELECTION_KEY, JSON.stringify(next));
    } catch {
      /* Ignore optional preference write failures. */
    }
  }, []);

  const save = useCallback(() => {
    if (!hydrated || storageBlocked) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsePlan(plan)));
      setPersistence("saved");
      setStorageError(null);
    } catch (error) {
      setPersistence("error");
      setStorageError(error instanceof Error ? error.message : "Your browser could not save this plan.");
    }
  }, [hydrated, storageBlocked, plan]);
  useEffect(save, [save]);

  const progress = useMemo(() => catalog ? validatePlan(plan, catalog) : null, [plan, catalog]);
  const resetPlan = () => {
    if (!window.confirm("Reset your local plan? This permanently replaces all saved semesters, completed courses, and waivers in this browser. If saved data is unreadable, it will also be replaced. This cannot be undone.")) return;
    setPlan(emptyPlan());
    setStorageBlocked(false);
    setBlockedRawStorage(null);
    setPersistence("saved");
    setStorageError(null);
    announce("Your plan has been reset. No courses are marked completed or waived.");
  };
  const exportPlanBackup = useCallback(
    () => createPlanBackupDownload({
      blocked: storageBlocked,
      plan,
      rawStored: blockedRawStorage,
    }),
    [blockedRawStorage, plan, storageBlocked],
  );
  const restorePlanBackup = useCallback((candidate: StudentPlan) => {
    try {
      // Persist first: a failed write must never replace the plan the user is viewing.
      const restored = restorePlan(window.localStorage, candidate);
      setPlan(restored);
      setStorageBlocked(false);
      setBlockedRawStorage(null);
      setPersistence("saved");
      setStorageError(null);
      announce("Backup restored and saved on this device.");
      return true;
    } catch (error) {
      setPersistence("error");
      setStorageError(error instanceof Error ? error.message : "Your browser could not save this restored plan.");
      announce("Backup could not be restored because this browser could not save it. Your current plan is unchanged.");
      return false;
    }
  }, [announce]);
  const setCourseStatus = (code: string, status: CourseStatus, credits?: number) => {
    setPlan((current) => {
      const completedCredits = { ...current.completedCredits };
      delete completedCredits[code];
      if (status === "completed") completedCredits[code] = credits ?? current.completedCredits[code] ?? catalog?.courses.find((course) => course.code === code)?.credits ?? 0;
      return {
        ...current,
        completedCourses: [...current.completedCourses.filter((item) => item !== code), ...(status === "completed" ? [code] : [])],
        waivedCourses: [...current.waivedCourses.filter((item) => item !== code), ...(status === "waived" ? [code] : [])],
        completedCredits,
        semesters: current.semesters.map((semester) => ({ ...semester, courses: status === "none" ? semester.courses : semester.courses.filter((item) => item.code !== code) })),
      };
    });
    announce(status === "none" ? `${code} completion or waiver undone.` : `${code} marked ${status}. ${status === "waived" ? "Waivers do not earn credits." : "Removed from planned semesters to avoid double counting."}`);
  };
  const addCourse = (code: string, semesterId: string, credits: number, includeCorequisite = false) => {
    const selectedCourse = catalog?.courses.find((course) => course.code === code);
    const companionCode = selectedCourse?.corequisites.type === "course" ? selectedCourse.corequisites.code : null;
    const items = [{ code, credits }];
    const companionCourse = includeCorequisite && companionCode ? catalog?.courses.find((course) => course.code === companionCode) : null;
    if (companionCourse) items.push({ code: companionCourse.code, credits: companionCourse.credits });
    let result: ReturnType<typeof appendCoursesToSemester> | undefined;
    let semesterName: string | undefined;
    setPlan((current) => {
      result = appendCoursesToSemester(current, semesterId, items);
      semesterName = current.semesters.find((semester) => semester.id === semesterId)?.name;
      return result.ok ? result.plan : current;
    });
    if (!result) return;
    if (!result.ok) {
      if (result.reason === "missing-term") announce("Choose an existing term before adding a course.");
      else if (result.reason === "capacity") announce(`${semesterName} supports up to 32 planned courses.`);
      else announce(`${code} is already recorded in your plan or history.`);
      return;
    }
    announce(additionNotice(result.plan, result.added, result.semesterName));
  };
  const addCourses = (codes: Iterable<string>, semesterId: string) => {
    if (!catalog) {
      announce("Catalog is still loading. Try adding the line again in a moment.");
      return;
    }
    let result: ReturnType<typeof appendCoursesToSemester> | undefined;
    let semesterName: string | undefined;
    setPlan((current) => {
      const items = addableLineCourses(codes, catalog.courses, recordedCourseCodes(current));
      result = appendCoursesToSemester(current, semesterId, items);
      semesterName = current.semesters.find((semester) => semester.id === semesterId)?.name;
      return result.ok ? result.plan : current;
    });
    if (!result) return;
    if (!result.ok) {
      if (result.reason === "missing-term") announce("Choose an existing term before adding a course.");
      else if (result.reason === "capacity") announce(`${semesterName} supports up to 32 planned courses.`);
      else announce("Every course on this line is already in your plan or history, or is an external catalog reference.");
      return;
    }
    announce(additionNotice(result.plan, result.added, result.semesterName));
  };
  const additionNotice = (nextPlan: StudentPlan, added: string[], semesterName: string) => {
    const addedLabel = added.join(added.length === 2 ? " and " : ", ");
    if (!catalog) return `${addedLabel} added to ${semesterName}. Check the live audit for prerequisites and corequisites.`;
    const issue = validatePlan(nextPlan, catalog).issues.find(
      (item) => added.includes(item.courseCode) && (item.kind === "prerequisite" || item.kind === "corequisite"),
    );
    if (!issue) return `${addedLabel} added to ${semesterName}.`;
    const fix = suggestedPrerequisiteFix(issue, nextPlan, addableProgramCodes(catalog.courses));
    return `${addedLabel} added to ${semesterName}. ${issue.kind === "prerequisite" ? "Prerequisites not met" : "Corequisite not met"}${fix ? ` — ${fix.suggestion}` : ""}. Open Plan to apply a fix.`;
  };
  const addTargetChain = () => {
    if (!catalog) {
      announce("Catalog is still loading. Try adding the path again in a moment.");
      return;
    }
    if (!courseTargetCode) {
      announce("Choose a target course before adding its prerequisite chain.");
      return;
    }
    let added: string[] = [];
    let createdTerms: string[] = [];
    let capacityTerm: string | undefined;
    let failed: "capacity" | "missing-term" | undefined;
    setPlan((current) => {
      const snapshot = targetPathSnapshot(courseTargetCode, catalog.courses, current);
      const result = applyRemainingPathToPlan(current, catalog.courses, snapshot.earliest.placements);
      if (!result.ok) {
        failed = result.reason;
        capacityTerm = result.semesterName;
        return current;
      }
      added = result.added;
      createdTerms = result.createdTerms;
      return result.plan;
    });
    if (failed === "capacity") {
      announce(`${capacityTerm ?? "That term"} supports up to 32 planned courses. The missing chain was not added.`);
      return;
    }
    if (failed === "missing-term") {
      announce("A planned term for this path is missing. The missing chain was not added.");
      return;
    }
    if (!added.length) {
      announce("Every course on this path is already in your plan or history, or cannot be added.");
      return;
    }
    announce(`${added.join(", ")} added along the path to ${courseTargetCode}${createdTerms.length ? `. Created ${createdTerms.join(", ")}` : ""}. Check the live audit for prerequisites and corequisites.`);
  };

  return <AppContext.Provider value={{ catalog, catalogBusy, catalogError, catalogMessage, refreshCatalog: () => fetchCatalog(true), plan, setPlan, progress, hydrated, persistence, storageError, retrySave: save, resetPlan, exportPlanBackup, restorePlanBackup, detailCode, openCourse, picker, openPicker: (semesterId, courseCode) => { openCourse(null); setPicker({ semesterId, courseCode }); }, closePicker: () => setPicker(null), setCourseStatus, addCourse, addCourses, careerTargetId, setCareerTargetId, courseTargetCode, setCourseTargetCode, addTargetChain, workspaceSelection, setWorkspaceSelection, notice, announce }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("NEU MSCS Course Planner must be used inside AppProvider.");
  return context;
}
