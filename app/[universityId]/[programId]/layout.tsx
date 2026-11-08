import type { Metadata } from "next";
import { AppProvider } from "@/components/app-provider";
import { AppShell } from "@/components/app-shell";
import { programParams, readProgram, type ProgramParams } from "@/lib/program-page";

export const dynamicParams = false; // only published programs have pages

export function generateStaticParams() {
  return programParams();
}

type Props = { params: Promise<ProgramParams> };

/** Every page title names the college and program from the snapshot: "Courses · <name> · Course Map". */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await readProgram(params);
  return {
    // The root template wraps this default: "<name> · Course Map".
    title: { default: name, template: `%s · ${name} · Course Map` },
    description: `Understand what every course unlocks in the ${name} program. Explore the prerequisite map, then plan locally.`,
  };
}

export default async function ProgramLayout({ children, params }: Props & { children: React.ReactNode }) {
  const { key, catalog } = await readProgram(params);
  // The URL selects the catalog. `key` gives each program its own provider state.
  return <AppProvider key={key} catalogKey={key}>
    <AppShell university={catalog.university ?? ""} program={catalog.program ?? catalog.requirements.name}>{children}</AppShell>
  </AppProvider>;
}
