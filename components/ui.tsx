"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, LoaderCircle, X } from "lucide-react";
import type { Course } from "@/lib/types";

export function PageHeading({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: ReactNode }) {
  return <header className="page-heading"><div>{eyebrow && <p className="eyebrow"><span />{eyebrow}</p>}<h1>{title}</h1><p className="page-description">{description}</p></div>{actions && <div className="heading-actions">{actions}</div>}</header>;
}

const OVERLAY_KEY = "courseMapOverlay";
const overlayToken = () => (typeof window === "undefined" ? undefined : (window.history.state as Record<string, unknown> | null)?.[OVERLAY_KEY]);

/**
 * Back closes an open dialog before it leaves the page. The dialog adds one history entry.
 * A dialog that replaces another dialog (course detail -> add course) reuses that entry,
 * so Back never walks through closed dialogs. Closing with Escape, the X or the backdrop removes the entry.
 */
function useBackCloses(onClose: () => void) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const token = `${Date.now()}-${Math.random()}`;
    const state = { ...(window.history.state as Record<string, unknown> | null), [OVERLAY_KEY]: token };
    if (overlayToken()) window.history.replaceState(state, "");
    else window.history.pushState(state, "");
    const onPop = () => { if (overlayToken() !== token) close.current(); };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Wait one task: a dialog that opens in the same commit takes over the entry instead.
      window.setTimeout(() => { if (overlayToken() === token) window.history.back(); }, 0);
    };
  }, []);
}

export function Modal({ title, eyebrow, children, onClose, drawer = false }: { title: string; eyebrow?: string; children: ReactNode; onClose: () => void; drawer?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useBackCloses(onClose);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={ref} role="dialog" aria-labelledby={titleId} className={drawer ? "modal drawer" : "modal"} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal-inner"><header className="modal-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2 id={titleId}>{title}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></header>{children}</div></dialog>;
}

export function Meter({ value, max, label, detail }: { value: number; max: number; label: string; detail?: string }) {
  const percent = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return <div className="meter-block"><div className="meter-caption"><span>{label}</span><strong>{value} <span>/ {max}{detail ? ` ${detail}` : ""}</span></strong></div><div className="meter-track" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={Math.max(value, max)} aria-valuetext={`${value} of ${max}${detail ? ` ${detail}` : ""}`}><div style={{ width: `${percent}%` }} /></div></div>;
}

export function LoadingState() {
  return <div className="empty-state loading-state" role="status"><LoaderCircle className="spin" size={28} aria-hidden="true" /><h2>Loading the course map</h2><p>Reading the official catalog and the plan saved in this browser.</p></div>;
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty-state">{icon && <div className="empty-icon">{icon}</div>}<h3>{title}</h3><p>{children}</p>{action}</div>;
}

export function creditLabel(course: Pick<Course, "credits" | "maxCredits">) {
  return course.maxCredits !== undefined && course.maxCredits !== course.credits ? `${course.credits}–${course.maxCredits}` : String(course.credits);
}

export function CreditSelect({ course, value, onChange, id }: { course: Course; value: number; onChange: (value: number) => void; id?: string }) {
  if (course.maxCredits === undefined || course.maxCredits === course.credits) return <span className="credit-value">{course.credits} credits</span>;
  return <label className="credit-select" htmlFor={id}>{"Credits "}<select id={id} aria-label={`Credits for ${course.code}`} value={value} onChange={(event) => onChange(Number(event.target.value))}>{Array.from({ length: course.maxCredits - course.credits + 1 }, (_, index) => course.credits + index).map((credits) => <option key={credits} value={credits}>{credits}</option>)}</select></label>;
}

/** A link to an official page. The host must be a host of the catalog's own sources, else the text says it is unavailable. */
export function OfficialLink({ href, sources, children = "Official catalog" }: { href: string; sources?: string[]; children?: ReactNode }) {
  let safe = false;
  try {
    const url = new URL(href);
    safe = url.protocol === "https:" && (sources ?? []).some((source) => {
      try { return new URL(source).protocol === "https:" && new URL(source).hostname === url.hostname; } catch { return false; }
    });
  } catch { /* A missing source is displayed as text, never an unsafe link. */ }
  return safe ? <a className="text-link" href={href} target="_blank" rel="noopener noreferrer">{children}<ArrowUpRight size={14} /></a> : <span className="muted">Official source unavailable</span>;
}

export function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

/**
 * A two-step button for an action that replaces the whole plan. The first press asks in place
 * (no dialog); the second press runs it. Escape or Cancel steps back. The action still gives Undo.
 */
export function ConfirmButton({ children, confirmLabel, onConfirm, className = "text-button danger-text" }: { children: ReactNode; confirmLabel: string; onConfirm: () => void; className?: string }) {
  const [armed, setArmed] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const armRef = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  useEffect(() => {
    if (armed) confirmRef.current?.focus();
    else if (refocus.current) armRef.current?.focus();
    refocus.current = false;
  }, [armed]);
  // Escape and Cancel return focus to the first button. A press or Tab outside the group only disarms.
  // (Pointer, not blur: Safari does not focus a pressed button, so a blur check would drop the confirm press.)
  const groupRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!armed) return;
    const outside = (event: PointerEvent) => { if (!groupRef.current?.contains(event.target as Node)) setArmed(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [armed]);
  const stepBack = () => { refocus.current = true; setArmed(false); };
  if (!armed) return <button ref={armRef} type="button" className={className} data-keep-open onClick={() => setArmed(true)}>{children}</button>;
  return <span ref={groupRef} className="confirm-step" role="group" aria-label={confirmLabel}
    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); stepBack(); } }}
    onBlur={(event) => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setArmed(false); }}>
    {/* The action's toast takes focus (focusAction), so focus is not lost when a menu closes. */}
    <button ref={confirmRef} type="button" className="button button-primary button-small" onClick={() => { setArmed(false); onConfirm(); }}>{confirmLabel}</button>
    <button type="button" className="button button-secondary button-small" data-keep-open onClick={stepBack}>Cancel</button>
  </span>;
}
