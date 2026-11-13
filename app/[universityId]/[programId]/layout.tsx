import type { Metadata } from "next";
import { AppProvider } from "@/components/app-provider";
import { AppShell } from "@/components/app-shell";
import { programParams, readProgram, titleName, titleTemplate, type ProgramParams } from "@/lib/program-page";

export const dynamicParams = false; // only published programs have pages

export function generateStaticParams() {
  return programParams();
}

type Props = { params: Promise<ProgramParams> };

/** Every page title names the program with the short name from the snapshot: "Courses · <short name>" (#117). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name, shortName } = await readProgram(params);
  return {
    // The root template wraps this default: "<short name> · Course Map".
    title: { default: titleName(shortName), template: titleTemplate(shortName) },
    description: `Understand what every course unlocks in the ${name} program. Explore the prerequisite map, then plan locally.`,
  };
}

export default async function ProgramLayout({ children, params }: Props & { children: React.ReactNode }) {
  const { key, catalog, shortName } = await readProgram(params);
  // The URL selects the catalog. `key` gives each program its own provider state.
  return <AppProvider key={key} catalogKey={key}>
    <AppShell university={catalog.university ?? ""} program={catalog.program ?? catalog.requirements.name} shortName={shortName}>{children}</AppShell>
  </AppProvider>;
}
