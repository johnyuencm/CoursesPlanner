"use client";

// The college and program picker on `/` (#72). The server renders the full lists (crawlers read them);
// search filters them in the browser. The remembered program (`coursesplanner:catalog-key`) is offered first.
import Link from "next/link";
import { useEffect, useState } from "react";
import { CATALOG_KEY_PREFERENCE, canonicalCatalogKey } from "@/lib/catalog-key";
import type { SupportTier } from "@/lib/types";

export type PickerProgram = { key: string; href: string; college: string; program: string; tier: SupportTier; catalogYear: string };
export type PickerCollege = { id: string; name: string; catalogUrl: string };

const TIER_TEXT: Record<SupportTier, string> = {
  audit: "Audit: prerequisite map, plan checks and degree audit",
  map: "Map: prerequisite map and plan checks, no degree audit",
};

/** True when every word of the query is in the text (case-insensitive). An empty query matches all. */
export function matchesQuery(query: string, text: string): boolean {
  const lower = text.toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((word) => lower.includes(word));
}

function ProgramLink({ program }: { program: PickerProgram }) {
  return <Link href={program.href} className="picker-program">
    <strong>{program.program}</strong>
    <span className="picker-meta">
      <span className={program.tier === "audit" ? "badge badge-core" : "badge badge-breadth"} title={TIER_TEXT[program.tier]}>{program.tier === "audit" ? "Audit" : "Map"}</span>
      <span>{program.catalogYear} catalog</span>
    </span>
  </Link>;
}

export function ProgramPicker({ programs, colleges }: { programs: PickerProgram[]; colleges: PickerCollege[] }) {
  const [query, setQuery] = useState("");
  const [remembered, setRemembered] = useState<PickerProgram | null>(null);
  useEffect(() => {
    try {
      const key = canonicalCatalogKey(window.localStorage.getItem(CATALOG_KEY_PREFERENCE));
      setRemembered(programs.find((program) => program.key === key) ?? null);
    } catch { /* Blocked storage: no shortcut. */ }
  }, [programs]);

  const shownPrograms = programs.filter((program) => matchesQuery(query, `${program.college} ${program.program} ${program.tier} ${program.catalogYear}`));
  const byCollege = [...new Set(shownPrograms.map((program) => program.college))]
    .map((college) => [college, shownPrograms.filter((program) => program.college === college)] as const);
  const shownColleges = colleges.filter((college) => matchesQuery(query, college.name));

  return <>
    {remembered && <section className="picker-remembered" aria-labelledby="picker-remembered-title">
      <h2 id="picker-remembered-title">Continue with your last program</h2>
      <p><Link className="button button-primary" href={remembered.href}>{remembered.program} · {remembered.college}</Link></p>
    </section>}
    <form className="picker-search" role="search" onSubmit={(event) => event.preventDefault()}>
      <label htmlFor="picker-query">Search colleges and programs</label>
      <input id="picker-query" type="search" placeholder="College or program, for example: Computer Science" value={query} onChange={(event) => setQuery(event.target.value)} />
      <p className="muted" aria-live="polite">{shownPrograms.length} program{shownPrograms.length === 1 ? "" : "s"} and {shownColleges.length} other college{shownColleges.length === 1 ? "" : "s"} match.</p>
    </form>
    <section aria-labelledby="picker-programs-title">
      <h2 id="picker-programs-title">Supported programs</h2>
      <p className="muted">Audit: the plan is checked against the degree rules. Map: prerequisite map and plan checks, but no degree audit.</p>
      {byCollege.length ? byCollege.map(([college, list]) => <div key={college} className="picker-college">
        <h3>{college}</h3>
        <ul className="picker-list">{list.map((program) => <li key={program.key}><ProgramLink program={program} /></li>)}</ul>
      </div>) : <p>No supported program matches this search.</p>}
    </section>
    <section aria-labelledby="picker-other-title">
      <h2 id="picker-other-title">Colleges not supported yet</h2>
      <p className="muted">The course map does not have the catalogs of these colleges yet. They are in our list of colleges to add. Until then, use the official catalog.</p>
      {shownColleges.length ? <ul className="picker-list picker-other">{shownColleges.map((college) => <li key={college.id}>
        <span>{college.name}</span> <span className="badge">Not supported yet</span> <a href={college.catalogUrl} rel="noopener noreferrer" target="_blank">Official catalog</a>
      </li>)}</ul> : <p>No other college matches this search.</p>}
    </section>
  </>;
}
