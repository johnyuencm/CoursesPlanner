import type { Metadata } from "next";
import { ProgramPicker, type PickerCollege, type PickerProgram } from "@/components/program-picker";
import { CATALOGS } from "@/lib/catalog-key";
import { readProgramCatalog } from "@/lib/program-catalog";
import { requirementTier } from "@/lib/requirements-v2";
import { programRoutes } from "@/lib/routes";
import { loadUniversityDirectory } from "@/lib/university-directory";

export const metadata: Metadata = {
  title: { absolute: "Course Map · Pick your college and program" },
  description: "Pick your college and program. See what every course unlocks, read the degree rules, and plan your terms in your browser.",
  alternates: { canonical: "/" },
};

/** Published programs (CATALOGS) under their college, then the other directory colleges. Prerendered at build time. */
async function pickerData(): Promise<{ programs: PickerProgram[]; colleges: PickerCollege[] }> {
  const directory = await loadUniversityDirectory();
  const programs = await Promise.all(Object.keys(CATALOGS).map(async (key): Promise<PickerProgram> => {
    const catalog = await readProgramCatalog(key);
    const universityId = key.split("/")[0]!;
    return {
      key,
      href: programRoutes(key).overview,
      college: catalog.university ?? directory.find((entry) => entry.id === universityId)?.university ?? universityId,
      program: catalog.program ?? catalog.requirements.name,
      tier: requirementTier(catalog.requirements, catalog.courses),
      catalogYear: catalog.requirements.catalogYear,
    };
  }));
  const published = new Set(Object.keys(CATALOGS).map((key) => key.split("/")[0]));
  const colleges = directory
    .filter((entry) => !published.has(entry.id))
    .map((entry) => ({ id: entry.id, name: entry.university, catalogUrl: entry.catalogUrl }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { programs, colleges };
}

export default async function HomePage() {
  const { programs, colleges } = await pickerData();
  return <main className="picker" id="main-content">
    <header className="picker-header">
      <p className="picker-brand">Course Map</p>
      <h1>Pick your college and program</h1>
      <p>See what every course unlocks, read the degree rules, and plan your terms. Your plan stays in this browser.</p>
    </header>
    <ProgramPicker programs={programs} colleges={colleges} />
  </main>;
}
