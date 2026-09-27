import { pathwayCourseCodes } from "./critical-path";
import type { Pathway } from "./types";

export const PERSONA_PROMPT = "What are you trying to become?";

export type OverlayRole = "critical" | "core" | "recommended";

export const OVERLAY_ROLE_LABEL: Record<OverlayRole, string> = {
  critical: "CRITICAL ★",
  core: "CORE",
  recommended: "RECOMMENDED",
};

export type PathwayOverlay = {
  personaId: string;
  personaName: string;
  keep: Set<string>;
  core: Set<string>;
  recommended: Set<string>;
  critical: Set<string>;
};

export function buildPathwayOverlay(input: {
  persona: Pick<Pathway, "id" | "name" | "groups"> | null | undefined;
  coreCourses: readonly string[];
  bottleneck?: readonly string[] | null;
}): PathwayOverlay | null {
  if (!input.persona) return null;
  const recommended = new Set(pathwayCourseCodes(input.persona));
  const core = new Set(input.coreCourses);
  const critical = new Set(input.bottleneck ?? []);
  return {
    personaId: input.persona.id,
    personaName: input.persona.name,
    keep: new Set([...recommended, ...core, ...critical]),
    core,
    recommended,
    critical,
  };
}

export function overlayRoleFor(
  code: string,
  overlay: Pick<PathwayOverlay, "critical" | "core" | "recommended"> | null | undefined,
): OverlayRole | null {
  if (!overlay) return null;
  if (overlay.critical.has(code)) return "critical";
  if (overlay.core.has(code)) return "core";
  if (overlay.recommended.has(code)) return "recommended";
  return null;
}

export function overlayNodeCopy(code: string, overlay: PathwayOverlay | null | undefined) {
  const role = overlayRoleFor(code, overlay);
  return {
    role,
    label: role ? OVERLAY_ROLE_LABEL[role] : "",
    starred: role === "critical",
  };
}

/** Line focus > bottleneck toggle > persona overlay > neighborhood. */
export function graphPersonaEmphasis(input: {
  code: string;
  lineCodes?: ReadonlySet<string> | null;
  bottleneck?: ReadonlySet<string> | null;
  overlayKeep?: ReadonlySet<string> | null;
  neighborhood: ReadonlySet<string>;
}): boolean {
  if (input.lineCodes) return input.lineCodes.has(input.code);
  if (input.bottleneck) return input.bottleneck.has(input.code);
  if (input.overlayKeep) return input.overlayKeep.has(input.code);
  return input.neighborhood.has(input.code);
}

export function overlayKeepsEdge(
  source: string,
  target: string,
  keep: ReadonlySet<string> | null | undefined,
): boolean {
  return Boolean(keep?.has(source) && keep?.has(target));
}
