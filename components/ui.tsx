"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { ArrowUpRight, LoaderCircle, X } from "lucide-react";
import type { Course } from "@/lib/types";

export function PageHeading({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: ReactNode }) {
  return <header className="page-heading"><div>{eyebrow && <p className="eyebrow"><span />{eyebrow}</p>}<h1>{title}</h1><p className="page-description">{description}</p></div>{actions && <div className="heading-actions">{actions}</div>}</header>;
}

export function Modal({ title, eyebrow, children, onClose, drawer = false }: { title: string; eyebrow?: string; children: ReactNode; onClose: () => void; drawer?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
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
  return <div className="empty-state loading-state" role="status"><LoaderCircle className="spin" size={28} /><h2>Finding your direction</h2><p>Loading the official catalog and your local plan.</p></div>;
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

export function OfficialLink({ href, sources, children = "Official catalog" }: { href: string; sources?: string[]; children?: ReactNode }) {
  let safe = false;
  try {
    const url = new URL(href);
    if (url.protocol !== "https:") safe = false;
    else if (sources && sources.length > 0) {
      safe = sources.some((source) => {
        try { return new URL(source).protocol === "https:" && new URL(source).hostname === url.hostname; } catch { return false; }
      });
    } else {
      safe = url.hostname === "catalog.northeastern.edu";
    }
  } catch { /* A missing source is displayed as text, never an unsafe link. */ }
  return safe ? <a className="text-link" href={href} target="_blank" rel="noopener noreferrer">{children}<ArrowUpRight size={14} /></a> : <span className="muted">Official source unavailable</span>;
}

export function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}
