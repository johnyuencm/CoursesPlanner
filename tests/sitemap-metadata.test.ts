// Titles and descriptions of every sitemap page, as the browser and search engines get them (#117).
import { strict as assert } from "node:assert";
import { register } from "node:module";
import test from "node:test";
import type { Metadata } from "next";
import { mergeMetadata } from "vinext/shims/metadata";

import sitemap from "../app/sitemap";
import { CATALOGS } from "../lib/catalog-key";
import { readProgramCatalog } from "../lib/program-catalog";

// app/layout.tsx imports CSS, which Node cannot load. An empty module stands in for it.
register(`data:text/javascript,${encodeURIComponent(
  "export const load = (url, context, next) => url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context);",
)}`);

/** A layout or page module: the component, and static or generated metadata (the Explore page has none). */
type Segment = { default: unknown; metadata?: Metadata; generateMetadata?(props: { params: Promise<Record<string, string>> }): Promise<Metadata> };

const [root, home, program, overview, explore, explorePage, courses, course, paths, pathway]: Segment[] = await Promise.all([
  import("../app/layout"), import("../app/page"), import("../app/[universityId]/[programId]/layout"),
  import("../app/[universityId]/[programId]/page"), import("../app/[universityId]/[programId]/explore/layout"),
  import("../app/[universityId]/[programId]/explore/page"), import("../app/[universityId]/[programId]/courses/page"),
  import("../app/[universityId]/[programId]/courses/[code]/page"), import("../app/[universityId]/[programId]/pathways/page"),
  import("../app/[universityId]/[programId]/pathways/[id]/page"),
]);

/** The metadata of one page: root layout first, then each nested layout, then the page, merged by vinext. */
async function pageMetadata(pathname: string): Promise<Metadata> {
  const [universityId = "", programId = "", section = "", leaf = ""] = pathname.split("/").filter(Boolean);
  const pages: Record<string, Segment> = { "": overview!, explore: explorePage!, courses: leaf ? course! : courses!, pathways: leaf ? pathway! : paths! };
  const page = universityId ? pages[section] : home;
  assert.ok(page, `no page module for ${pathname}`);
  const segments = universityId ? [root!, program!, ...(section === "explore" ? [explore!] : []), page] : [root!, page];
  const params = { universityId, programId, code: leaf, id: leaf };
  return mergeMetadata(await Promise.all(segments.map((segment) =>
    segment.generateMetadata?.({ params: Promise.resolve(params) }) ?? segment.metadata ?? {})) as never[]) as Metadata;
}

const pages = await Promise.all((await sitemap()).map(async ({ url }) => {
  const pathname = new URL(url).pathname;
  const { title, description } = await pageMetadata(pathname);
  return { pathname, title: String(title ?? ""), description: String(description ?? "") };
}));

test("every sitemap page has a unique title, program titles use the short name, and 90% fit in 60 characters (#117)", async () => {
  const shortNames = new Map(await Promise.all(Object.keys(CATALOGS).map(async (key) => [key, (await readProgramCatalog(key)).shortName] as const)));
  const titles = pages.map((page) => page.title);
  const lengths = titles.map((title) => title.length).sort((a, b) => a - b);
  const short = lengths.filter((length) => length <= 60).length;
  assert.ok(pages.length > 300, `only ${pages.length} sitemap pages`);
  assert.equal(new Set(titles).size, titles.length, "two pages share a title");
  assert.ok(short >= 0.9 * titles.length,
    `${short} of ${titles.length} titles are 60 characters or less; median ${lengths[lengths.length >> 1]}, longest ${lengths.at(-1)}`);
  for (const { pathname, title } of pages.filter((page) => page.pathname !== "/")) {
    const shortName = shortNames.get(pathname.split("/").slice(1, 3).join("/"));
    assert.ok(shortName, `no short name in the catalog of ${pathname}`);
    assert.ok(title.includes(shortName), `${pathname}: "${title}" does not name ${shortName}`);
  }
});

test("course page descriptions fit in 160 characters, and every description is unique (#117)", () => {
  const descriptions = pages.map((page) => page.description);
  assert.equal(new Set(descriptions).size, descriptions.length, "two pages share a description");
  const coursePages = pages.filter((page) => /\/courses\/[^/]+$/.test(page.pathname));
  assert.ok(coursePages.length > 300, `only ${coursePages.length} course pages`);
  const long = coursePages.filter((page) => page.description.length > 160).map((page) => `${page.description.length} ${page.pathname}`);
  assert.deepEqual(long, [], `${long.length} of ${coursePages.length} course descriptions are longer than 160 characters`);
});
