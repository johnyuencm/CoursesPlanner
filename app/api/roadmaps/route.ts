import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { loadUniversityDirectory } from "@/lib/university-directory";
import {
  findUniversity,
  listRoadmapUniversities,
  readProgramDirectory,
  readReadyRoadmap,
  roadmapReadAnswer,
} from "@/lib/roadmap-reader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,80}$/;
const NO_STORE = { "Cache-Control": "no-store" };

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE });
}

function jsonBody(body: string) {
  return new NextResponse(body, { headers: { ...NO_STORE, "Content-Type": "application/json" } });
}

function remember(memoKey: string | null, value: unknown) {
  const body = JSON.stringify(value);
  if (memoKey !== null) productionBodies.set(memoKey, body);
  return jsonBody(body);
}

// Production serves only the committed snapshot, which cannot change while the
// process runs. Checking and serializing a ~200 KB roadmap costs more than the
// 10 ms Workers Free CPU limit allows on some requests, so keep each 200 body.
// ponytail: one entry per query, but only successful reads of real ids are kept.
const productionBodies = new Map<string, string>();

/**
 * Same-origin roadmap reader. Only reads validated local snapshots; it never
 * crawls or fetches a remote catalog, so it is safe to run in Next.js/Vercel.
 */
export async function handleRoadmapsRequest(
  request: NextRequest,
  rootDir = process.cwd(),
): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const universityId = params.get("university");
  const programId = params.get("program");

  // Reject traversal-shaped or malformed identifiers before any lookup.
  if (universityId !== null && !SAFE_ID.test(universityId)) {
    return errorResponse("Invalid university id.", 400);
  }
  if (programId !== null && !SAFE_ID.test(programId)) {
    return errorResponse("Invalid program id.", 400);
  }
  if (programId !== null && universityId === null) {
    return errorResponse("A program id requires a university id.", 400);
  }

  const memoKey = process.env.NODE_ENV === "production" && rootDir === process.cwd()
    ? `${universityId ?? ""}/${programId ?? ""}`
    : null;
  const memo = memoKey === null ? undefined : productionBodies.get(memoKey);
  if (memo !== undefined) return jsonBody(memo);

  try {
    const universities = await loadUniversityDirectory(
      path.join(rootDir, "catalog-service", "universities.json"),
    );
    if (universityId === null) {
      return remember(memoKey, { universities: await listRoadmapUniversities(universities, rootDir) });
    }
    const university = findUniversity(universities, universityId);
    if (programId === null) {
      return remember(memoKey, await readProgramDirectory(university, rootDir));
    }
    return remember(memoKey, await readReadyRoadmap(university, programId, rootDir));
  } catch (error) {
    const { message, status } = roadmapReadAnswer(error);
    return errorResponse(message, status);
  }
}

export async function GET(request: NextRequest) {
  return handleRoadmapsRequest(request);
}
