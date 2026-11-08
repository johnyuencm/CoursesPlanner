import { AppProvider } from "@/components/app-provider";
import { AppShell } from "@/components/app-shell";
import { programParams, readProgram, type ProgramParams } from "@/lib/program-page";

export const dynamicParams = false; // only published programs have pages

export function generateStaticParams() {
  return programParams();
}

export default async function ProgramLayout({ children, params }: { children: React.ReactNode; params: Promise<ProgramParams> }) {
  const { key } = await readProgram(params);
  // The URL selects the catalog. `key` gives each program its own provider state.
  return <AppProvider key={key} catalogKey={key}><AppShell>{children}</AppShell></AppProvider>;
}
