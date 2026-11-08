import { NextResponse, type NextRequest } from "next/server";
import { readCatalog } from "@/lib/catalog";
import { courseSlug, publicCourses } from "@/lib/course-pages";

let known: Set<string> | null = null;

// An unknown /courses/<slug> would render notFound() inside the root layout (about 10 ms CPU on Workers Free).
// A rewrite to a path that no route matches renders app/global-not-found.tsx, which skips the layout.
export function proxy(request: NextRequest) {
  known ??= new Set(publicCourses(readCatalog()).map((course) => courseSlug(course.code)));
  const slug = request.nextUrl.pathname.split("/")[2] ?? "";
  if (known.has(slug)) return NextResponse.next();
  return NextResponse.rewrite(new URL("/__unknown-course", request.url));
}

export const config = { matcher: "/courses/:slug" };
